import test from "node:test";
import assert from "node:assert/strict";
import { rankForSitemap, sitemapProductCap, SITEMAP_START, SITEMAP_STEP, SITEMAP_MAX, SITEMAP_START_DAY } from "../src/lib/indexing";

test("the sitemap cap starts at SITEMAP_START, grows weekly and stops at SITEMAP_MAX", () => {
  const day = 86_400_000;
  assert.equal(sitemapProductCap(SITEMAP_START_DAY * day), SITEMAP_START);
  assert.equal(sitemapProductCap((SITEMAP_START_DAY + 6) * day), SITEMAP_START);
  assert.equal(sitemapProductCap((SITEMAP_START_DAY + 7) * day), SITEMAP_START + SITEMAP_STEP);
  assert.equal(sitemapProductCap((SITEMAP_START_DAY + 700) * day), SITEMAP_MAX);
});

test("ranking puts the most stores first, then history, then slug, and cuts at the cap", () => {
  const sig = (storeOffers: number, historyPoints: number) => ({ storeOffers, historyPoints, anyPrice: true, fresh: true });
  const rows = [
    { p: { slug: "c" }, s: sig(2, 5) },
    { p: { slug: "a" }, s: sig(9, 0) },
    { p: { slug: "b" }, s: sig(2, 9) },
    { p: { slug: "d" }, s: sig(2, 5) },
  ];
  assert.deepEqual(rankForSitemap(rows, 3).map((x) => x.slug), ["a", "b", "c"]);
});
