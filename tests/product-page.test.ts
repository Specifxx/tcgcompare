import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ebayQueryFor, jsonLdOffers, usCheapestQuoted } from "../src/lib/product-page";
import type { Offer } from "../src/lib/site-types";

const o = (source: string, market: Offer["market"], currency: string, cents: number, inStock = true): Offer => ({ source, market, currency, cents, inStock, url: "", title: "" });

test("the Product JSON-LD never counts eBay or Amazon, nor an out-of-stock or foreign price", () => {
  const offers = [o("ebay", "US", "USD", 800), o("amazon", "US", "USD", 900), o("shop", "US", "USD", 1200), o("tcgplayer", "US", "USD", 1100), o("shop2", "US", "USD", 500, false), o("au", "AU", "AUD", 300), o("ebay", "US", "USD", 9000)];
  assert.deepEqual(jsonLdOffers(offers).map((x) => x.source), ["shop", "tcgplayer"]);
  assert.deepEqual(jsonLdOffers([o("ebay", "US", "USD", 800)]), []);
});

test("the cheapest sentence is the US market's cheapest in-stock store or TCGplayer price, never eBay", () => {
  // Sorted by raw cents across currencies, as the stored offers are: a GBP row first, an eBay row next.
  const offers = [o("ebay", "US", "USD", 4000), o("uk", "UK", "GBP", 5995), o("au", "AU", "AUD", 10095), o("tcgplayer", "US", "USD", 7000), o("us", "US", "USD", 6500), o("cheap", "US", "USD", 100, false)];
  assert.equal(usCheapestQuoted(offers)?.source, "us");
  assert.equal(usCheapestQuoted([o("tcgplayer", "US", "USD", 7000), o("ebay", "US", "USD", 10)])?.source, "tcgplayer");
  assert.equal(usCheapestQuoted([o("ebay", "US", "USD", 10), o("uk", "UK", "GBP", 100), o("amazon", "US", "USD", 50)]), null);
});

test("the eBay query keeps the game's words unless the name says the whole phrase as words", () => {
  assert.equal(ebayQueryFor("Spark of Rebellion Two-Player Starter Case", "Star Wars Unlimited"), "Star Wars Unlimited Spark of Rebellion Two-Player Starter Case");
  assert.equal(ebayQueryFor("Ancient Alphas Booster Box", "Alpha Clash"), "Alpha Clash Ancient Alphas Booster Box");
  assert.equal(ebayQueryFor("Pokemon Card 151 Booster Box", "Pokemon Japanese"), "Pokemon Japanese Pokemon Card 151 Booster Box");
  assert.equal(ebayQueryFor("Star Wars Unlimited: Twilight Booster Box", "star wars unlimited"), "Star Wars Unlimited: Twilight Booster Box");
  assert.equal(ebayQueryFor("Box (C++ Edition)", "C++"), "Box (C++ Edition)");
  assert.equal(ebayQueryFor("Booster Box", ""), "Booster Box");
});

test("the product page uses those helpers", () => {
  const src = readFileSync("src/app/card/[slug]/page.tsx", "utf8");
  assert.match(src, /const usOffers = jsonLdOffers\(e\.offers\)/);
  // "Is it worth it?" is lib/buyer-read.ts (2026-11-23): stores only, US dollars against TCGplayer, never an eBay price.
  assert.match(src, /ebayPrices: false/);
  assert.match(src, /ebayQueryFor\(name, ebayQueryOf\(set\)\)/);
  assert.doesNotMatch(src, /inStock\[0\]/);
  assert.doesNotMatch(src, /split\(" "\)\[0\]/);
});
