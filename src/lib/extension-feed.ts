// The price file the Chrome buying assistant reads (extension/ in this repo; DECISIONS.md 2026-11-21, "A Chrome
// buying assistant"). Served as the static file /extension.json (src/app/extension.json/route.ts): built once per
// deploy from the same summary the list pages read, so no function runs for it and only a release changes it.
//
// Keyed by TCGplayer product id (this site's product ids ARE TCGplayer's), so the extension can recognise the
// product on a TCGplayer product page by its URL alone: an exact id, never a title. Per market it carries the
// cheapest in-stock STORE price (never eBay, never Amazon, never TCGplayer itself, never converted) and TCGplayer's
// own market price as the reference, so the panel can say "cheapest store $X · TCGplayer market $Y" truthfully.
import { SITE } from "@/site.config";
import { products, refCents, setById, summaryOf } from "./data";
import { SITE_URL } from "./site";
import { CURRENCY, MARKETS, type Market, type Offer } from "./site-types";

export const EXTENSION_FEED_PATH = "/extension.json";

export interface ExtensionItem {
  /** name */
  n: string;
  /** path of our product page */
  u: string;
  /** SITE.lines id of its game */
  g: string | null;
  /** stores with it in stock (every market) */
  s: number;
  /** TCGplayer market price, US cents (reference only) */
  m: number | null;
  /** cheapest in-stock store price per market, that market's own cents */
  p: Partial<Record<Market, number>>;
  /** the cheapest store per market: [store key, its listing URL] for the panel's "Buy at" button (through /go) */
  b?: Partial<Record<Market, [string, string]>>;
  /** 1 when the set is not out yet (every store price is a pre-order) */
  pre?: 1;
  /** TCGplayer's sealed type ("Booster Box", "Case", "Elite Trainer Box"…), for telling a box from its case */
  k?: string;
  /** the set's name and code ("Destined Rivals", "SV10"), which store titles often carry and our name may not */
  t?: string;
  c?: string;
  /** TCGplayer's barcode for it, when it has one: a store page that shows the same barcode is this product */
  e?: string;
}

export interface ExtensionFeed {
  v: 1;
  site: string;
  home: string;
  generatedAt: string;
  currency: Record<string, string>;
  /** game id to its name, and the sister site that covers it (search link only) */
  lines: Record<string, { name: string; ebay: string; sister?: { name: string; url: string; search: string } }>;
  /** store key to display name, for the "Buy at" button */
  stores: Record<string, string>;
  /** our TCG sites, for the popup's links (this site first) */
  sites: { name: string; url: string; game: string }[];
  items: Record<string, ExtensionItem>;
}

/** A sister site covering each game (SITE.sisterSites, matched by name). Only a search link: never a claimed price. */
const SISTER_OF_LINE: Record<string, string> = {
  pkm: "DexCompare",
  mtg: "MTG Compare",
  op: "OP Compare",
  ygo: "YGO Compare",
  rb: "Rift Compare",
  lor: "Lorcana Compare",
  gun: "Gundam Compare",
  cp: "Cyberpunk Compare",
};

/** Pure: the cheapest in-stock store offer per market (no TCGplayer, eBay or Amazon). */
export function cheapestStores(best: Offer[]): Partial<Record<Market, number>> {
  return Object.fromEntries(Object.entries(cheapestStoreOffers(best)).map(([m, o]) => [m, o.cents]));
}

export function cheapestStoreOffers(best: Offer[]): Partial<Record<Market, Offer>> {
  const out: Partial<Record<Market, Offer>> = {};
  for (const o of best) {
    if (!o.inStock || !(o.cents > 0)) continue;
    if (o.source === "tcgplayer" || o.source === "ebay" || o.source === "amazon") continue;
    if (o.currency !== CURRENCY[o.market]) continue;
    const cur = out[o.market];
    if (cur == null || o.cents < cur.cents) out[o.market] = o;
  }
  return out;
}

/** What the popup's page matcher reads besides the name (extension/src/match.js). */
function matchHints(p: { sealedType: string | null; upc?: string }, set: { name: string; code: string } | null | undefined): Pick<ExtensionItem, "k" | "t" | "c" | "e"> {
  const code = set?.code && /^[A-Za-z0-9.-]{2,10}$/.test(set.code) && /\d/.test(set.code) ? set.code : undefined;
  return { ...(p.sealedType ? { k: p.sealedType } : {}), ...(set?.name ? { t: set.name } : {}), ...(code ? { c: code } : {}), ...(p.upc ? { e: p.upc } : {}) };
}

export function buildExtensionFeed(now = new Date()): ExtensionFeed {
  const items: ExtensionFeed["items"] = {};
  const used = new Set<string>();
  for (const p of products()) {
    const sum = summaryOf(p.id);
    const cheapest = cheapestStoreOffers(sum.best);
    const prices = Object.fromEntries(Object.entries(cheapest).map(([m, o]) => [m, o.cents])) as Partial<Record<Market, number>>;
    const buy = Object.fromEntries(Object.entries(cheapest).filter(([, o]) => /^https:\/\//.test(o.url)).map(([m, o]) => { used.add(`s:${o.source}`); return [m, [o.source, o.url]]; }));
    const ref = refCents(p.id);
    if (!Object.keys(prices).length && ref == null) continue;
    const set = setById(p.setId);
    const g = set?.line ?? null;
    if (g) used.add(g);
    const upcoming = !!set?.releasedOn && set.releasedOn > now.toISOString().slice(0, 10);
    items[p.id] = { n: p.number ? `${p.name} ${p.number}` : p.name, u: `/card/${p.slug}`, g, s: sum.inStockSources, m: ref, p: prices, ...(Object.keys(buy).length ? { b: buy } : {}), ...(upcoming ? { pre: 1 as const } : {}), ...matchHints(p, set) };
  }
  const lines: ExtensionFeed["lines"] = {};
  for (const l of SITE.lines ?? []) {
    if (!used.has(l.id)) continue;
    const sis = SITE.sisterSites.find((s) => s.name === SISTER_OF_LINE[l.id]);
    lines[l.id] = { name: l.name, ebay: l.ebayQuery, ...(sis?.search ? { sister: { name: sis.name, url: sis.url, search: sis.search } } : {}) };
  }
  const stores = Object.fromEntries(SITE.stores.filter((s) => used.has(`s:${s.key}`)).map((s) => [s.key, s.name]));
  const sites = [{ name: SITE.name, url: SITE_URL, game: "Every game" }, ...SITE.sisterSites.filter((s) => s.search).map((s) => ({ name: s.name, url: s.url, game: s.game }))];
  return {
    v: 1,
    site: SITE.name,
    home: SITE_URL,
    generatedAt: now.toISOString(),
    currency: Object.fromEntries(MARKETS.map((m) => [m, CURRENCY[m]])),
    lines,
    stores,
    sites,
    items,
  };
}
