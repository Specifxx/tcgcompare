// The owner's UX review (2026-11-23, DECISIONS.md): the pure parts, and the source rules that keep it in place.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editDistance, expandWords, suggestQuery, allowedEdits } from "../src/lib/search-fuzzy";
import { isTypingTarget } from "../src/lib/visitor-busy";
import { storeCheckedMap } from "../src/lib/store-checked";
import { RETURN_NUDGE_ON } from "../src/lib/return-nudge";
import type { Meta } from "../src/lib/site-types";

const src = (p: string) => readFileSync(p, "utf8");

test("typo search: one edit for 4-6 letters, two for 7+, none for codes; a swap counts once", () => {
  assert.equal(editDistance("charizrd", "charizard", 2), 1);
  assert.equal(editDistance("pikahcu", "pikachu", 2), 1, "a swap of neighbours is one edit");
  assert.equal(allowedEdits("op13"), 0);
  assert.equal(allowedEdits("box"), 0);
  assert.equal(allowedEdits("boxx"), 1);
  const vocab = new Map([["charizard", 15], ["character", 3], ["elite", 40], ["trainer", 40], ["box", 900]]);
  const known = (w: string) => [...vocab.keys()].some((t) => t.startsWith(w));
  assert.equal(suggestQuery(["charizrd"], vocab, known), "charizard");
  assert.equal(suggestQuery(["charizrd", "box"], vocab, known), "charizard box");
  assert.equal(suggestQuery(["charizard"], vocab, known), null, "nothing to correct");
  assert.equal(suggestQuery(["zzzzzzzz"], vocab, known), null, "no close word: no guess");
  assert.deepEqual(expandWords(["charizard", "etb"]), ["charizard", "elite", "trainer", "box"]);
  assert.deepEqual(expandWords(["upc"]), ["ultra", "premium", "collection"]);
  assert.deepEqual(expandWords(["bb"]), ["booster", "box"]);
});

test("the search API tries the words, then shorthand, then the nearest words, then popular products, never a dead end", () => {
  const api = src("src/app/api/search/route.ts");
  assert.match(api, /expandWords\(want\)/);
  assert.match(api, /suggestQuery\(expanded/);
  assert.match(api, /popular/);
  assert.match(src("src/components/SearchResults.tsx"), /Showing \{hits\.length\}/);
  assert.match(src("src/components/SearchResults.tsx"), /track\("search_none"/);
});

test("nothing opens while a visitor types: every self-opening prompt asks visitorBusy, and the floating ad card is off", () => {
  assert.ok(isTypingTarget({ tagName: "INPUT", type: "search" }));
  assert.ok(isTypingTarget({ tagName: "TEXTAREA" }));
  assert.ok(!isTypingTarget({ tagName: "INPUT", type: "checkbox" }));
  assert.ok(!isTypingTarget({ tagName: "A" }));
  for (const f of ["src/components/account/SignInCorner.tsx", "src/components/site-reviews/RateCard.tsx", "src/components/ReturnNudge.tsx"])
    assert.match(src(f), /visitorBusy\(\)/, `${f} asks visitorBusy`);
  assert.equal(RETURN_NUDGE_ON, false, "the floating eBay/TCGplayer card covered the page (P0 1)");
});

test("each store row says when its price was read: the crawl's last read, else its sister site's data time", () => {
  const meta = {
    sisters: { dex: { ok: true, offers: 1, products: 1, at: "2026-11-23T21:00:00Z", stores: ["a"] } },
    crawl: { seen: { "b.com|US": "2026-11-23T22:00:00Z" } },
  } as unknown as Meta;
  const stores = [{ key: "a", base: "https://a.com", market: "US" }, { key: "b", base: "https://www.b.com", market: "US" }, { key: "c", base: "https://c.com", market: "US" }];
  assert.deepEqual(storeCheckedMap(meta, stores, ["a", "b", "c"]), { a: "2026-11-23T21:00:00Z", b: "2026-11-23T22:00:00Z" });
  assert.deepEqual(storeCheckedMap(null, stores, ["a"]), {});
});

test("the product page: stores first, the marketplaces in a labelled block below, jump links, history beside the price", () => {
  const page = src("src/app/card/[slug]/page.tsx");
  assert.match(page, /marketplacesBelow checked=\{checked\}/);
  assert.match(page, /<JumpLinks /);
  assert.ok(page.indexOf('id="history"') < page.indexOf('id="prices"'), "history sits in the first column, beside the prices");
  const table = src("src/components/PriceTable.tsx");
  assert.match(table, /data-marketplaces/);
  assert.match(table, /Marketplaces <span className="ad-pill/);
});

test("the cart reads as a Shortlist and says the site sells nothing", () => {
  assert.match(src("src/components/cart/CartAddButton.tsx"), /"\+ Save"/);
  assert.match(src("src/components/cart/CartDrawer.tsx"), /We sell nothing/);
});

test("prices are timed to the build gate: the freshness job starts the import when the gate opens and alerts on stale prices", () => {
  const f = src(".github/workflows/freshness.yml");
  assert.match(f, /scripts\/last-build\.sh/);
  assert.match(f, /gh workflow run refresh-prices\.yml/);
  assert.doesNotMatch(f, /git push|git commit/, "the freshness job never releases anything itself");
  const r = src(".github/workflows/refresh-prices.yml");
  assert.match(r, /needs: gate/);
});
