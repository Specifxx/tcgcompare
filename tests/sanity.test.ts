import { test } from "node:test";
import assert from "node:assert/strict";
import { storePriceTrusted, ebayReferenceUsd, ebayTrusted, tcgplayerOfferCents, launchReferenceCents } from "@/lib/import/sanity";

test("a TCGplayer low under half the market shows the market price", () => {
  // Hyperia City booster box, 2026-10-27: low $1.00, market $150.67.
  assert.equal(tcgplayerOfferCents([100], 15067), 15067);
  assert.equal(tcgplayerOfferCents([13999], 15067), 13999);
  assert.equal(tcgplayerOfferCents([], 15067), 15067);
  assert.equal(tcgplayerOfferCents([500], null), 500);
  assert.equal(tcgplayerOfferCents([1], 15), 1);
  assert.equal(tcgplayerOfferCents([], null), null);
});

test("eBay rows need a reference and must sit within 0.25x-4x of it", () => {
  // Stardust Trails booster pack, 2026-10-27: no TCGplayer price, stores ~$5-12,
  // eBay rows at $74-$129 were booster boxes.
  const ref = ebayReferenceUsd(null, [12, 5.5, 6.65].map((d) => d * 100));
  assert.equal(ref, 550);
  assert.equal(ebayTrusted(8263, ref), false);
  assert.equal(ebayTrusted(700, ref), true);
  assert.equal(ebayTrusted(700, null), false);
  assert.equal(ebayReferenceUsd(15067, [100]), 15067);
});

test("a cheap product's store price far above it is another product (a pack at the box's price)", () => {
  assert.equal(storePriceTrusted(10999, 219, 0.5), false); // bescards pack at US$109.99 vs a US$2.19 pack
  assert.equal(storePriceTrusted(499, 219, 0.5), true); // a normal single-pack ask
  assert.equal(storePriceTrusted(1500, 219, 0.5), true);
  assert.equal(storePriceTrusted(50, 219, 0.5), true); // a cent-level low on a cheap product stays
  assert.equal(storePriceTrusted(10999, 3000, 0.5), true); // from US$3 the old band: 3.7x
  assert.equal(storePriceTrusted(13000, 3000, 0.5), false);
  assert.equal(storePriceTrusted(1000, 3000, 0.5), false);
  assert.equal(storePriceTrusted(99999, null, 0.5), true);
});

test("an upcoming product is judged against the stores' median when TCGplayer's pre-order market is above it", () => {
  // Riftbound Legacy Vault Bundle, 2026-11-20 data: TCGplayer market US$94.65; Rift Compare's in-stock shops in USD.
  const shops = [4999, 4587, 4396, 4396, 3145, 4190, 4543, 4543, 4333, 4657];
  const ref = launchReferenceCents(9465, shops);
  assert.equal(ref, 4469.5);
  // Against the market every shop but one fell under the 50% floor; against the median all ten stand.
  assert.equal(shops.filter((u) => storePriceTrusted(u, 9465, 0.5)).length, 1);
  assert.equal(shops.filter((u) => storePriceTrusted(u, ref, 0.5)).length, 10);
  // A box priced like a pack is still another product.
  assert.equal(storePriceTrusted(1500, ref, 0.5), false);
});

test("the launch reference never rises above TCGplayer's market and needs three stores", () => {
  assert.equal(launchReferenceCents(5000, [9000, 9500, 9900]), 5000);
  assert.equal(launchReferenceCents(9465, [3000, 3100]), 9465); // two cheap shops cannot move it
  assert.equal(launchReferenceCents(null, [3000, 3100, 3200]), null);
  assert.equal(launchReferenceCents(9465, [3000, 3100, 3200, 3300]), 3150);
});
