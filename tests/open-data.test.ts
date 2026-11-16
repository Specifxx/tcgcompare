import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { appendDay, cheapestStorePerMarket, changeOver, medianRatio, toCsv, type IndexFile, type OpenRow } from "../src/lib/open-data";
import { indexWidgetHtml } from "../src/lib/open-embed";
import type { Offer } from "../src/lib/site-types";

// Open price data (DECISIONS.md "Open price data", 2026-11-16): stores only, never another owner's price.
const o = (source: string, cents: number, extra: Partial<Offer> = {}): Offer => ({ source, market: "US", currency: "USD", cents, inStock: true, url: "u", title: "t", ...extra });

test("the dataset takes only in-stock, non-pre-order store prices: never TCGplayer, eBay or Amazon", () => {
  const best = cheapestStorePerMarket([o("tcgplayer", 100), o("ebay", 150), o("amazon", 200), o("shopa", 5000), o("shopb", 4500), o("shopc", 3000, { inStock: false }), o("shopd", 2000, { preorder: true })]);
  assert.deepEqual(best.US, { cents: 4500, stores: 2 });
});

test("a store charging in another currency than its market's is refused, never converted", () => {
  assert.equal(cheapestStorePerMarket([o("shop", 5000, { currency: "AUD" })]).US, undefined);
});

test("the CSV escapes, carries a date and no store key", () => {
  const row: OpenRow = { id: 1, game: "Pokémon", gameSlug: "pokemon", set: "Set, One", name: 'Box "X"', type: "Booster Box", market: "US", currency: "USD", cents: 12999, stores: 3, url: "https://x/card/b" };
  const csv = toCsv([row], "2026-11-16");
  assert.match(csv, /^tcgplayer_product_id,game,set,product,product_type,market,currency,cheapest_store_price,stores_in_stock,url,date\n/);
  assert.match(csv, /1,Pokémon,"Set, One","Box ""X""",Booster Box,US,USD,129.99,3,https:\/\/x\/card\/b,2026-11-16\n$/);
});

test("the index chains the median ratio over products priced on both days, and a new product does not move it", () => {
  const day1 = { g: { "1": 10000, "2": 20000, "3": 5000, "4": 8000, "5": 9000, "6": 7000, "7": 6000, "8": 12000 } };
  const f1 = appendDay(null, "2026-11-16", null, day1);
  assert.equal(f1.days[0].all.level, 100);
  const day2 = { g: { "1": 11000, "2": 22000, "3": 5500, "4": 8800, "5": 9900, "6": 7700, "7": 6600, "8": 13200, "9": 1 } };
  const f2 = appendDay(f1, "2026-11-17", day1, day2);
  assert.equal(f2.days[1].games.g.level, 110);
  assert.equal(f2.days[1].all.level, 110);
  assert.equal(f2.days[1].games.g.n, 9);
});

test("a thin overlap keeps the level and a re-run of the same day replaces it", () => {
  assert.equal(medianRatio({ "1": 100 }, { "1": 200 }), null);
  const base = { g: { "1": 100 } };
  const f1 = appendDay(null, "2026-11-16", null, base);
  const f2 = appendDay(f1, "2026-11-17", base, { g: { "1": 200 } });
  assert.equal(f2.days[1].games.g.level, 100);
  const f3 = appendDay(f2, "2026-11-17", base, { g: { "1": 200 } });
  assert.equal(f3.days.length, 2);
});

test("the 7-day change reads the day on or before a week back, and is null on a short file", () => {
  const pt = (level: number) => ({ n: 20, median: 1, level });
  const days = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ d: `2026-11-${String(10 + i).padStart(2, "0")}`, all: pt(100 + i), games: {} }));
  assert.equal(changeOver(days, (d) => d.all, 7), 7);
  assert.equal(changeOver(days.slice(-1), (d) => d.all, 7), null);
  assert.equal(changeOver(days.slice(-3), (d) => d.all, 7), null);
});

test("the widget credits the data page and is noindex", () => {
  const html = indexWidgetHtml({ site: "TCG Prices", siteUrl: "https://tcgprices.app", title: "All games sealed price index", level: 101.2, week: -1.5, n: 40, median: 5000, date: "2026-11-16" });
  assert.match(html, /href="https:\/\/tcgprices.app\/data\?utm_source=embed/);
  assert.match(html, /name="robots" content="noindex"/);
  assert.match(html, /CC BY 4.0/);
});

test("the open data routes are static files open to every origin, and no page or route reads another owner's price", () => {
  for (const f of ["src/app/data/sealed-prices.csv/route.ts", "src/app/data/price-index.json/route.ts", "src/app/embed/price-index/[game]/route.ts"]) {
    const src = fs.readFileSync(f, "utf8");
    assert.match(src, /export const dynamic = "force-static";/, f);
    assert.match(src, /Access-Control-Allow-Origin/, f);
  }
  const lib = fs.readFileSync("src/lib/open-data.ts", "utf8");
  assert.doesNotMatch(lib, /refCents|\.tcg\b|ebay\.|amazon-live/, "the dataset never reads a reference, eBay or Amazon price");
});

test("the daily job runs before the data commit and never fails the release", () => {
  const wf = fs.readFileSync(".github/workflows/refresh-prices.yml", "utf8");
  const a = wf.indexOf("scripts/open-index.ts"), b = wf.indexOf("Commit data");
  assert.ok(a > 0 && a < b);
  assert.match(wf.slice(wf.lastIndexOf("- name:", a), a), /continue-on-error: true/);
});
