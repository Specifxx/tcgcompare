import { test } from "node:test";
import assert from "node:assert/strict";
import { findUsSnippet, storeIndexable, storeStatsFrom, STORE_INDEX_MIN } from "@/lib/store-pages";
import type { Offer, Product } from "@/lib/site-types";

// Store pages (DECISIONS.md 2026-11-28): counts from today's offers only; "lowest" is a store's own in-stock price below every
// other store of its market, never TCGplayer, eBay, Amazon, a pre-order, another currency or a tie.
const o = (source: string, cents: number, extra: Partial<Offer> = {}): Offer => ({ source, market: "US", currency: "USD", cents, inStock: true, url: "", title: "", ...extra });
const prod = (id: number) => ({ id, slug: `p${id}`, name: `P${id}`, kind: "sealed", sealedType: "Booster Box", setId: 1 }) as unknown as Product;
const cur = (k: string) => (k.startsWith("ca") ? "CAD" : "USD");

test("lowest counts a store's single lowest in-stock price in its market, and nothing else", () => {
  const m = storeStatsFrom(
    [
      { p: prod(1), game: "Digimon", value: 9000, offers: [o("a", 8000), o("b", 8500), o("tcgplayer", 100), o("ebay", 50), o("amazon", 60)] },
      { p: prod(2), game: "Digimon", value: 5000, offers: [o("a", 5000), o("b", 5000)] }, // tie: nobody
      { p: prod(3), game: "Gundam", value: 4000, offers: [o("b", 3000), o("a", 100, { preorder: true }), o("c", 10, { inStock: false })] }, // b alone in stock
      { p: prod(4), game: "Gundam", value: 7000, offers: [o("ca1", 1000, { market: "CA", currency: "CAD" }), o("ca2", 2000, { market: "CA", currency: "CAD" }), o("b", 6900)] },
      { p: prod(5), game: "Gundam", value: 1, offers: [o("a", 10, { currency: "CAD" }), o("b", 20)] }, // a in the wrong currency is not counted
    ],
    cur,
  );
  assert.equal(m.get("a")?.inStock, 2);
  assert.equal(m.get("a")?.lowest, 1);
  assert.deepEqual(m.get("a")?.lowestPicks.map((x) => x.p.id), [1]);
  assert.equal(m.get("b")?.inStock, 5);
  assert.equal(m.get("b")?.lowest, 0); // b is alone in stock on 3, on 4 among US stores and on 5 (a's CAD row refused)
  assert.deepEqual(m.get("b")?.games, [["Gundam", 3], ["Digimon", 2]]);
  assert.equal(m.get("ca1")?.lowest, 1);
  assert.equal(m.has("tcgplayer") || m.has("ebay") || m.has("amazon") || m.has("c"), false);
});

test("a store page asks to be indexed only with enough in stock, and the link names the site", () => {
  assert.equal(storeIndexable(undefined), false);
  assert.equal(storeIndexable({ key: "a", inStock: STORE_INDEX_MIN - 1, lowest: 0, games: [], lowestPicks: [] }), false);
  assert.equal(storeIndexable({ key: "a", inStock: STORE_INDEX_MIN, lowest: 0, games: [], lowestPicks: [] }), true);
  assert.equal(findUsSnippet("3dragons", "https://tcgprices.app"), '<a href="https://tcgprices.app/stores/3dragons">Find us on TCG Prices</a>');
});
