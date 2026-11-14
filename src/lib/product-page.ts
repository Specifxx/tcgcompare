// Pure helpers for the product page (src/app/card/[slug]/page.tsx), kept here so the tests can pin them.
import type { Offer } from "./site-types";

/** Rows that are paid or our own pinned links, never a price we claim in markup: eBay, and Amazon's live price. */
const neverClaimed = (o: Offer) => o.source === "ebay" || o.source === "amazon";

/**
 * The offers behind the Product JSON-LD's AggregateOffer: in stock, in US dollars, never eBay or Amazon
 * (no structured data carries an eBay price, 2026-11-14). Empty means no Product markup at all.
 */
export function jsonLdOffers(offers: Offer[]): Offer[] {
  return offers.filter((o) => o.inStock && o.currency === "USD" && !neverClaimed(o));
}

/**
 * The price the "Is it worth it?" sentence names: the US market's cheapest in-stock store or TCGplayer price, in
 * US dollars, never eBay or Amazon. Offers come sorted by raw cents across currencies, so the first in-stock row
 * can be a dearer foreign price; this picks within one market. Null leaves the sentence out.
 */
export function usCheapestQuoted(offers: Offer[]): Offer | null {
  let best: Offer | null = null;
  for (const o of offers) {
    if (!o.inStock || o.market !== "US" || o.currency !== "USD" || neverClaimed(o) || !(o.cents > 0)) continue;
    if (!best || o.cents < best.cents) best = o;
  }
  return best;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The eBay search for a product: the game's own words lead it unless the name already holds the whole phrase as
 * words ("Starter" does not say "Star Wars Unlimited", and "Pokemon Card 151" does not say "Pokemon Japanese").
 */
export function ebayQueryFor(name: string, gameWords: string): string {
  const words = gameWords.trim();
  if (!words) return name;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(words)}($|[^\\p{L}\\p{N}])`, "iu").test(name) ? name : `${words} ${name}`.trim();
}
