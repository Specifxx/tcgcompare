// Price sanity for the rows the import builds itself (TCGplayer and eBay).
// Store rows are checked as they match (scripts/import-all.ts, step 1); these
// two were trusted as they came, and showed a US$1.00 TCGplayer "low" on a
// US$150 booster box and a booster-box listing as a booster pack on eBay.

/** TCGplayer's "low" is its single cheapest listing, junk included. Under half
 *  the market price it is a mislisting or a damaged copy, not a price anyone
 *  can count on: show the market price instead. Below US$3 (the store rule's
 *  floor) a cent-level low is normal and stays. */
export function tcgplayerOfferCents(lows: number[], ref: number | null | undefined): number | null {
  const low = lows.length ? Math.min(...lows) : null;
  if (low == null) return ref ?? null;
  if (ref != null && ref >= 300 && low < ref * 0.5) return ref;
  return low;
}

/** The USD price an eBay row is judged against: TCGplayer's reference, or for a
 *  product TCGplayer doesn't price yet (a launch-week pack) the cheapest
 *  in-stock store price. Null means nothing to judge by. */
export function ebayReferenceUsd(ref: number | null | undefined, storeUsd: number[]): number | null {
  if (ref != null) return ref;
  return storeUsd.length ? Math.min(...storeUsd) : null;
}

/** An eBay row is shown only against a reference, and only within a quarter to
 *  four times it (the store rule): outside that it is another product. */
export function ebayTrusted(usd: number, reference: number | null): boolean {
  return reference != null && usd >= reference * 0.25 && usd <= reference * 4;
}

/** A cheap product (TCGplayer market under US$3) has no low or high band worth judging by ratio, but a store price far above
 *  it is still a different product: a pack priced at the box (US$109.99 against a US$2.19 pack, 2026-11-16 audit). Over
 *  five times the market and over this many cents is not a pack's price. */
export const CHEAP_HIGH_CENTS = 1500;

/** Is a store price (USD cents) a believable price for the product with this TCGplayer market (USD cents)? From US$3 up the band is
 *  the store rule (under OFFER_FLOOR of market or over four times it is another product); under US$3 only the high side applies. */
export function storePriceTrusted(usd: number, ref: number | null | undefined, floorShare: number): boolean {
  if (ref == null) return true;
  if (ref >= 300) return usd >= ref * floorShare && usd <= ref * 4;
  return usd <= Math.max(ref * 5, CHEAP_HIGH_CENTS);
}
