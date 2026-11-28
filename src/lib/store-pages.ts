// A page per store we compare (/stores/<key>), and the "Find us on TCG Prices" link a store can put on its own site
// (owner, 2026-11-28: "really increase our authority for TCG Prices"; no outside site linked to tcgprices.app). Every
// number is today's data: the products the store has in stock, by game, and how many of them it sells for the lowest
// in-stock price among the stores of its own market (never TCGplayer, eBay or Amazon, never a pre-order, its own
// currency only). It is said as a fact on the store's page, never as a badge on a price row: price tables still mark no
// row the cheapest (CLAUDE.md, eBay section).
import { SITE } from "@/site.config";
import { priceOf, products, setById } from "@/lib/data";
import { lineOfSet } from "@/lib/lines";
import type { Offer, Product } from "@/lib/site-types";

const NOT_A_STORE = new Set(["tcgplayer", "ebay", "amazon"]);
/** A store page asks to be indexed only with this many products in stock: below it the page has little of its own to say. */
export const STORE_INDEX_MIN = 100;

export interface StoreStats {
  key: string;
  inStock: number;
  /** Products it sells for the lowest in-stock price of its market today. */
  lowest: number;
  /** [game name, products in stock], most first. */
  games: [string, number][];
  /** The products it is lowest on, most valuable first (at most 12): id and its price there. */
  lowestPicks: { p: Product; cents: number; currency: string }[];
}

const usable = (o: Offer) => !NOT_A_STORE.has(o.source) && o.inStock && !o.preorder && o.cents > 0;

/** One pass over today's offers; pure apart from the data it is given, so tests can feed it. */
export function storeStatsFrom(rows: { p: Product; game: string | null; offers: Offer[]; value: number }[], currencyOf: (key: string) => string | null): Map<string, StoreStats> {
  const out = new Map<string, StoreStats & { gameMap: Map<string, number>; picks: { p: Product; cents: number; currency: string; value: number }[] }>();
  const get = (key: string) => {
    let s = out.get(key);
    if (!s) out.set(key, (s = { key, inStock: 0, lowest: 0, games: [], lowestPicks: [], gameMap: new Map(), picks: [] }));
    return s;
  };
  for (const { p, game, offers, value } of rows) {
    const mine = new Map<string, Offer>();
    for (const o of offers) {
      if (!usable(o) || o.currency !== currencyOf(o.source)) continue;
      const cur = mine.get(o.source);
      if (!cur || o.cents < cur.cents) mine.set(o.source, o);
    }
    const byMarket = new Map<string, Offer[]>();
    for (const o of mine.values()) {
      const s = get(o.source);
      s.inStock += 1;
      if (game) s.gameMap.set(game, (s.gameMap.get(game) ?? 0) + 1);
      byMarket.set(o.market, [...(byMarket.get(o.market) ?? []), o]);
    }
    for (const list of byMarket.values()) {
      if (list.length < 2) continue; // "lowest" needs another store to be lower than
      const low = Math.min(...list.map((o) => o.cents));
      const winners = list.filter((o) => o.cents === low);
      if (winners.length !== 1) continue; // a tie is nobody's lowest
      const s = get(winners[0].source);
      s.lowest += 1;
      s.picks.push({ p, cents: low, currency: winners[0].currency, value });
    }
  }
  const done = new Map<string, StoreStats>();
  for (const [k, s] of out) {
    done.set(k, {
      key: k,
      inStock: s.inStock,
      lowest: s.lowest,
      games: [...s.gameMap.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
      lowestPicks: s.picks.sort((a, b) => b.value - a.value).slice(0, 12).map(({ p, cents, currency }) => ({ p, cents, currency })),
    });
  }
  return done;
}

const CURRENCY: Record<string, string> = { US: "USD", CA: "CAD", UK: "GBP", AU: "AUD", EU: "EUR", SG: "SGD" };
let memo: Map<string, StoreStats> | null = null;
export function storeStats(): Map<string, StoreStats> {
  if (memo) return memo;
  const market = new Map(SITE.stores.map((s) => [s.key, s.market as string]));
  const rows = products()
    .filter((p) => p.kind === "sealed" && p.sealedType !== "Insert")
    .map((p) => {
      const set = setById(p.setId);
      const e = priceOf(p.id);
      const ref = Object.values(e.tcg)[0]?.market ?? 0;
      return { p, game: set ? lineOfSet(set)?.short ?? null : null, offers: e.offers, value: ref };
    });
  memo = storeStatsFrom(rows, (key) => CURRENCY[market.get(key) ?? ""] ?? null);
  return memo;
}

export const storeByKey = (key: string) => SITE.stores.find((s) => s.key === key) ?? null;
export const storePath = (key: string) => `/stores/${key}`;
export const storeIndexable = (s: StoreStats | undefined) => !!s && s.inStock >= STORE_INDEX_MIN;

/** The link a store can paste on its own site: plain HTML, one link to its page here. */
export function findUsSnippet(key: string, origin: string): string {
  return `<a href="${origin}${storePath(key)}">Find us on ${SITE.name}</a>`;
}
