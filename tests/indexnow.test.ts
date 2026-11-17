import { test } from "node:test";
import assert from "node:assert/strict";
import { pick, MAX_URLS } from "../scripts/indexnow-submit";

test("IndexNow sends only never-sent URLs and 5%+ price moves", () => {
  const sent = { "u/a": 1000, "u/b": 1000, "u/c": null };
  const got = pick([
    { url: "u/a", cents: 1049 }, // 4.9%: not sent
    { url: "u/b", cents: 1050 }, // 5%: sent
    { url: "u/c", cents: null }, // sent before, no price: not again
    { url: "u/d", cents: 500 }, // new
  ], sent);
  assert.deepEqual(got.sort(), ["u/b", "u/d"]);
  assert.equal(pick([{ url: "u/a", cents: 1000 }], sent).length, 0);
});

test("IndexNow caps a run and sends the dearest first", () => {
  const c = Array.from({ length: MAX_URLS + 50 }, (_, i) => ({ url: `u/${i}`, cents: i + 1 }));
  const got = pick(c, {});
  assert.equal(got.length, MAX_URLS);
  assert.equal(got[0], `u/${MAX_URLS + 49}`);
});

import { restoreList } from "../scripts/gsc-weekly";
test("restore: only noindexed pages with 10+ impressions, only when impressions fell over 25%", () => {
  const pages = [{ slug: "a", impressions: 40 }, { slug: "b", impressions: 5 }, { slug: "c", impressions: 90 }];
  const no = new Set(["a", "b"]);
  assert.deepEqual(restoreList(1000, 700, pages, no), ["a"]);
  assert.deepEqual(restoreList(1000, 800, pages, no), []);
  assert.deepEqual(restoreList(null, 1, pages, no), []);
});
