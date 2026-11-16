// The collection's value history (owner, 2026-11-16: "build the collection tracker"; lib/vault.ts is the list).
//
// Backfilled from the site's own committed price history (data/history, TCGplayer market price in US cents, one point
// a day), so the chart has its real past on the first visit instead of starting the day someone adds an item. It is
// "what the items in the collection today would have been worth on each day", at the TCGplayer market price in US$:
// a different number from the headline total (cheapest in-stock store price in the visitor's market), and labelled so.
// Never converted, never eBay. Pure: no window, no storage.
import type { Series } from "./series";

export const HISTORY_MAX_ITEMS = 60;
/** Free window in days. A longer one is the Pro design (DECISIONS.md, 2026-11-16); nothing is gated while payments are off. */
export const HISTORY_FREE_DAYS = 60;

export interface HistoryHolding {
  id: string;
  qty: number;
  /** today's value of one unit, used only to pick the most valuable items when there are more than HISTORY_MAX_ITEMS */
  weight: number;
}

export interface HistoryResult {
  /** [day number since the epoch, total US cents], one point per day with a price move or the first day */
  points: [number, number][];
  /** items whose price is in the chart */
  used: number;
  /** items left out: no history yet, or beyond the cap */
  left: number;
}

/** The ids worth fetching: the most valuable first, capped. */
export function idsToFetch(holdings: HistoryHolding[]): string[] {
  return [...holdings]
    .sort((a, b) => b.weight * b.qty - a.weight * a.qty)
    .slice(0, HISTORY_MAX_ITEMS)
    .map((h) => h.id);
}

const priceOn = (s: Series, day: number): number | null => {
  let v: number | null = null;
  for (const [d, c] of s) {
    if (d > day) break;
    v = c;
  }
  return v;
};

/**
 * The collection's total per day. Items with no series are left out. The chart starts on the first day EVERY used item
 * has a price, so a product whose history begins later never makes the total jump up on the day it appears.
 */
export function collectionSeries(holdings: HistoryHolding[], series: Record<string, Series | undefined>, today: number, days = HISTORY_FREE_DAYS): HistoryResult {
  const fetched = new Set(idsToFetch(holdings));
  const used = holdings.filter((h) => fetched.has(h.id) && (series[h.id]?.length ?? 0) > 0 && h.qty > 0);
  const left = holdings.length - used.length;
  if (!used.length) return { points: [], used: 0, left };
  const start = Math.max(today - days, ...used.map((h) => series[h.id]![0][0]));
  const daysSet = new Set<number>([start]);
  for (const h of used) for (const [d] of series[h.id]!) if (d > start && d <= today) daysSet.add(d);
  const points: [number, number][] = [...daysSet]
    .sort((a, b) => a - b)
    .map((d) => [d, used.reduce((sum, h) => sum + h.qty * (priceOn(series[h.id]!, d) ?? 0), 0)]);
  return { points, used: used.length, left };
}
