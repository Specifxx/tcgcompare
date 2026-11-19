// The homepage's "most in demand" booster boxes across every game (owner, 2026-11-17: "feature the most popular and in demand
// booster boxes across all games"). This static site keeps no click or view counters (nothing private lives in data/), so demand
// is read from the four signals the daily import does record, each real and each in the committed data:
//   - stores: how many stores have it in stock today (more stores selling it = more people buying it), up to 8
//   - recency: how new the set is (a box out this month is the one being opened; pre-orders count as new), over 18 months
//   - market: TCGplayer's market price, log-scaled (a $300 box is a product with a market; a $20 one is not a headliner)
//   - momentum: TCGplayer's 7-day price change (rising is demand; a missing figure is neutral, never a boost)
// Games are mixed: every game's best box is placed before any game gets a second, and no game has more than two, so one
// big game cannot fill the shelf. Same input, same shelf: it moves only when the import's data does.
// Since 2026-11-18 (owner: "the most popular items should be on the homepage in that order") visitors' own demand multiplies
// the score: product page views and buy clicks from data/demand.json (counts only, nothing private).
import type { Product } from "@/lib/site-types";
import { products, refCents, setById, summaryOf, worthFeaturing } from "@/lib/data";
import { isPreorder, todayIso } from "@/lib/preorders";
import { CLICK_WEIGHT, MIN_SIGNAL, demandOf } from "@/lib/home-rank";
import { HOME_DEMAND, productFacts } from "@/lib/home-demand";

const visitsOf = (p: Product) => {
  const [views, clicks] = demandOf(productFacts(p), HOME_DEMAND);
  return views + clicks * CLICK_WEIGHT;
};

export interface Candidate {
  id: number;
  game: string;
  stores: number;
  /** Days since the set came out; 0 or negative for a pre-order. */
  ageDays: number;
  marketCents: number;
  change7d: number | null;
  /** Visitors' demand (owner, 2026-11-18; lib/home-rank.ts): product page views plus 20 per buy click, last 28 days and the last 7 again. */
  visits?: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** 0 to 100. Weights: stores 30, recency 40, market 20, momentum 10. */
export function demandScore(c: Candidate): number {
  const stores = (clamp(c.stores, 0, 8) / 8) * 30;
  const recency = clamp(1 - Math.max(0, c.ageDays) / 540, 0, 1) * 40;
  const market = clamp(Math.log10(Math.max(c.marketCents, 1) / 100 / 20) / Math.log10(15), 0, 1) * 20;
  const momentum = c.change7d == null ? 5 : ((clamp(c.change7d, -5, 10) + 5) / 15) * 10;
  return stores + recency + market + momentum;
}

/** The best `limit` candidates, every game's best before any game's second, at most `perGame` a game. */
export function mixAcrossGames(list: Candidate[], limit = 8, perGame = 2): Candidate[] {
  // What visitors did multiplies the import's signals (lib/home-rank.ts): nothing under MIN_SIGNAL across the list, so thin data changes nothing.
  const signal = list.reduce((n, c) => n + (c.visits ?? 0), 0);
  const scored = list.map((c) => ({ c, s: demandScore(c) * (signal >= MIN_SIGNAL ? 1 + Math.log1p(c.visits ?? 0) : 1) })).sort((a, b) => b.s - a.s || a.c.id - b.c.id);
  const out: Candidate[] = [];
  for (let round = 0; round < perGame && out.length < limit; round++) {
    const seen = new Set<string>();
    for (const { c } of scored) {
      if (out.length >= limit) break;
      const mine = out.filter((o) => o.game === c.game).length;
      if (mine !== round || seen.has(c.game) || out.includes(c)) continue;
      seen.add(c.game);
      out.push(c);
    }
  }
  return out;
}

/** A release's launch week: the day it comes out and the six after it (merch, 2026-11-19). */
export const LAUNCH_DAYS = 7;
/** At most this many launch-week boxes lead the shelf, one a game. */
export const LAUNCH_SLOTS = 3;

/**
 * Launch week leads the shelf (merch, 2026-11-19). A box out today has no page views yet, so the visitors' multiplier above ranks it
 * under any older box a few people opened (on 20 Nov The Dominance of God, Icons 2027 and Diva Fever would score 84-92 against
 * Homeworlds' 387 and miss the shelf on their release day). In its first LAUNCH_DAYS days a released box is ranked by the
 * import's own signals alone (stores, recency, market, momentum), the best of each game first, and up to LAUNCH_SLOTS lead.
 * A pre-order is not a launch (the pre-order tab has it). Same input, same shelf.
 */
export function pickLaunches(list: Candidate[], limit = LAUNCH_SLOTS): Candidate[] {
  const fresh = list
    .filter((c) => c.ageDays >= 0 && c.ageDays < LAUNCH_DAYS)
    .map((c) => ({ c, s: demandScore(c) }))
    .sort((a, b) => b.s - a.s || a.c.id - b.c.id);
  const out: Candidate[] = [];
  for (const { c } of fresh) {
    if (out.length >= limit) break;
    if (!out.some((o) => o.game === c.game)) out.push(c);
  }
  return out;
}

/** The launch-week boxes first, then the demand ranking without them; no game more than `perGame` times. */
export function withLaunches(list: Candidate[], limit = 8, perGame = 2): Candidate[] {
  const lead = pickLaunches(list);
  const taken = new Set(lead.map((c) => c.id));
  const out = [...lead];
  for (const c of mixAcrossGames(list.filter((x) => !taken.has(x.id)), limit + lead.length, perGame)) {
    if (out.length >= limit) break;
    if (out.filter((o) => o.game === c.game).length < perGame) out.push(c);
  }
  return out;
}

const DAY = 86_400_000;

/** Booster boxes some store has in stock: launch week first, then ranked by demand and mixed across games. */
export function popularBoxes(limit = 8): Product[] {
  const now = Date.parse(`${todayIso()}T00:00:00Z`);
  const byId = new Map<number, Product>();
  const list: Candidate[] = [];
  for (const p of products()) {
    if (p.kind !== "sealed" || p.sealedType !== "Booster Box" || !p.image || !worthFeaturing(p.id)) continue;
    const set = setById(p.setId);
    const market = refCents(p.id);
    if (!set || !set.line || market == null) continue;
    const sm = summaryOf(p.id);
    if (sm.inStockSources < 1) continue;
    const out = set.releasedOn ? Date.parse(`${set.releasedOn}T00:00:00Z`) : NaN;
    if (Number.isNaN(out)) continue;
    // A pre-order is as new as it gets; one more than 60 days away is not demand yet.
    if (isPreorder(set) && out - now > 60 * DAY) continue;
    byId.set(p.id, p);
    list.push({ id: p.id, game: set.line, stores: sm.inStockSources, ageDays: Math.round((now - out) / DAY), marketCents: market, change7d: sm.change7d, visits: visitsOf(p) });
  }
  return withLaunches(list, limit).map((c) => byId.get(c.id)!);
}
