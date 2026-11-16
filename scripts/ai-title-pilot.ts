// AI title-matching PILOT (read-only measurement, changes nothing on the site).
//
// Question it answers with real numbers: of the store listings the crawl refuses for carrying no TCGplayer id
// (meta.json crawl.refused "no-id" and "unconfirmed"), how many could a cheap model place on ONE catalogue product, and
// how often is it right?
//
//   Set A (ground truth): listings that DO carry exactly one known TCGplayer id. The id is hidden, the model is shown
//     the title plus a shortlist of catalogue products of the same game(s), and its answer is scored against the id.
//   Set B (the pool): in-stock, sealed-looking listings with no id at all. The model answers; nothing is scored (no
//     truth), the answers and counts go in the report for a human to eyeball before any rule is ever changed.
//
// It never edits data/, never feeds the import, never touches a store. Output: out/ai-title-pilot.json + .md (a
// workflow artifact). The key is the env var AI_TEAM_ANTHROPIC_KEY (a secret, never printed or written). No key = no-op.
// Hard spend ceiling AI_PILOT_MAX_USD (default 5), counted from the usage each reply reports at published prices.
import fs from "node:fs";
import path from "node:path";
import type { CrawlRun, CrawlListing } from "@/lib/import/crawl";

const ROOT = process.cwd();
const MODEL = process.env.AI_PILOT_MODEL ?? "claude-haiku-5-5";
// US$ per million tokens, from Anthropic's pricing page as copied in Bargle's models.ts (2026-11-10).
const PRICE: Record<string, { in: number; out: number }> = {
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
};
const N_A = Number(process.env.AI_PILOT_N_A ?? 300);
const N_B = Number(process.env.AI_PILOT_N_B ?? 300);
const MAX_USD = Number(process.env.AI_PILOT_MAX_USD ?? 5);
const SHORTLIST = Number(process.env.AI_PILOT_SHORTLIST ?? 25);

interface Prod { id: number; name: string; line: string; sealedType?: string }

const STOP = new Set(["the", "a", "an", "of", "and", "pack", "booster", "box", "tcg", "card", "game", "cards", "sealed", "new", "in", "stock"]);
const tok = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t && !STOP.has(t));

function loadProducts(): Prod[] {
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "data/public/catalog.json"), "utf8"));
  const lineOfSet = new Map<number, string>(cat.sets.map((s: { id: number; line: string }) => [s.id, s.line]));
  return cat.products
    .filter((p: { kind: string }) => p.kind === "sealed")
    .map((p: { id: number; name: string; setId: number; sealedType?: string }) => ({ id: p.id, name: p.name, line: lineOfSet.get(p.setId) ?? "", sealedType: p.sealedType }));
}

function shortlist(l: CrawlListing, prods: Prod[]): Prod[] {
  const t = new Set(tok(l.title));
  return prods
    .filter((p) => l.lines.includes(p.line))
    .map((p) => {
      const pt = tok(p.name);
      const hit = pt.filter((x) => t.has(x)).length;
      return { p, score: hit / Math.max(pt.length, 1) + hit * 0.01 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, SHORTLIST)
    .map((x) => x.p);
}

let spent = 0;
let calls = 0;

async function ask(l: CrawlListing, cands: Prod[]): Promise<{ id: number | null; why: string } | "budget" | "error"> {
  if (spent >= MAX_USD) return "budget";
  const list = cands.map((c) => `${c.id}: ${c.name}`).join("\n");
  const prompt = `A store lists this product: "${l.title}" (price ${(l.cents / 100).toFixed(2)}).\nWhich ONE of these catalogue products is exactly the same sealed product (same set, same product type, same edition, quantity one)? If none is clearly identical, or you are unsure, answer null. A wrong answer is worse than null.\n\n${list}\n\nReply with JSON only: {"id": <number or null>, "why": "<8 words>"}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.AI_TEAM_ANTHROPIC_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 80, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!res || !res.ok) return "error";
  const j = (await res.json()) as { content?: { text?: string }[]; usage?: { input_tokens: number; output_tokens: number } };
  calls++;
  if (j.usage) spent += (j.usage.input_tokens * PRICE[MODEL].in + j.usage.output_tokens * PRICE[MODEL].out) / 1e6;
  const m = (j.content?.[0]?.text ?? "").match(/\{[\s\S]*\}/);
  try {
    const o = JSON.parse(m?.[0] ?? "{}") as { id?: number | null; why?: string };
    const id = typeof o.id === "number" && cands.some((c) => c.id === o.id) ? o.id : null;
    return { id, why: String(o.why ?? "").slice(0, 80) };
  } catch {
    return "error";
  }
}

const sample = <T,>(a: T[], n: number): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b.slice(0, n);
};

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

async function main() {
  if (!process.env.AI_TEAM_ANTHROPIC_KEY) {
    console.log("[ai-pilot] AI_TEAM_ANTHROPIC_KEY is not set: nothing to do");
    return;
  }
  const runPath = path.join(ROOT, "data/crawl/listings.json");
  if (!fs.existsSync(runPath)) {
    console.log("[ai-pilot] data/crawl/listings.json missing: run scripts/crawl-uncovered.ts first");
    return;
  }
  const run = JSON.parse(fs.readFileSync(runPath, "utf8")) as CrawlRun;
  const prods = loadProducts();
  const known = new Set(prods.map((p) => p.id));
  const all = run.stores.flatMap((s) => s.listings.map((l) => ({ l, market: s.market, store: s.host })));

  const withId = all.filter(({ l }) => !l.refuse && [...new Set(l.ids.map((x) => x.id).filter((id) => known.has(id)))].length === 1);
  const noId = all.filter(({ l }) => !l.refuse && !l.ids.length && l.inStock && /box|pack|bundle|deck|tin|case|collection|display|trove/i.test(l.title));

  const A = sample(withId, N_A);
  let right = 0, wrong = 0, none = 0, err = 0, retrievalMiss = 0;
  const wrongs: unknown[] = [];
  await pool(A, 8, async ({ l, store }) => {
    const truth = [...new Set(l.ids.map((x) => x.id).filter((id) => known.has(id)))][0];
    const cands = shortlist(l, prods);
    if (!cands.some((c) => c.id === truth)) { retrievalMiss++; return; } // the shortlist missed the right product: reported apart
    const r = await ask(l, cands);
    if (r === "budget" || r === "error") { err++; return; }
    if (r.id === null) none++;
    else if (r.id === truth) right++;
    else { wrong++; wrongs.push({ store, title: l.title, said: r.id, truth, why: r.why }); }
  });

  const B = sample(noId, N_B);
  let answered = 0, bNone = 0, bErr = 0;
  const examples: unknown[] = [];
  await pool(B, 8, async ({ l, market, store }) => {
    const cands = shortlist(l, prods);
    if (!cands.length) { bNone++; return; }
    const r = await ask(l, cands);
    if (r === "budget" || r === "error") { bErr++; return; }
    if (r.id === null) { bNone++; return; }
    answered++;
    if (examples.length < 60) examples.push({ store, market, title: l.title, cents: l.cents, productId: r.id, product: prods.find((p) => p.id === r.id)?.name, why: r.why });
  });

  const report = {
    at: new Date().toISOString(), model: MODEL, calls, spentUsd: Number(spent.toFixed(4)),
    crawl: { listings: all.length, withOneKnownId: withId.length, noIdSealedLooking: noId.length },
    shortlist: SHORTLIST,
    setA: { n: A.length, right, wrong, modelUnsure: none, shortlistMissedTruth: retrievalMiss, errors: err, precisionWhenAnswering: right + wrong ? Number((right / (right + wrong)).toFixed(4)) : null, wrongs },
    setB: { n: B.length, answered, noAnswer: bNone, errors: bErr, answerRate: B.length ? Number((answered / B.length).toFixed(4)) : null, projectedAnswersOverPool: Math.round((answered / Math.max(B.length, 1)) * noId.length), examples },
  };
  fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
  const tag = MODEL.replace(/[^a-z0-9]+/gi, "-");
  fs.writeFileSync(path.join(ROOT, `out/ai-title-pilot-${tag}.json`), JSON.stringify(report, null, 2));
  const md = `# AI title-matching pilot ${report.at}\n\nModel ${MODEL}, ${calls} calls, US$${report.spentUsd} spent.\n\n- Crawl: ${all.length} listings, ${withId.length} carry one known id, ${noId.length} in-stock sealed-looking listings have no id.\n- Set A (truth known, n=${A.length}): right ${right}, wrong ${wrong}, no answer ${none}, errors ${err}. Precision when it answers: ${report.setA.precisionWhenAnswering ?? "n/a"}.\n- Set B (no id, n=${B.length}): answered ${answered}, no answer ${bNone}, errors ${bErr}. Answer rate ${report.setB.answerRate}; scaled to the pool about ${report.setB.projectedAnswersOverPool} listings.\n\nThese are measurements only. No rule changed. Taking a title match needs the owner's yes (CLAUDE.md: crawl listings are taken by id, own-stores aside) and a precision the owner accepts.\n`;
  const lines = [
    `- Set A split: right ${right}, wrong ${wrong}, model unsure ${none}, shortlist (${SHORTLIST}) missed the right product ${retrievalMiss}.`,
    ...wrongs.map((w) => `- WRONG: ${JSON.stringify(w)}`),
    ...examples.slice(0, 40).map((e) => { const x = e as { store: string; title: string; cents: number; product?: string }; return `- ${x.store} | ${x.title} | ${(x.cents / 100).toFixed(2)} -> ${x.product}`; }),
  ];
  fs.writeFileSync(path.join(ROOT, `out/ai-title-pilot-${tag}.md`), md + lines.join("\n") + "\n");
  console.log(md + lines.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
