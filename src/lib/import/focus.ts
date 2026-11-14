// The sealed focus (SITE.catalogFocus): which sealed products keep a page. Owner, 2026-11-14: "only the more popular
// ones that people are actually buying and there's demand for", never a dead old set's packs.
//
// No click log exists for a new site, so demand is read from what the market itself shows today:
//
// - TCGplayer has a MARKET price for it (it has sold there) of at least `minCents`, and
// - it is recent: its set is not out yet or came out within `headlineMaxAgeMonths` (a headline type: booster box,
//   case, trainer box, bundle, tin, collection, deck) or `otherMaxAgeMonths` (loose packs and everything else), OR
// - stores still stock it: `minStores` of our sister sites' stores in one market have it in stock today, whatever its
//   age (an old box shops keep on the shelf is one people still buy).
//
// A set that is not out yet has no sales, so its headline products stay when a store lists them or TCGplayer shows a
// market price. Inserts and accessories never; a single card TCGplayer filed among the sealed (it carries a rarity)
// never; any page Search Console shows people finding always (the demand branch).
//
// Hysteresis: a product the last import kept stays while it still has a market price and is inside its age window
// plus `GRACE_MONTHS`, so a page does not flap between a 301 and a 200 on the day it crosses a line.
import type { FocusConfig, Offer, Product, SetInfo, TcgPrice } from "@/lib/site-types";

export type FocusRule = FocusConfig;

const NOT_STORES = new Set(["tcgplayer", "ebay", "amazon"]);
const DAY = 86_400_000;
const MONTH = 30.44 * DAY;
export const GRACE_MONTHS = 2;

/** The most distinct stores in any one market, counting only in-stock offers or every listing. */
export function storesInOneMarket(offers: readonly Offer[], inStockOnly: boolean): number {
  const per = new Map<string, Set<string>>();
  for (const o of offers) {
    if (NOT_STORES.has(o.source) || (inStockOnly && !o.inStock)) continue;
    if (!per.has(o.market)) per.set(o.market, new Set());
    per.get(o.market)!.add(o.source);
  }
  return Math.max(0, ...[...per.values()].map((s) => s.size));
}

/** TCGplayer's market price in US cents: the Normal printing's, else the lowest. Null when it has never sold. */
export function marketCents(t: Record<string, TcgPrice> | undefined): number | null {
  if (!t) return null;
  if (t.Normal?.market != null) return t.Normal.market;
  const vals = Object.values(t).map((p) => p.market).filter((v): v is number => v != null);
  return vals.length ? Math.min(...vals) : null;
}

export function focusCatalog(args: {
  products: Product[];
  sets: SetInfo[];
  offers: ReadonlyMap<number, readonly Offer[]>;
  tcg: Readonly<Record<number, Record<string, TcgPrice>>>;
  rule: FocusRule;
  now: Date;
  /** Slugs with Search Console demand (lib/import/demand.ts). */
  demand?: ReadonlySet<string>;
  /** Ids the last focused import kept; empty on the first run. */
  previous?: ReadonlySet<number>;
}): Product[] {
  const { products, sets, offers, tcg, rule, now, demand = new Set(), previous = new Set() } = args;
  const headline = new Set(rule.headlineTypes);
  const setById = new Map(sets.map((s) => [s.id, s]));
  const ageMonths = (s: SetInfo | undefined): number | null =>
    s?.releasedOn ? (now.getTime() - new Date(s.releasedOn).getTime()) / MONTH : null;
  return products.filter((p) => {
    if (p.kind !== "sealed") return false;
    if (demand.has(p.slug)) return true;
    if (p.sealedType === "Insert" || p.rarity) return false;
    const set = setById.get(p.setId);
    const o = offers.get(p.id) ?? [];
    const isHeadline = headline.has(p.sealedType ?? "");
    const market = marketCents(tcg[p.id]);
    const inStock = storesInOneMarket(o, true);
    // Not out yet: nothing has sold. A headline product a store lists, or TCGplayer already prices.
    if (set?.upcoming) return isHeadline && (storesInOneMarket(o, false) >= 1 || market != null);
    // Stores still stock it, whatever its age.
    if (inStock >= rule.minStores) return true;
    if (market == null || market < rule.minCents) return false;
    const age = ageMonths(set);
    if (age == null) return false;
    const limit = isHeadline ? rule.headlineMaxAgeMonths : rule.otherMaxAgeMonths;
    return age <= limit || (previous.has(p.id) && age <= limit + GRACE_MONTHS);
  });
}
