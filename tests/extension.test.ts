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
  assert.deepEqual(m.permissions, ["storage", "contextMenus", "activeTab", "scripting", "alarms"]);
  assert.deepEqual(m.host_permissions, ["https://tcgprices.app/*"]);
  // Every-site access and notifications are optional: asked only when the visitor turns those on (1.3.0).
  assert.deepEqual(m.optional_host_permissions, ["https://*/*"]);
  assert.deepEqual(m.optional_permissions, ["notifications"]);
  assert.equal(m.web_accessible_resources, undefined);
  assert.ok(site.matches.every((u: string) => /^https:\/\/(www\.)?tcgplayer\.com\/product\/\*$/.test(u)));
  assert.ok(site.description.length <= 132);
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
  // A singles store's own style, and a store bundle that names no set, are never a sealed product.
  assert.equal(m("Black Lotus (233) - 2ED", "UK").single, true);
  assert.equal(m("Order a Booster Box & Folder - Save £10", "UK").sure, null);
  // eBay, 23 Nov 2026: a damaged box is not the product at its price.
  assert.equal(m("Pokémon TCG Perfect Order Elite Trainer Box ETB (Seal Damage)", "US").sure, null);
  assert.equal(m("Pokemon Perfect Order Elite Trainer Box Factory Sealed Unopened", "US").sure, "6");
});

// Real store titles from the 1.3.0 test on live shops (Collectors Kingdom UK, TCGKing NL), 23 Nov 2026.
test("the extension never names a set of two, a bonus pack or a special edition as the plain product", async () => {
  const { makeMatcher } = createRequire(import.meta.url)("../extension/src/match.js");
  const item = (n: string, g: string) => ({ n, u: "/card/x", g, s: 3, m: 1000, p: { US: 900 }, k: "Starter Deck", t: "" });
  const feed = {
    lines: { pkm: { name: "Pokémon" }, gun: { name: "Gundam Card Game" } },
    items: {
      "1": item("30th Celebration Battle Deck [Espeon ex]", "pkm"),
      "2": item("30th Celebration Battle Deck [Umbreon ex]", "pkm"),
      "3": item("30th Celebration Battle Deck: Umbreon ex/Espeon ex [Set of two]", "pkm"),
      "4": item("Starter Deck 04: SEED Strike", "gun"),
      "5": item("Starter Deck 04: SEED Strike - Gundam Assemble Starter Set", "gun"),
      "6": item("Starter Deck: SEED Strike Bonus Pack", "gun"),
    },
  };
  const m = makeMatcher(feed);
  // One deck, either one: not the set of two, and not decided between the two.
  assert.equal(m("Pokémon 30th Celebration Battle Deck", "UK").sure, null);
  assert.equal(m("Pokémon 30th Celebration Battle Deck Espeon ex", "UK").sure, "1");
  assert.equal(m("30th Celebration Battle Deck Umbreon ex / Espeon ex Set of 2", "US").sure, "3");
  // "ST04" is TCGplayer's "Starter Deck 04"; the bonus pack and the special edition are other products.
  assert.equal(m("Gundam ST04: SEED Strike Starter Deck [English]", "EU").sure, "4");
  assert.equal(m("Gundam ST04: SEED Strike Special Edition (ST04A) Starter Deck [English]", "EU").sure, null);
  assert.equal(m("Gundam Starter Deck SEED Strike Bonus Pack", "US").sure, "6");
});

// Good Games AU lists One Piece singles under the booster they came from (23 Nov 2026): never that booster.
test("a single card named after its booster is a single card", async () => {
  const { makeMatcher } = createRequire(import.meta.url)("../extension/src/match.js");
  const feed = {
    lines: { op: { name: "One Piece Card Game" } },
    items: { "1": { n: "Extra Booster: One Piece Heroines Edition Vol.2 - Booster Pack", u: "/card/x", g: "op", s: 3, m: 600, p: { AU: 1999 }, k: "Booster Pack", t: "" } },
  };
  const m = makeMatcher(feed);
  for (const t of [
    "Nami EB05-055 (Extra Booster: One Piece Heroines Edition Vol. 2)  - Alternate Art Foil",
    "Shirley EB05-013 (Extra Booster: One Piece Heroines Edition Vol. 2)",
    "DON!! Card Gold  (Extra Booster: One Piece Heroines Edition Vol. 2)  - Foil",
  ]) {
    const r = m(t, "AU");
    assert.equal(r.sure, null, t);
    assert.equal(r.single, true, t);
  }
  assert.equal(m("One Piece Card Game Extra Booster Heroines Edition Vol. 2 Booster Pack EB05", "AU").sure, "1");
});

// Common Lands US gives its Collector Booster Display the pack's UPC (23 Nov 2026): the words win over that barcode.
test("a barcode never turns a display into the pack inside it", async () => {
  const { makeMatcher } = createRequire(import.meta.url)("../extension/src/match.js");
  const item = (n: string, k: string, e: string) => ({ n, u: "/card/x", g: "mtg", s: 3, m: 1000, p: { US: 900 }, k, t: "Dominaria Remastered", e });
  const m = makeMatcher({
    lines: { mtg: { name: "Magic: The Gathering" } },
    items: { "1": item("Dominaria Remastered - Collector Booster Display", "Booster Box", "195166200699"), "2": item("Dominaria Remastered - Collector Booster Pack", "Booster Pack", "195166200682") },
  });
  assert.equal(m("Dominaria Remastered - Collector Booster Display", "US", ["195166200682"]).sure, "1");
  assert.equal(m("Dominaria Remastered - Collector Booster Pack", "US", ["195166200682"]).sure, "2");
});

test("page budget: the product page's extension card waits for the Cyber banner to end", () => {
  const src = fs.readFileSync("src/app/card/[slug]/page.tsx", "utf8");
  assert.match(src, /cyberBannerState\(Date\.now\(\)\) === "off" && <ExtensionCta/);
});

// 1.3.0: the page's own price against the cheapest store, and the next cheapest stores in the feed.
test("the extension says what you'd save only when the page's price is believable for the product", () => {
  const ctx: Record<string, unknown> = { CONFIG: { id: "t", brand: "#000", brandDark: "#000" }, Intl, URL, URLSearchParams };
  const vm = createRequire(import.meta.url)("node:vm");
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync("extension/src/shared.js", "utf8") + ";this.verdict=verdict;this.storesIn=storesIn;", ctx);
  const verdict = ctx.verdict as (p: number | null, c: number | null) => { kind: string; diff: number; pct: number } | null;
  assert.equal(JSON.stringify(verdict(21499, 19675)), JSON.stringify({ kind: "save", diff: 1824, pct: 8 }));
  assert.equal(verdict(15499, 15500)?.kind, "lowest");
  assert.equal(verdict(19900, 19675)?.kind, "same"); // 1% apart: not a saving worth claiming
  assert.equal(verdict(599, 19675), null); // a pack's price against a box: says nothing
  assert.equal(verdict(90000, 19675), null); // a case's price
  assert.equal(verdict(null, 19675), null);
  const storesIn = ctx.storesIn as (p: unknown, m: string) => { name: string; cents: number; url: string | null }[];
  const rows = storesIn({ it: { p: { US: 100 }, b: { US: ["a", "https://a/x"] }, r: { US: [["b", 110], ["c", 120]] } }, stores: { a: "A", b: "B" } }, "US");
  assert.equal(JSON.stringify(rows.map((r) => [r.name, r.cents, r.url])), JSON.stringify([["A", 100, "https://a/x"], ["B", 110, null], ["c", 120, null]]));
});

test("the feed lists the next cheapest stores, one row per store, never eBay, Amazon or TCGplayer", async () => {
  const { topStoreOffers } = await import("../src/lib/extension-feed");
  const t = topStoreOffers([
    o({ source: "a", cents: 1000, url: "https://a/1" }),
    o({ source: "a", cents: 900, url: "https://a/2" }),
    o({ source: "b", cents: 950, url: "https://b/1" }),
    o({ source: "ebay", cents: 100, url: "https://e/1" }),
    o({ source: "c", cents: 980, url: "https://c/1", inStock: false }),
    o({ source: "d", cents: 990, url: "https://d/1" }),
    o({ source: "e", cents: 999, url: "https://e/2" }),
  ]);
  assert.deepEqual(t.US!.map((x) => [x.source, x.cents]), [["a", 900], ["b", 950], ["d", 990]]);
});
