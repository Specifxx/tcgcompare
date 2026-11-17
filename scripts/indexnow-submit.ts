// Pings IndexNow (Bing, Yandex, Seznam…) ONLY with pages that really changed (Grok growth report, owner, 2026-11-17):
//   - a sealed product page that qualifies for the index (lib/indexing.ts: cardIndexable) and was never sent before,
//     i.e. it newly qualified or was newly published;
//   - one already sent whose cheapest in-stock store price moved 5% or more since it was last sent;
//   - a set page or guide never sent before.
// Never the hubs and never "every product again each refresh": an unchanged page is not a signal. At most 1,000 URLs
// a run, biggest price first; what does not fit simply stays "never sent" and goes the next day. The record of what was
// sent and at what price is data/state/indexnow.json (public, prices only), committed by refresh-prices.yml.
import fs from "node:fs";
import path from "node:path";
import { SITE_URL } from "@/lib/site";
import { posts } from "@/lib/posts";
import { cardIndexable } from "@/lib/indexing";
import { indexSignals, priceOf, products, setById } from "@/lib/data";
import { sealedSets } from "@/lib/hubs";

export const MOVE_PCT = 5;
export const MAX_URLS = 1000;
export interface IndexNowState { sent: Record<string, number | null>; at: string }

/** Pure: which candidate URLs to send, given what was sent before. `cents` null means a page with no price (sent once). */
export function pick(cands: { url: string; cents: number | null }[], sent: Record<string, number | null>): string[] {
  const out: { url: string; w: number }[] = [];
  for (const c of cands) {
    const had = sent[c.url];
    if (!(c.url in sent)) out.push({ url: c.url, w: c.cents ?? 0 });
    else if (had && c.cents && Math.abs(c.cents - had) / had >= MOVE_PCT / 100) out.push({ url: c.url, w: c.cents });
  }
  return out.sort((a, b) => b.w - a.w).slice(0, MAX_URLS).map((x) => x.url);
}

function cheapestStore(id: number): number | null {
  let best: number | null = null;
  for (const o of priceOf(id).offers) {
    if (o.source === "ebay" || o.source === "amazon" || o.source === "tcgplayer" || !o.inStock || !(o.cents > 0) || o.currency !== "USD") continue;
    if (best == null || o.cents < best) best = o.cents;
  }
  return best;
}

async function main() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return console.log("[indexnow] INDEXNOW_KEY not set — skipped");
  const file = path.join(process.cwd(), "data/state/indexnow.json");
  let state: IndexNowState = { sent: {}, at: "" };
  try { state = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  const site = SITE_URL;
  const cands: { url: string; cents: number | null }[] = [
    ...sealedSets().map((s) => ({ url: `${site}/sets/${s.slug}`, cents: null })),
    ...posts().map((p) => ({ url: `${site}/blog/${p.slug}`, cents: null })),
    ...products()
      .filter((p) => p.kind === "sealed" && cardIndexable(p, indexSignals(p), setById(p.setId)))
      .map((p) => ({ url: `${site}/card/${p.slug}`, cents: cheapestStore(p.id) })),
  ];
  const urls = pick(cands, state.sent);
  if (!urls.length) return console.log("[indexnow] nothing new or moved 5%+, nothing sent");
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/indexnow-key.txt`, urlList: urls }),
  });
  console.log(`[indexnow] ${res.status} for ${urls.length} URLs`);
  if (res.status >= 200 && res.status < 300) {
    const byUrl = new Map(cands.map((c) => [c.url, c.cents]));
    for (const u of urls) state.sent[u] = byUrl.get(u) ?? null;
    state.at = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(state));
  }
}
if (process.argv[1]?.endsWith("indexnow-submit.ts")) main();
