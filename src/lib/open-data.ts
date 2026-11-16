// Open price data (owner go, 2026-11-16; DECISIONS.md "Open price data"): a free, dated, credited dataset of what
// independent stores charge for sealed trading card product, plus a chained Sealed Price Index built from it.
//
// What is in it, and what never is: the cheapest in-stock, non-pre-order STORE price per product and market, in the
// store's own currency (never converted). No TCGplayer price, no eBay price, no Amazon price, no photo: those belong
// to their owners' terms, so the dataset carries none of them. TCGplayer's product id and the product's name are the
// join key and the label. No store key, no store link, so it never turns into a scraper's map of the stores.
import fs from "node:fs";
import path from "node:path";
import { SITE } from "@/site.config";
import { products, priceOf, setById } from "./data";
import { lineOfSet } from "./lines";
import { SITE_URL } from "./site";
import { CURRENCY, MARKETS, type Market, type Offer } from "./site-types";

export const OPEN_LICENCE = "CC BY 4.0";
export const OPEN_LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/";
export const OPEN_PATHS = { page: "/data", csv: "/data/sealed-prices.csv", index: "/data/price-index.json" } as const;

export interface OpenRow {
  id: number;
  game: string;
  gameSlug: string;
  set: string;
  name: string;
  type: string;
  market: Market;
  currency: string;
  cents: number;
  stores: number;
  url: string;
}

export const isStoreOffer = (o: Offer) => o.source !== "tcgplayer" && o.source !== "ebay" && o.source !== "amazon";

/** Pure: the cheapest in-stock store price per market among the offers, and how many stores have it in stock there. */
export function cheapestStorePerMarket(offers: readonly Offer[]): Partial<Record<Market, { cents: number; stores: number }>> {
  const out: Partial<Record<Market, { cents: number; stores: number }>> = {};
  const seen: Partial<Record<Market, Set<string>>> = {};
  for (const o of offers) {
    if (!isStoreOffer(o) || !o.inStock || o.preorder || !(o.cents > 0) || o.currency !== CURRENCY[o.market]) continue;
    (seen[o.market] ??= new Set()).add(o.source);
    const cur = out[o.market];
    if (!cur || o.cents < cur.cents) out[o.market] = { cents: o.cents, stores: 0 };
  }
  for (const m of MARKETS) if (out[m]) out[m]!.stores = seen[m]!.size;
  return out;
}

export function openRows(): OpenRow[] {
  const rows: OpenRow[] = [];
  for (const p of products()) {
    if (p.kind !== "sealed" || p.sealedType === "Insert") continue;
    const set = setById(p.setId);
    const line = lineOfSet(set);
    if (!set || !line) continue;
    const best = cheapestStorePerMarket(priceOf(p.id).offers);
    for (const m of MARKETS) {
      const b = best[m];
      if (!b) continue;
      rows.push({ id: p.id, game: line.name, gameSlug: line.slug, set: set.name, name: p.name, type: p.sealedType ?? "Other", market: m, currency: CURRENCY[m], cents: b.cents, stores: b.stores, url: `${SITE_URL}/card/${p.slug}` });
    }
  }
  return rows.sort((a, b) => a.gameSlug.localeCompare(b.gameSlug) || a.set.localeCompare(b.set) || a.name.localeCompare(b.name) || a.market.localeCompare(b.market));
}

const q = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_HEADER = ["tcgplayer_product_id", "game", "set", "product", "product_type", "market", "currency", "cheapest_store_price", "stores_in_stock", "url", "date"];

export function toCsv(rows: readonly OpenRow[], date: string): string {
  const lines = [CSV_HEADER.join(",")];
  for (const r of rows) lines.push([r.id, r.game, r.set, r.name, r.type, r.market, r.currency, (r.cents / 100).toFixed(2), r.stores, r.url, date].map(q).join(","));
  return lines.join("\n") + "\n";
}

/** The credit every export carries. */
export const credit = () => ({
  source: SITE.name,
  url: SITE_URL,
  licence: OPEN_LICENCE,
  licenceUrl: OPEN_LICENCE_URL,
  attribution: `Prices from ${SITE.name} (${SITE_URL})`,
  attributionHtml: `<a href="${SITE_URL}/data">Sealed price data from ${SITE.name}</a>`,
});

// ---- The Sealed Price Index -------------------------------------------------------------------------------------
// A chained, equal-weight basket per game, US market, USD: each day's level is yesterday's level times the median
// ratio of today's cheapest US store price to yesterday's, over the products priced both days. The basket changes as
// products come and go; the chain keeps a new product from moving the level. Day one is 100.
export interface IndexPoint { n: number; median: number; level: number }
export interface IndexDay { d: string; all: IndexPoint; games: Record<string, IndexPoint> }
export interface IndexFile { v: 1; base: string; note: string; days: IndexDay[] }

export const median = (xs: readonly number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Pure. prev/today: product id to cents. The median ratio over common products; null when fewer than minCommon. */
export function medianRatio(prev: Record<string, number>, today: Record<string, number>, minCommon = 8): { ratio: number; common: number } | null {
  const rs: number[] = [];
  for (const id of Object.keys(today)) {
    const a = prev[id], b = today[id];
    if (a > 0 && b > 0) rs.push(b / a);
  }
  if (rs.length < minCommon) return null;
  const s = rs.sort((x, y) => x - y);
  const m = s.length >> 1;
  return { ratio: s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2, common: s.length };
}

export function nextPoint(prevLevel: number | null, prev: Record<string, number> | null, today: Record<string, number>): IndexPoint {
  const level0 = prevLevel ?? 100;
  const r = prev ? medianRatio(prev, today) : null;
  return { n: Object.keys(today).length, median: median(Object.values(today)), level: Math.round(level0 * (r?.ratio ?? 1) * 100) / 100 };
}

export const INDEX_NOTE = "Chained median-ratio index of the cheapest in-stock US store price, USD, equal weight per product, 100 on the first day. Stores only: no TCGplayer, eBay or Amazon price. Pre-orders excluded.";

/** Pure: add one day to the index file (replacing the same date if the job re-ran). */
export function appendDay(file: IndexFile | null, date: string, prevBasket: Record<string, Record<string, number>> | null, todayBasket: Record<string, Record<string, number>>): IndexFile {
  const f: IndexFile = file ?? { v: 1, base: date, note: INDEX_NOTE, days: [] };
  const days = f.days.filter((d) => d.d !== date);
  const last = days.length ? days[days.length - 1] : null;
  const games: Record<string, IndexPoint> = {};
  const merged: Record<string, number> = {}, mergedPrev: Record<string, number> = {};
  for (const [g, t] of Object.entries(todayBasket)) {
    games[g] = nextPoint(last?.games[g]?.level ?? null, prevBasket?.[g] ?? null, t);
    Object.assign(merged, Object.fromEntries(Object.entries(t).map(([k, v]) => [`${g}:${k}`, v])));
    if (prevBasket?.[g]) Object.assign(mergedPrev, Object.fromEntries(Object.entries(prevBasket[g]).map(([k, v]) => [`${g}:${k}`, v])));
  }
  days.push({ d: date, all: nextPoint(last?.all.level ?? null, prevBasket ? mergedPrev : null, merged), games });
  return { ...f, days: days.slice(-400) };
}

/** Change in percent between the latest day and the day nearest `back` days earlier (null when the file is that short). */
export function changeOver(days: readonly IndexDay[], pick: (d: IndexDay) => IndexPoint | undefined, back: number): number | null {
  if (days.length < 2) return null;
  const last = days[days.length - 1];
  const cut = new Date(Date.parse(last.d + "T00:00:00Z") - back * 86400000).toISOString().slice(0, 10);
  const old = [...days].reverse().find((d) => d.d <= cut);
  const a = old && pick(old), b = pick(last);
  if (!a || !b || !a.level) return null;
  return Math.round((b.level / a.level - 1) * 1000) / 10;
}

/** A game's own line in the index is published only with this many products (a thin basket is noise). */
export const INDEX_MIN_PRODUCTS = 10;

export function loadIndex(): IndexFile | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "open", "index.json"), "utf8")) as IndexFile;
  } catch {
    return null;
  }
}
