import { test } from "node:test";
import assert from "node:assert/strict";
import sitemap from "../src/app/sitemap";
import { SITEMAP_TYPES, indexXml, urlsOfType, urlsetXml } from "../src/lib/sitemap-split";

test("the per-kind sitemaps hold exactly the main sitemap's URLs, once each", () => {
  const all = sitemap().map((e) => e.url).sort();
  const split = SITEMAP_TYPES.flatMap((t) => urlsOfType(t).map((e) => e.url)).sort();
  assert.deepEqual(split, all);
});

test("the index lists only kinds that have URLs, and each urlset is well formed", () => {
  const idx = indexXml();
  for (const t of SITEMAP_TYPES) {
    const has = urlsOfType(t).length > 0;
    assert.equal(idx.includes(`/sitemaps/${t}.xml`), has);
    if (has) assert.match(urlsetXml(t), /^<\?xml[\s\S]*<urlset[\s\S]*<\/urlset>$/);
  }
});
