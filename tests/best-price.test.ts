// The "Best price" row (owner, 2026-11-18): loud only when a row that pays us is the cheapest; a plain store gets a small neutral tag
// and a hint that names only the eBay / TCGplayer rows the list really has.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bestTreatment, isPaidRow } from "../src/lib/best-price";
import { priceRows } from "../src/lib/price-rows";
import type { Offer } from "../src/lib/site-types";

const o = (source: string, cents: number, url = `https://${source}.example/p`): Offer => ({ source, market: "US", currency: "USD", cents, inStock: true, url, title: "" });

test("a plain store that is cheapest gets the plain tag, with a hint only when an eBay or TCGplayer row exists", () => {
  const offers = [o("store1", 9000), o("ebay", 9500), o("tcgplayer", 9800)];
  const r = priceRows(offers, "US");
  assert.equal(r.cheapest?.source, "store1");
  const t = bestTreatment(r.cheapest, r.display);
  assert.equal(t.loud, false);
  assert.equal(t.hint, "Prices and stock change: also check eBay and TCGplayer");
  assert.equal(bestTreatment(r.cheapest, [o("store1", 1), o("ebay", 2)]).hint, "Prices and stock change: also check eBay");
  assert.equal(bestTreatment(r.cheapest, [o("store1", 1), o("tcgplayer", 2)]).hint, "Prices and stock change: also check TCGplayer");
  const none = bestTreatment(o("store1", 1), [o("store1", 1), o("store2", 2)]);
  assert.equal(none.loud, false);
  assert.equal(none.hint, null, "no eBay or TCGplayer row: the plain tag and nothing else");
});

test("an affiliate cheapest row keeps the full highlight and no hint", () => {
  for (const src of ["ebay", "tcgplayer", "amazon"]) {
    const t = bestTreatment(o(src, 1), [o(src, 1), o("ebay", 2)]);
    assert.deepEqual(t, { loud: true, hint: null }, src);
    assert.equal(isPaidRow(o(src, 1)), true);
  }
  assert.equal(isPaidRow(o("store1", 1)), false);
  assert.deepEqual(bestTreatment(null, []), { loud: true, hint: null });
});

test("the phone buy button and the quick-buy button are the plain one for a store that pays nothing", () => {
  const card = readFileSync("src/components/CardBuy.tsx", "utf8");
  assert.match(card, /isPaidRow\(o\) \? "btn-buy px-4 py-2" : "btn-soft px-4 py-2"/);
  const qb = readFileSync("src/components/SealedQuickBuy.tsx", "utf8");
  assert.match(qb, /isPaidRow\(o\) \? "btn-buy" : "btn-soft"/);
});
