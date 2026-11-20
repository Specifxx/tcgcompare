import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildEdition, gapOf, matchedChange, priceOn, storePrices, SPREAD_MIN, type ProductInfo } from "../src/lib/spread";
import type { Offer } from "../src/lib/site-types";
import type { Series } from "../src/lib/series";

// The Spread (DECISIONS.md "The Spread", 2026-11-20): stores only, never converted, never estimated, frozen once written.
const o = (source: string, cents: number, extra: Partial<Offer> = {}): Offer => ({ source, market: "US", currency: "USD", cents, inStock: true, url: "u", title: "t", ...extra });

test("the gap reads stores only: never TCGplayer, eBay or Amazon, never out of stock, a pre-order or another currency", () => {
  const p = storePrices([o("tcgplayer", 100), o("ebay", 100), o("amazon", 100), o("a", 5000), o("a", 4800), o("b", 5500), o("c", 900, { inStock: false }), o("d", 800, { preorder: true }), o("e", 700, { currency: "CAD" }), o("f", 600, { market: "CA", currency: "CAD" })], "US");
  assert.deepEqual(p, [4800, 5500], "one price per store, its cheapest");
});

test("a product needs three stores for a gap, and a group needs SPREAD_MIN products or shows nothing", () => {
  const rows = Array.from({ length: SPREAD_MIN - 1 }, () => [100, 120, 200]);
  assert.equal(gapOf(rows), null);
  const g = gapOf([...rows, [100, 120, 200], [100, 200]]);
  assert.deepEqual(g, { n: SPREAD_MIN, toMedian: 20, toDearest: 100, stores: 3 });
});

test("a change counts only products priced on both days; a sold-out day (0) is no price", () => {
  const s: Series = [[10, 1000], [12, 0], [14, 900]];
  assert.equal(priceOn(s, 11), 1000);
  assert.equal(priceOn(s, 12), null);
  assert.equal(priceOn(s, 9), null);
  assert.equal(matchedChange(Array.from({ length: SPREAD_MIN - 1 }, () => [100, 90] as [number, number])), null);
  const c = matchedChange([...Array.from({ length: 6 }, () => [100, 90] as [number, number]), ...Array.from({ length: 4 }, () => [100, 100] as [number, number]), [100, 0]]);
  assert.deepEqual(c, { n: 10, median: -10, fell: 60, rose: 0, flat: 40 });
});

test("an edition never converts: each market is measured in its own currency", () => {
  const info = new Map<number, ProductInfo>();
  const lows = new Map<number, Record<string, Series>>();
  const offers = new Map<number, Offer[]>();
  for (let i = 1; i <= 12; i++) {
    info.set(i, { id: i, name: `P${i}`, slug: `p${i}`, type: "Booster Box", game: "G", gameSlug: "g", set: "S" });
    lows.set(i, { US: [[1, 10000], [5, 9000]], AU: [[1, 15000]] });
    offers.set(i, [o("a", 9000), o("b", 9900), o("c", 12000), o("x", 15000, { market: "AU", currency: "AUD" })]);
  }
  const e = buildEdition({ id: "2026-11", title: "T", published: "2026-12-02", gapDate: "2026-12-01", fromDay: 1, toDay: 5, dayToDate: String, lows, info, offers, events: [], moverFloor: 1 });
  const us = e.markets.find((m) => m.market === "US")!;
  assert.equal(us.currency, "USD");
  assert.equal(us.change?.median, -10);
  assert.equal(us.gap?.toMedian, 10);
  assert.equal(us.falls.length, 8);
  const au = e.markets.find((m) => m.market === "AU")!;
  assert.equal(au.currency, "AUD");
  assert.equal(au.gap, null, "one AU store is no spread");
  assert.deepEqual(e.notes, [], "notes are written by hand, never generated");
});

test("the pages read only the frozen edition files, never live prices, and the script never overwrites an edition", () => {
  for (const f of ["src/app/the-spread/page.tsx", "src/app/the-spread/[edition]/page.tsx"]) {
    const src = fs.readFileSync(f, "utf8");
    assert.doesNotMatch(src, /@\/lib\/data"|priceOf\(|store-lows|refCents/, f);
  }
  assert.match(fs.readFileSync("scripts/spread-edition.ts", "utf8"), /an edition is frozen once written/);
});
