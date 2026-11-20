// The Spread: TCG Prices' monthly sealed price report (DECISIONS.md "The Spread", 2026-11-20). One frozen edition per
// month at /the-spread/<yyyy-mm>, built by scripts/spread-edition.ts from what this site already commits: the daily
// cheapest in-stock STORE price per product and market (data/store-lows) and the day's store offers (data/public/prices).
//
// Rules, the same as the open data (lib/open-data.ts):
// - Stores only. Never a TCGplayer, eBay or Amazon price, never a TCGplayer-derived figure: their data is theirs.
// - Never converted between currencies: every market is measured in its own currency, and only percentages are compared.
// - Never estimated or back-filled: a product counts only where it has a real price on both days compared; a group with
//   fewer than SPREAD_MIN products is left out, not guessed.
// - Frozen: an edition file is written once and the page reads only that file, so a published number never changes.
//   A correction is a new line in the edition's `corrections`, never a silent edit.
// - The editor's notes (why prices moved) are written by a person or agent who checked them, never generated.
import type { Series } from "./series";
import { CURRENCY, MARKETS, type Market, type Offer } from "./site-types";

export const SPREAD_MIN = 10;
export const SPREAD_MIN_STORES = 3;
export const SPREAD_PATH = "/the-spread";

export interface Change {
  n: number;
  /** Median of each product's own % change, one decimal. */
  median: number;
  fell: number; // share of products, %, one decimal
  rose: number;
  flat: number;
}

export interface Gap {
  n: number;
  /** Median of (median store price / cheapest store price − 1), %. */
  toMedian: number;
  /** Median of (dearest / cheapest − 1), %. */
  toDearest: number;
  /** Median number of stores in stock per product. */
  stores: number;
}

export interface Mover {
  id: number;
  name: string;
  game: string;
  set: string;
  slug: string;
  from: number;
  to: number;
  pct: number;
  stores: number;
}

export interface MarketBlock {
  market: Market;
  currency: string;
  tracked: number;
  change: Change | null;
  /** Products in stock at a store on `from` that no store had in stock on `to`, % of those in stock on `from`. */
  soldOut: { n: number; pct: number } | null;
  gap: Gap | null;
  games: { slug: string; name: string; change: Change | null; gap: Gap | null }[];
  types: { type: string; gap: Gap }[];
  falls: Mover[];
  rises: Mover[];
}

export interface EventBlock {
  label: string;
  day: string;
  vs: string;
  markets: { market: Market; change: Change }[];
}

export interface Edition {
  v: 1;
  id: string; // yyyy-mm
  title: string;
  published: string; // yyyy-mm-dd
  from: string;
  to: string;
  /** The day the store gap (`gap`, `types`, mover store counts) was read: the offers committed that day. */
  gapDate: string;
  markets: MarketBlock[];
  events: EventBlock[];
  /** Written by hand after checking (why prices moved). Empty until then; the page says so. */
  notes: string[];
  corrections: { date: string; text: string }[];
}

export interface ProductInfo {
  id: number;
  name: string;
  slug: string;
  type: string;
  game: string;
  gameSlug: string;
  set: string;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function median(xs: readonly number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The price in effect on a day; 0 (no store had it) and no data are both null. */
export function priceOn(series: Series | undefined, day: number): number | null {
  if (!series?.length) return null;
  let v: number | null = null;
  for (const [d, c] of series) {
    if (d > day) break;
    v = c;
  }
  return v && v > 0 ? v : null;
}

/** Pure: matched-pair change over products priced on both days. Under SPREAD_MIN pairs is no verdict. */
export function matchedChange(pairs: readonly [number, number][], min = SPREAD_MIN): Change | null {
  const pct = pairs.filter(([a, b]) => a > 0 && b > 0).map(([a, b]) => ((b - a) / a) * 100);
  if (pct.length < min) return null;
  const n = pct.length;
  const share = (f: (x: number) => boolean) => r1((pct.filter(f).length / n) * 100);
  // "Flat" is under half a percent either way: a few cents of rounding is not a move.
  return { n, median: r1(median(pct)), fell: share((x) => x <= -0.5), rose: share((x) => x >= 0.5), flat: share((x) => Math.abs(x) < 0.5) };
}

/** Pure: each store's cheapest in-stock, non-pre-order price in a market, in that market's own currency. Stores only. */
export function storePrices(offers: readonly Offer[], market: Market): number[] {
  const by = new Map<string, number>();
  for (const o of offers) {
    if (o.source === "tcgplayer" || o.source === "ebay" || o.source === "amazon") continue;
    if (o.market !== market || !o.inStock || o.preorder || !(o.cents > 0) || o.currency !== CURRENCY[market]) continue;
    const cur = by.get(o.source);
    if (cur == null || o.cents < cur) by.set(o.source, o.cents);
  }
  return [...by.values()].sort((a, b) => a - b);
}

/** Pure: the gap between the cheapest and the typical store over products with SPREAD_MIN_STORES+ stores in stock. */
export function gapOf(perProduct: readonly number[][], min = SPREAD_MIN): Gap | null {
  const rows = perProduct.filter((p) => p.length >= SPREAD_MIN_STORES);
  if (rows.length < min) return null;
  const toMed = rows.map((p) => (median(p) / p[0] - 1) * 100);
  const toTop = rows.map((p) => (p[p.length - 1] / p[0] - 1) * 100);
  return { n: rows.length, toMedian: r1(median(toMed)), toDearest: r1(median(toTop)), stores: median(rows.map((p) => p.length)) };
}

export interface BuildInput {
  id: string;
  title: string;
  published: string;
  gapDate: string;
  fromDay: number;
  toDay: number;
  dayToDate: (d: number) => string;
  /** productId -> market -> cheapest-store series (data/store-lows). */
  lows: Map<number, Partial<Record<Market, Series>>>;
  info: Map<number, ProductInfo>;
  /** productId -> today's offers (data/public/prices), for the gap and store counts. */
  offers: Map<number, readonly Offer[]>;
  events: { label: string; day: number; vs: number }[];
  /** Smallest price a mover may start from, per market, in that market's cents (a US$3 pack moving 50c is noise). */
  moverFloor?: number;
  movers?: number;
}

/** Pure: one edition from the committed series and today's offers. */
export function buildEdition(inp: BuildInput): Edition {
  const floor = inp.moverFloor ?? 2000;
  const k = inp.movers ?? 8;
  const markets: MarketBlock[] = [];
  for (const m of MARKETS) {
    const pairs: [number, number][] = [];
    const movers: Mover[] = [];
    const byGame = new Map<string, { name: string; pairs: [number, number][]; gaps: number[][] }>();
    const byType = new Map<string, number[][]>();
    const gaps: number[][] = [];
    let inStockFrom = 0, gone = 0, tracked = 0;
    for (const [id, bySeries] of inp.lows) {
      const p = inp.info.get(id);
      const s = bySeries[m];
      if (!p || !s) continue;
      tracked++;
      const a = priceOn(s, inp.fromDay), b = priceOn(s, inp.toDay);
      const g = byGame.get(p.gameSlug) ?? { name: p.game, pairs: [], gaps: [] };
      byGame.set(p.gameSlug, g);
      if (a != null) {
        inStockFrom++;
        if (b == null) gone++;
      }
      const sp = storePrices(inp.offers.get(id) ?? [], m);
      if (a != null && b != null) {
        pairs.push([a, b]);
        g.pairs.push([a, b]);
        if (a >= floor && sp.length >= SPREAD_MIN_STORES) {
          movers.push({ id, name: p.name, game: p.game, set: p.set, slug: p.slug, from: a, to: b, pct: r1(((b - a) / a) * 100), stores: sp.length });
        }
      }
      if (sp.length >= SPREAD_MIN_STORES) {
        gaps.push(sp);
        g.gaps.push(sp);
        const t = byType.get(p.type) ?? [];
        t.push(sp);
        byType.set(p.type, t);
      }
    }
    if (!tracked) continue;
    const games = [...byGame.entries()]
      .map(([slug, g]) => ({ slug, name: g.name, change: matchedChange(g.pairs), gap: gapOf(g.gaps) }))
      .filter((g) => g.change || g.gap)
      .sort((x, y) => (y.change?.n ?? 0) - (x.change?.n ?? 0) || x.name.localeCompare(y.name));
    const types = [...byType.entries()]
      .map(([type, rows]) => ({ type, gap: gapOf(rows) }))
      .filter((t): t is { type: string; gap: Gap } => t.gap != null)
      .sort((x, y) => y.gap.n - x.gap.n);
    const real = movers.filter((x) => Math.abs(x.pct) >= 5);
    markets.push({
      market: m,
      currency: CURRENCY[m],
      tracked,
      change: matchedChange(pairs),
      soldOut: inStockFrom >= SPREAD_MIN ? { n: gone, pct: r1((gone / inStockFrom) * 100) } : null,
      gap: gapOf(gaps),
      games,
      types,
      falls: real.filter((x) => x.pct < 0).sort((x, y) => x.pct - y.pct).slice(0, k),
      rises: real.filter((x) => x.pct > 0).sort((x, y) => y.pct - x.pct).slice(0, k),
    });
  }
  const events: EventBlock[] = inp.events.map((e) => ({
    label: e.label,
    day: inp.dayToDate(e.day),
    vs: inp.dayToDate(e.vs),
    markets: MARKETS.flatMap((m) => {
      const pairs: [number, number][] = [];
      for (const s of inp.lows.values()) {
        const a = priceOn(s[m], e.vs), b = priceOn(s[m], e.day);
        if (a != null && b != null) pairs.push([a, b]);
      }
      const change = matchedChange(pairs);
      return change ? [{ market: m, change }] : [];
    }),
  }));
  return { v: 1, id: inp.id, title: inp.title, published: inp.published, from: inp.dayToDate(inp.fromDay), to: inp.dayToDate(inp.toDay), gapDate: inp.gapDate, markets, events, notes: [], corrections: [] };
}

/** "+1.2%" / "−3.4%" / "0.0%". */
export const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
