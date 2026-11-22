import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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
  assert.deepEqual(m.permissions, ["storage", "contextMenus", "activeTab"]);
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
