// AI title matching in SHADOW MODE. Changes nothing on the site and feeds nothing into the import.
//
// For every in-stock, sealed-looking crawl listing that carries no TCGplayer id, ask Sonnet to place it on ONE catalogue
// product (same method as scripts/ai-title-pilot.ts, round 2: 99.5% precision on 188 answers), run the deterministic
// guards below on the answer, and cache the decision by store host + title so later runs only pay for new or changed
// titles. The cache is one JSON file on the `ai-shadow` branch (never deployed: vercel.json disables every branch but
// main), written by .github/workflows/ai-shadow-match.yml. A decision is a RECORD, not a match: nothing reads it until
// the owner says so (CLAUDE.md: crawl listings are taken by id, own-stores aside).
//
// Env: AI_TEAM_ANTHROPIC_KEY (secret, never printed), AI_SHADOW_CACHE (path of the cache file), AI_SHADOW_MAX_USD
// (hard ceiling for this run, default 25, counted from reported usage), AI_SHADOW_MODEL (default claude-sonnet-5-5),
// AI_SHADOW_BATCH=1 (send every question as one Message Batch: half price, answers within the run or the batch is
// cancelled and its unanswered titles are asked next run), AI_SHADOW_REFERENCE (a cache from another model: the summary
// then reports how often the two agree, for the Haiku 5.5 trial of 2026-11-26).
import fs from "node:fs";
import path from "node:path";
import type { CrawlRun, CrawlListing } from "@/lib/import/crawl";
import { isForeign, isMulti, isUnfitListing } from "@/lib/import/match";
import { sealedTypeOf } from "@/lib/import/tcgcsv";

const ROOT = process.cwd();
const MODEL = process.env.AI_SHADOW_MODEL ?? "claude-sonnet-5-5";
// US$ per million tokens (Anthropic pricing as copied in Bargle's models.ts, 2026-11-10).
const PRICE: Record<string, { in: number; out: number }> = { "claude-sonnet-5-5": { in: 2, out: 10 }, "claude-haiku-5-5": { in: 0.1, out: 0.5 } };
const MAX_USD = Number(process.env.AI_SHADOW_MAX_USD ?? 25);
const BATCH = process.env.AI_SHADOW_BATCH === "1";
// Message Batches bill half the standard rate.
const RATE = BATCH ? 0.5 : 1;
const BATCH_MINUTES = Number(process.env.AI_SHADOW_BATCH_MINUTES ?? 45);
const REFERENCE = process.env.AI_SHADOW_REFERENCE;
const API = "https://api.anthropic.com/v1";
const CACHE = process.env.AI_SHADOW_CACHE ?? path.join(ROOT, "out/ai-shadow-cache.json");
const SHORTLIST = 25;
const WIDE = process.env.AI_POOL_WIDE === "1";
const SINGLE_MARK = /\b\d{1,3}\s*\/\s*\d{1,3}\b|\b(foil|holo|reverse|psa|bgs|cgc|graded|nm|lp|mp|rare|common|uncommon|promo|alt(ernate)? art|secret|ultra|super|full art|token|playset)\b|#\d+/i;
const RETRY_NULL_MS = 7 * 86_400_000;

interface Prod { id: number; name: string; line: string }
interface Decision { id: number | null; at: string; model: string; guard?: { pass: boolean; reasons: string[] }; why?: string }

const STOP = new Set(["the", "a", "an", "of", "and", "pack", "booster", "box", "tcg", "card", "game", "cards", "sealed", "new", "in", "stock"]);
const tok = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t && !STOP.has(t));

function loadProducts(): Prod[] {
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "data/public/catalog.json"), "utf8"));
  const lineOfSet = new Map<number, string>(cat.sets.map((s: { id: number; line: string }) => [s.id, s.line]));
  return cat.products
    .filter((p: { kind: string; sealedType?: string }) => p.kind === "sealed" && p.sealedType !== "Insert")
    .map((p: { id: number; name: string; setId: number }) => ({ id: p.id, name: p.name, line: lineOfSet.get(p.setId) ?? "" }));
}

function shortlist(l: CrawlListing, prods: Prod[]): Prod[] {
  const t = new Set(tok(l.title));
  return prods
    .filter((p) => l.lines.includes(p.line))
    .map((p) => { const pt = tok(p.name); const hit = pt.filter((x) => t.has(x)).length; return { p, score: hit / Math.max(pt.length, 1) + hit * 0.01 }; })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, SHORTLIST)
    .map((x) => x.p);
}

function shortlistScore(l: CrawlListing, prods: Prod[]): number {
  const t = new Set(tok(l.title));
  let best = 0;
  for (const p of prods) {
    if (!l.lines.includes(p.line)) continue;
    const pt = tok(p.name);
    if (!pt.length) continue;
    const r = pt.filter((x) => t.has(x)).length / pt.length;
    if (r > best) best = r;
  }
  return best;
}

// Words that make two printings of the same set different products. Both sides must carry exactly the same ones.
const EDITION_WORDS: [string, RegExp][] = [
  ["1st", /\b(1st|first)[ -]edition\b|\b1st ed\b/i],
  ["unlimited", /\bunlimited\b/i],
  ["2nd-print", /\b(2nd|second)[ -]print(ing)?\b/i],
  ["alter", /\balter(nate)?[ -]edition\b|\balter\b/i],
  ["carbonite", /\bcarbonite\b/i],
  ["anniversary", /\banniversary\b/i],
  ["collector", /\bcollector'?s?\b/i],
  ["play-booster", /\bplay booster\b/i],
  ["set-booster", /\bset booster\b/i],
  ["draft-booster", /\bdraft booster\b/i],
  ["jumpstart", /\bjumpstart\b/i],
  ["jumbo", /\bjumbo\b/i],
  ["prerelease", /\bpre-?release\b/i],
  ["hyperspace", /\bhyperspace\b/i],
];
const editionSet = (s: string) => new Set(EDITION_WORDS.filter(([, re]) => re.test(s)).map(([k]) => k));

/** Deterministic guard on an AI answer: it may only refuse. */
function guard(l: CrawlListing, p: Prod): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (isUnfitListing(l.title)) reasons.push("unfit");
  if (isForeign(l.title)) reasons.push("foreign");
  if (isMulti(l.title) !== isMulti(p.name)) reasons.push("multi");
  const said = sealedTypeOf(l.title);
  if (said === "Other") reasons.push("no-type");
  else if (said !== sealedTypeOf(p.name)) reasons.push(`type ${said}/${sealedTypeOf(p.name)}`);
  const a = editionSet(l.title), b = editionSet(p.name);
  for (const k of new Set([...a, ...b])) if (a.has(k) !== b.has(k)) reasons.push(`edition:${k}`);
  return { pass: reasons.length === 0, reasons };
}

let spent = 0;
let calls = 0;

function promptFor(l: CrawlListing, cands: Prod[]): string {
  const list = cands.map((c) => `${c.id}: ${c.name}`).join("\n");
  return `A store lists this product: "${l.title}" (price ${(l.cents / 100).toFixed(2)}).\nWhich ONE of these catalogue products is exactly the same sealed product (same set, same product type, same edition or printing, quantity one)? If none is clearly identical, or you are unsure, answer null. A wrong answer is worse than null.\n\n${list}\n\nReply with JSON only: {"id": <number or null>, "why": "<8 words>"}`;
}

function params(l: CrawlListing, cands: Prod[]) {
  // Haiku 5.5 thinks by default and 80 tokens of thinking would leave no answer; it accepts "disabled" (Sonnet 5.5 would 400).
  const thinking = MODEL.startsWith("claude-haiku") ? { thinking: { type: "disabled" } } : {};
  return { model: MODEL, max_tokens: 80, ...thinking, messages: [{ role: "user", content: promptFor(l, cands) }] };
}

const headers = () => ({ "x-api-key": process.env.AI_TEAM_ANTHROPIC_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" });

type Answer = { id: number | null; why: string };
type Reply = { content?: { type?: string; text?: string }[]; usage?: { input_tokens: number; output_tokens: number } };

/** Count the spend and read one model reply. Only an id from the shortlist is accepted. */
function readReply(j: Reply, cands: Prod[]): Answer | "error" {
  calls++;
  if (j.usage) spent += ((j.usage.input_tokens * PRICE[MODEL].in + j.usage.output_tokens * PRICE[MODEL].out) / 1e6) * RATE;
  const text = (j.content ?? []).map((b) => (b.type === undefined || b.type === "text" ? b.text ?? "" : "")).join("");
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const o = JSON.parse(m?.[0] ?? "{}") as { id?: number | null; why?: string };
    const id = typeof o.id === "number" && cands.some((c) => c.id === o.id) ? o.id : null;
    return { id, why: String(o.why ?? "").slice(0, 80) };
  } catch {
    return "error";
  }
}

async function ask(l: CrawlListing, cands: Prod[]): Promise<Answer | "budget" | "error"> {
  if (spent >= MAX_USD) return "budget";
  const res = await fetch(`${API}/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(params(l, cands)),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!res || !res.ok) return "error";
  return readReply((await res.json()) as Reply, cands);
}

/** Upper bound of one question's cost, so a batch never starts past the ceiling (about 4 characters a token). */
function worstCaseUsd(l: CrawlListing, cands: Prod[]): number {
  const inTok = Math.ceil(promptFor(l, cands).length / 3) + 20;
  return ((inTok * PRICE[MODEL].in + 80 * PRICE[MODEL].out) / 1e6) * RATE;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ask every question as ONE Message Batch. Questions are admitted only while their worst-case cost fits the ceiling.
 * If the batch has not ended within BATCH_MINUTES it is cancelled (unprocessed requests are not billed) and whatever
 * finished is still read; titles without an answer stay undecided and are asked next run.
 */
async function askBatch(items: { key: string; l: CrawlListing; cands: Prod[] }[]): Promise<{ answers: Map<string, Answer | "error">; admitted: number }> {
  const answers = new Map<string, Answer | "error">();
  const admitted: typeof items = [];
  let reserve = 0;
  for (const it of items) {
    const c = worstCaseUsd(it.l, it.cands);
    if (reserve + c > MAX_USD) break;
    reserve += c;
    admitted.push(it);
  }
  if (!admitted.length) return { answers, admitted: 0 };
  const byCustom = new Map(admitted.map((it, i) => [`q${i}`, it]));
  const create = await fetch(`${API}/messages/batches`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ requests: [...byCustom].map(([custom_id, it]) => ({ custom_id, params: params(it.l, it.cands) })) }),
    signal: AbortSignal.timeout(120_000),
  }).catch(() => null);
  if (!create || !create.ok) { console.log(`[ai-shadow] batch create failed: HTTP ${create?.status ?? "none"}`); return { answers, admitted: 0 }; }
  const batch = (await create.json()) as { id: string };
  console.log(`[ai-shadow] batch ${batch.id}: ${admitted.length} questions, worst case US$${reserve.toFixed(4)}`);
  const deadline = Date.now() + BATCH_MINUTES * 60_000;
  let status: { processing_status?: string; results_url?: string | null } = {};
  let cancelled = false;
  for (;;) {
    await sleep(20_000);
    const r = await fetch(`${API}/messages/batches/${batch.id}`, { headers: headers(), signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (r?.ok) status = (await r.json()) as typeof status;
    if (status.processing_status === "ended") break;
    if (!cancelled && Date.now() > deadline) {
      cancelled = true;
      console.log(`[ai-shadow] batch not done after ${BATCH_MINUTES} min: cancelling, unanswered titles wait for the next run`);
      await fetch(`${API}/messages/batches/${batch.id}/cancel`, { method: "POST", headers: headers(), signal: AbortSignal.timeout(30_000) }).catch(() => null);
    }
    if (cancelled && Date.now() > deadline + 10 * 60_000) { console.log("[ai-shadow] batch did not end after cancel: reading nothing"); return { answers, admitted: admitted.length }; }
  }
  if (!status.results_url) return { answers, admitted: admitted.length };
  const res = await fetch(status.results_url, { headers: headers(), signal: AbortSignal.timeout(120_000) }).catch(() => null);
  if (!res || !res.ok) { console.log(`[ai-shadow] batch results failed: HTTP ${res?.status ?? "none"}`); return { answers, admitted: admitted.length }; }
  for (const line of (await res.text()).split("\n")) {
    if (!line.trim()) continue;
    let row: { custom_id: string; result: { type: string; message?: Reply } };
    try { row = JSON.parse(line); } catch { continue; }
    const it = byCustom.get(row.custom_id);
    if (!it) continue;
    answers.set(it.key, row.result.type === "succeeded" && row.result.message ? readReply(row.result.message, it.cands) : "error");
  }
  return { answers, admitted: admitted.length };
}

/** How often this run's decisions agree with another model's cache, on titles both have decided. */
function compare(cache: Record<string, Decision>, ref: Record<string, Decision>) {
  let both = 0, same = 0, sameMatch = 0, onlyThis = 0, onlyRef = 0, differentId = 0, thisPassed = 0, refPassed = 0;
  for (const [k, d] of Object.entries(cache)) {
    const r = ref[k];
    if (!r || d.why === "no candidates") continue;
    both++;
    if (d.id === r.id) { same++; if (d.id !== null) sameMatch++; }
    else if (d.id !== null && r.id === null) onlyThis++;
    else if (d.id === null && r.id !== null) onlyRef++;
    else differentId++;
    if (d.id !== null && d.guard?.pass) thisPassed++;
    if (r.id !== null && r.guard?.pass) refPassed++;
  }
  return { both, same, sameMatch, onlyThis, onlyRef, differentId, thisPassedGuards: thisPassed, refPassedGuards: refPassed };
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

async function main() {
  if (!process.env.AI_TEAM_ANTHROPIC_KEY) { console.log("[ai-shadow] AI_TEAM_ANTHROPIC_KEY is not set: nothing to do"); return; }
  const runPath = path.join(ROOT, "data/crawl/listings.json");
  if (!fs.existsSync(runPath)) { console.log("[ai-shadow] data/crawl/listings.json missing: run scripts/crawl-uncovered.ts first"); return; }
  const run = JSON.parse(fs.readFileSync(runPath, "utf8")) as CrawlRun;
  const prods = loadProducts();
  const byId = new Map(prods.map((p) => [p.id, p]));
  let cache: Record<string, Decision> = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch {}

  const now = Date.now();
  const todo: { key: string; l: CrawlListing }[] = [];
  const seen = new Set<string>();
  let reused = 0;
  for (const s of run.stores) {
    for (const l of s.listings) {
      if (l.refuse || l.ids.length || !l.inStock) continue;
      const sealedWord = /box|pack|bundle|deck|tin|case|collection|display|trove/i.test(l.title);
      // Wide pool (AI_POOL_WIDE=1, owner's go 2026-11-17): titles with no product type word, the commonest id-less refusal.
      // Skip what reads as a single card (collector number, rarity or finish word, grading) and anything whose best
      // catalogue candidate shares under half its words; the guard still refuses a wrong type or edition afterwards.
      if (!sealedWord && !(WIDE && !SINGLE_MARK.test(l.title) && (shortlistScore(l, prods) >= 0.5))) continue;
      const key = `${s.host}|${l.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const d = cache[key];
      if (d && (d.id !== null || now - Date.parse(d.at) < RETRY_NULL_MS)) { reused++; continue; }
      todo.push({ key, l });
    }
  }
  console.log(`[ai-shadow] ${seen.size} id-less listings, ${reused} already decided, ${todo.length} to ask (${MODEL}${BATCH ? ", batch" : ""}, ceiling US$${MAX_USD})`);

  let asked = 0, matched = 0, guarded = 0, stopped = false;
  const record = (key: string, l: CrawlListing, r: Answer) => {
    asked++;
    if (r.id === null) { cache[key] = { id: null, at: new Date().toISOString(), model: MODEL, why: r.why }; return; }
    const g = guard(l, byId.get(r.id)!);
    matched++;
    if (g.pass) guarded++;
    cache[key] = { id: r.id, at: new Date().toISOString(), model: MODEL, guard: g, why: r.why };
  };
  const withCands: { key: string; l: CrawlListing; cands: Prod[] }[] = [];
  for (const { key, l } of todo) {
    const cands = shortlist(l, prods);
    if (!cands.length) { cache[key] = { id: null, at: new Date().toISOString(), model: MODEL, why: "no candidates" }; continue; }
    withCands.push({ key, l, cands });
  }
  if (BATCH) {
    const { answers, admitted } = await askBatch(withCands);
    if (admitted < withCands.length) stopped = true;
    for (const it of withCands) {
      const r = answers.get(it.key);
      if (r && r !== "error") record(it.key, it.l, r);
    }
  } else {
    await pool(withCands, 8, async ({ key, l, cands }) => {
      const r = await ask(l, cands);
      if (r === "budget") { stopped = true; return; }
      if (r === "error") return;
      record(key, l, r);
    });
  }

  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  let vsReference: ReturnType<typeof compare> | undefined;
  if (REFERENCE) {
    try { vsReference = compare(cache, JSON.parse(fs.readFileSync(REFERENCE, "utf8"))); } catch { console.log("[ai-shadow] reference cache unreadable: no comparison"); }
  }
  const summary = { at: new Date().toISOString(), model: MODEL, batch: BATCH, idLess: seen.size, reused, asked, matched, passedGuards: guarded, stoppedAtCeiling: stopped, calls, spentUsd: Number(spent.toFixed(4)), cacheEntries: Object.keys(cache).length, vsReference };
  const summaryPath = process.env.AI_SHADOW_SUMMARY ?? path.join(ROOT, "out/ai-shadow-summary.json");
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log("[ai-shadow] " + JSON.stringify(summary));
}

main().catch((e) => { console.error(e); process.exit(1); });
