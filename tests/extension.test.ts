import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { cheapestStores } from "../src/lib/extension-feed";
import { manifestFor } from "../extension/scripts/build.mjs";
import type { Offer } from "../src/lib/site-types";

const o = (x: Partial<Offer>): Offer => ({ source: "s", market: "US", currency: "USD", cents: 1000, inStock: true, url: "", title: "", ...x });

// The Chrome buying assistant (DECISIONS.md 2026-11-21): its price is a store's own, never TCGplayer's, eBay's or
// Amazon's, never out of stock, never in another currency.
test("the extension's price is the cheapest in-stock store, per market, in that market's currency", () => {
  const p = cheapestStores([
    o({ source: "tcgplayer", cents: 500 }),
    o({ source: "ebay", cents: 400 }),
    o({ source: "amazon", cents: 450 }),
    o({ source: "a", cents: 900, inStock: false }),
    o({ source: "b", cents: 1200 }),
    o({ source: "c", cents: 1100 }),
    o({ source: "d", market: "AU", currency: "USD", cents: 300 }),
    o({ source: "e", market: "AU", currency: "AUD", cents: 2000 }),
  ]);
  assert.deepEqual(p, { US: 1100, AU: 2000 });
});

test("extension.json is a static file open to every origin", () => {
  const route = fs.readFileSync("src/app/extension.json/route.ts", "utf8");
  assert.match(route, /export const dynamic = "force-static";/);
  assert.match(route, /Access-Control-Allow-Origin/);
});

test("the extension asks for the narrowest permissions and never touches another site's links", () => {
  const site = JSON.parse(fs.readFileSync("extension/sites/tcgprices.json", "utf8"));
  const m = manifestFor(site);
  assert.deepEqual(m.permissions, ["storage", "contextMenus", "activeTab", "scripting"]);
  assert.deepEqual(m.host_permissions, ["https://tcgprices.app/*"]);
  assert.ok(site.matches.every((u: string) => /^https:\/\/(www\.)?tcgplayer\.com\/product\/\*$/.test(u)));
  assert.ok(site.description.length <= 132);
  // Chrome refuses a web_accessible_resources pattern with a path (it failed the store's install test, 2026-11-22).
  for (const w of m.web_accessible_resources) for (const u of w.matches) assert.match(u, /^https:\/\/[^/]+\/\*$/);
  const content = fs.readFileSync("extension/src/content.js", "utf8");
  // No affiliate injection: it never rewrites or reads the page's links, and never builds an eBay/Amazon/TCGplayer link.
  assert.doesNotMatch(content, /querySelectorAll\(["']a/);
  assert.doesNotMatch(content, /\.href\s*=/);
  assert.doesNotMatch(content, /campid|ascsubtag|partner\.tcgplayer|tag=/);
  // Its own buy buttons go through our /go route (affiliate tag added there, click counted), never straight out.
  assert.match(fs.readFileSync("extension/src/shared.js", "utf8"), /\$\{home\}\/go\?/);
  // No remote code (Chrome Web Store policy): no eval, no injected script tags.
  for (const f of fs.readdirSync("extension/src")) {
    const s = fs.readFileSync(`extension/src/${f}`, "utf8");
    assert.doesNotMatch(s, /\beval\(|new Function\(|createElement\(["']script/, f);
  }
});

// The popup's page matcher (extension/src/match.js): a page is named as a product only when its words decide it.
test("the extension recognises store pages by their words, and refuses a guess", async () => {
  const { makeMatcher } = createRequire(import.meta.url)("../extension/src/match.js");
  const item = (n: string, g: string, k: string, t: string, e?: string) => ({ n, u: "/card/x", g, s: 3, m: 1000, p: { US: 900 }, k, t, ...(e ? { e } : {}) });
  const feed = {
    lines: { rb: { name: "Riftbound" }, pkm: { name: "Pokémon" } },
    items: {
      "1": item("Vendetta - Booster Display", "rb", "Booster Box", "Vendetta"),
      "2": item("Vendetta - Booster Display Case", "rb", "Case", "Vendetta"),
      "3": item("Vendetta - Booster Pack", "rb", "Booster Pack", "Vendetta"),
      "4": item("Perfect Order Booster Box", "pkm", "Booster Box", "ME03: Perfect Order", "0820650412345"),
      "5": item("Mega Evolution Booster Box", "pkm", "Booster Box", "ME01: Mega Evolution"),
      "6": item("Perfect Order Elite Trainer Box", "pkm", "Elite Trainer Box", "ME03: Perfect Order"),
      // The series' name is on many products, as it is in the real file: it tells less than the set's own name.
      "7": item("Mega Evolution Booster Pack", "pkm", "Booster Pack", "ME01: Mega Evolution"),
      "8": item("Mega Evolution Elite Trainer Box", "pkm", "Elite Trainer Box", "ME01: Mega Evolution"),
      "9": item("Mega Evolution Booster Bundle", "pkm", "Bundle", "ME01: Mega Evolution"),
    },
  };
  const m = makeMatcher(feed);
  assert.equal(m("Riftbound League of Legends TCG - Vendetta Booster Box – Good Games", "AU").sure, "1");
  assert.equal(m("Vendetta - Riftbound - Booster Case (6 Booster boxes) – Alt F4", "AU").sure, "2");
  assert.equal(m("Riftbound Vendetta Booster Pack NEW SEALED | eBay", "US").sure, "3");
  assert.equal(m("Amazon.com: Mega Evolution Perfect Order Booster Box (36 Packs) | Pokemon TCG : Toys & Games", "US").sure, "4");
  assert.equal(m("Pokémon TCG: Perfect Order Elite Trainer Box – Some Shop", "US").sure, "6");
  assert.equal(m("Some page", "US", ["820650412345"]).sure, "4", "a barcode on the page decides it");
  // Not decided: no kind given, a single card, another language.
  assert.equal(m("Riftbound Vendetta – Good Games", "AU").sure, null);
  const single = m("Charizard ex 223/197 Special Illustration Rare Perfect Order Pokemon NM | eBay", "US");
  assert.equal(single.sure, null);
  assert.equal(single.single, true);
  assert.equal(m("Pokemon Perfect Order Booster Box Japanese – Shop", "US").sure, null);
});
