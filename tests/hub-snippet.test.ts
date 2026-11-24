import { test } from "node:test";
import assert from "node:assert/strict";
import { fitTitle, TITLE_MAX } from "@/lib/seo-title";
import { sealedIndexDescription, sealedIndexTitleLadder, gameHubDescription, gameHubTitleLadder, headlineItem, kindsPhrase, typeHubDescription, typeHubTitleLadder, usStoreLow, type HubItem } from "@/lib/hub-snippet";
import type { Offer } from "@/lib/site-types";

// Page scorecard 2026-11-23 (Job D): game hubs rank on page one and are not clicked; the snippet is now written from the data.
const o = (source: string, cents: number, extra: Partial<Offer> = {}): Offer => ({ source, market: "US", currency: "USD", cents, inStock: true, url: "", title: "", ...extra });
const item = (name: string, releasedOn: string, best: Offer[], extra: Partial<HubItem> = {}): HubItem => ({ name, sealedType: "Booster Box", releasedOn, upcoming: false, tcgCents: 9000, best, ...extra });
const names: Record<string, string> = { a: "Shop A ", b: "Shop B" };
const storeName = (x: Offer) => names[x.source] ?? x.source;
const today = "2026-11-24";

test("a US store price is a store's own in-stock US-dollar price, never TCGplayer, eBay, Amazon, a pre-order or another market", () => {
  assert.equal(usStoreLow([o("tcgplayer", 100), o("ebay", 200), o("amazon", 300), o("a", 400, { preorder: true }), o("a", 500, { market: "CA", currency: "CAD" }), o("a", 600, { inStock: false })]), null);
  assert.equal(usStoreLow([o("a", 900), o("b", 800)])?.source, "b");
});

test("the headline is the newest released product a US store has, never an upcoming one", () => {
  const items = [item("Old Box", "2025-01-01", [o("a", 8000)]), item("New Box", "2026-11-01", [o("b", 8500)]), item("Next Box", "2026-12-12", [o("a", 7000)]), item("Pre Box", "2026-11-20", [o("a", 7000)], { upcoming: true }), item("Empty Box", "2026-11-10", [])];
  assert.equal(headlineItem(items, today)?.item.name, "New Box");
  assert.equal(headlineItem([item("Empty", "2026-11-10", [o("tcgplayer", 1)])], today), null);
});

test("the title names only the kinds the game has, and fits", () => {
  assert.equal(kindsPhrase(["Booster Box", "Booster Pack", "Starter Deck", "Case"]), "Booster Boxes, Packs & Decks");
  assert.equal(kindsPhrase(["Case", "Booster Box"]), "Booster Boxes & Cases");
  assert.equal(kindsPhrase(["Collection"]), null);
  const t = fitTitle(gameHubTitleLadder("Yu-Gi-Oh!", "Yu-Gi-Oh!", ["Booster Box", "Booster Pack", "Structure Deck"])).absolute;
  assert.equal(t, "Yu-Gi-Oh! Prices: Booster Boxes, Packs & Decks | TCG Prices");
  const long = fitTitle(gameHubTitleLadder("Dragon Ball Super Card Game Fusion World", "Fusion World", ["Booster Box", "Booster Pack", "Starter Deck"])).absolute;
  assert.ok(long.length <= TITLE_MAX && long.startsWith("Fusion World Prices"), long);
  assert.equal(fitTitle(gameHubTitleLadder("Godzilla Card Game", "Godzilla TCG", ["Collection"])).absolute, "Godzilla Card Game Booster Box & Sealed Prices | TCG Prices");
});

test("the game hub description leads with one real US store price beside TCGplayer's market", () => {
  const d = gameHubDescription({ short: "Digimon", items: [item("Chivalrous XIII - Booster Box", "2026-11-01", [o("a", 8500)]), item("Chivalrous XIII - Booster Pack", "2026-11-01", [o("b", 499)], { sealedType: "Booster Pack" })], sets: 1, stores: 1350, today, storeName });
  assert.equal(d, "In stock in the US today: Chivalrous XIII - Booster Box from $85.00 at Shop A (TCGplayer market $90.00). Compare 2 Digimon sealed products from 1 set across 1,350 stores, TCGplayer and eBay, updated daily.");
  const none = gameHubDescription({ short: "Sorcery TCG", items: [item("Box", "2026-01-01", [])], sets: 1, stores: 1350, today, storeName });
  assert.equal(none, "Compare 1 Sorcery TCG sealed product from 1 set across 1,350 stores, TCGplayer and eBay, updated daily.");
  assert.ok(!/msrp|packs per|cheapest/i.test(d));
});

test("a type hub says how many it compares and the newest one in stock", () => {
  assert.equal(fitTitle(typeHubTitleLadder("Digimon Card Game", "Digimon", "Booster Pack", "Booster packs", 44)).absolute, "Digimon Card Game Booster Pack Prices: All 44 Compared");
  for (const [n, s] of [["Dragon Ball Super Card Game Fusion World", "Fusion World"], ["Magic: The Gathering", "MTG"]]) {
    const t = fitTitle(typeHubTitleLadder(n, s, "Illumineer's Trove", "Illumineer's Troves", 120)).absolute;
    assert.ok(t.length <= TITLE_MAX, t);
  }
  const d = typeHubDescription({ short: "Digimon", label: "Cases", items: [item("Timeless Bonds Booster Box Case", "2026-10-01", [o("a", 80000)], { sealedType: "Case", tcgCents: 74725 })], stores: 1350, today, storeName });
  assert.equal(d, "Newest in stock in the US: Timeless Bonds Booster Box Case from $800.00 at Shop A (TCGplayer market $747.25). Prices for all 1 Digimon cases across 1,350 stores, TCGplayer and eBay, newest set first.");
});

test("/sealed names its kinds and games, and leads with the newest box a US store has", () => {
  assert.equal(fitTitle(sealedIndexTitleLadder(31, ["Booster Box", "Case"])).absolute, "Booster Box, Case & Pre-order Prices: 31 Card Games");
  assert.equal(fitTitle(sealedIndexTitleLadder(31, ["Booster Box"])).absolute, "Booster Box & Pre-order Prices: 31 Card Games | TCG Prices");
  const d = sealedIndexDescription({ items: [item("Old Box", "2025-01-01", [o("a", 8000)]), item("New Box", "2026-11-01", [o("b", 8500)]), item("New Pack", "2026-11-20", [o("a", 499)], { sealedType: "Booster Pack" })], games: 31, stores: 1350, today, storeName });
  assert.equal(d, "Newest box in stock in the US: New Box from $85.00 at Shop B (TCGplayer market $90.00). Compare 3 sealed products from 31 card games across 1,350 stores and TCGplayer: booster boxes, cases, ETBs, decks and pre-orders.");
  assert.ok(d.length <= 230, String(d.length));
  assert.ok(!/msrp|ebay|cheapest/i.test(d));
});
