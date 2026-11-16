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
// (hard ceiling for this run, default 25, counted from reported usage), AI_SHADOW_MODEL (default claude-sonnet-5-5).
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
const CACHE = process.env.AI_SHADOW_CACHE ?? path.join(ROOT, "out/ai-shadow-cache.json");
const SHORTLIST = 25;
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

async function ask(l: CrawlListing, cands: Prod[]): Promise<{ id: number | null; why: string } | "budget" | "error"> {
  if (spent >= MAX_USD) return "budget";
  const list = cands.map((c) => `${c.id}: ${c.name}`).join("\n");
  const prompt = `A store lists this product: "${l.title}" (price ${(l.cents / 100).toFixed(2)}).\nWhich ONE of these catalogue products is exactly the same sealed product (same set, same product type, same edition or printing, quantity one)? If none is clearly identical, or you are unsure, answer null. A wrong answer is worse than null.\n\n${list}\n\nReply with JSON only: {"id": <number or null>, "why": "<8 words>"}`;
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
      if (!/box|pack|bundle|deck|tin|case|collection|display|trove/i.test(l.title)) continue;
      const key = `${s.host}|${l.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const d = cache[key];
      if (d && (d.id !== null || now - Date.parse(d.at) < RETRY_NULL_MS)) { reused++; continue; }
      todo.push({ key, l });
    }
  }
  console.log(`[ai-shadow] ${seen.size} id-less listings, ${reused} already decided, ${todo.length} to ask (${MODEL}, ceiling US$${MAX_USD})`);

  let asked = 0, matched = 0, guarded = 0, stopped = false;
  await pool(todo, 8, async ({ key, l }) => {
    const cands = shortlist(l, prods);
    if (!cands.length) { cache[key] = { id: null, at: new Date().toISOString(), model: MODEL, why: "no candidates" }; return; }
    const r = await ask(l, cands);
    if (r === "budget") { stopped = true; return; }
    if (r === "error") return;
    asked++;
    if (r.id === null) { cache[key] = { id: null, at: new Date().toISOString(), model: MODEL, why: r.why }; return; }
    const g = guard(l, byId.get(r.id)!);
    matched++;
    if (g.pass) guarded++;
    cache[key] = { id: r.id, at: new Date().toISOString(), model: MODEL, guard: g, why: r.why };
  });

  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  const summary = { at: new Date().toISOString(), model: MODEL, idLess: seen.size, reused, asked, matched, passedGuards: guarded, stoppedAtCeiling: stopped, calls, spentUsd: Number(spent.toFixed(4)), cacheEntries: Object.keys(cache).length };
  fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "out/ai-shadow-summary.json"), JSON.stringify(summary, null, 2));
  console.log("[ai-shadow] " + JSON.stringify(summary));
}

main().catch((e) => { console.error(e); process.exit(1); });
