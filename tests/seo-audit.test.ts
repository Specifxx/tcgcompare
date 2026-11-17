// SEO audit (2026-11-03): descriptive alt text on every product photo, the brand on the homepage title,
// an ItemList of the homepage's products, ItemLists on set and sealed hubs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(p, "utf8");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

test("no page or component draws a photo with empty alt text (share images and the quick view aside)", () => {
  for (const f of walk("src").filter((f) => /\.(tsx|ts)$/.test(f) && !f.includes("opengraph-image") && !f.endsWith("QuickView.tsx"))) {
    assert.ok(!/<img[^>]*alt=""/.test(read(f)), f);
  }
});

test("the homepage title tries every candidate with the brand before any without", () => {
  const src = read("src/app/page.tsx");
  const ladder = src.match(/fitTitle\(\[([^\]]+)\]\)/)![1].split("`,").map((s) => s.includes("${brand}"));
  const firstBare = ladder.indexOf(false);
  assert.ok(firstBare > 0 && ladder.slice(firstBare).every((b) => !b), String(ladder));
});

test("homepage, set and sealed hubs list their products as an ItemList", () => {
  for (const f of ["src/app/page.tsx", "src/app/sets/[slug]/page.tsx", "src/app/sealed/[type]/page.tsx"]) assert.match(read(f), /"ItemList"/, f);
});

// Zero-data card pages are noindex,follow; priced or listed ones (and every card of an
// upcoming set) are indexed; JSON-LD prices carry a priceValidUntil of tomorrow.
test("card pages with no price and no listing are kept out of the index", async () => {
  const { cardIndexable, priceValidUntil } = await import("../src/lib/indexing");
  const card = { kind: "sealed" as const, sealedType: "Booster Box" };
  const sig = (storeOffers: number, historyPoints = 0, over: Partial<{ anyPrice: boolean; fresh: boolean }> = {}) => ({ storeOffers, historyPoints, anyPrice: storeOffers > 0, fresh: true, ...over });
  const live = { upcoming: false };
  assert.equal(cardIndexable(card, sig(0), live), false);
  assert.equal(cardIndexable(card, sig(1), live), false); // one store and no track record is thin
  assert.equal(cardIndexable(card, sig(1, 3), live), false);
  assert.equal(cardIndexable(card, sig(1, 4), live), true); // one store plus four history days in 30
  assert.equal(cardIndexable(card, sig(2), live), true);
  assert.equal(cardIndexable(card, sig(5, 9, { fresh: false }), live), false); // data older than 14 days
  assert.equal(cardIndexable(card, sig(0, 0, { anyPrice: true }), { upcoming: true }), true);
  assert.equal(cardIndexable(card, sig(0), { upcoming: true }), false);
  assert.equal(cardIndexable({ kind: "sealed", sealedType: "Insert" }, sig(3), live), false);
  const { isFresh } = await import("../src/lib/indexing");
  const now = Date.UTC(2026, 10, 17);
  assert.equal(isFresh("2026-11-04T00:00:00Z", now), true);
  assert.equal(isFresh("2026-11-02T00:00:00Z", now), false);
  assert.equal(isFresh(undefined, now), false);
  assert.equal(priceValidUntil(Date.UTC(2026, 10, 4, 12)), "2026-11-05");
  const src = read("src/app/card/[slug]/page.tsx");
  assert.match(src, /cardIndexable\(/);
  assert.match(src, /priceValidUntil: priceValidUntil\(\)/);
  // A Product with no offers is a Search Console error (Gundam, 20 pages, 2026-11-04):
  // the block is rendered only when an in-stock US offer backs it.
  assert.match(src, /\{usOffers\.length > 0 && \(\s*<JsonLd/);
  assert.doesNotMatch(src, /offers: usOffers\.length\s*\?/);
});
