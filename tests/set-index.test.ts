import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import sitemap from "../src/app/sitemap";
import { indexSignals, productsInSet, setById, setIndexable } from "../src/lib/data";
import { sealedSets } from "../src/lib/hubs";
import { cardIndexable, SISTER_RANKED_LINES } from "../src/lib/indexing";
import { holidayFaq } from "../src/lib/black-friday";

// Set pages follow their products (DECISIONS.md 2026-11-19): a set is indexed and in the sitemap only when one of its
// sealed products is; the rest stay live, noindex and followed.
test("a set page is indexable exactly when one of its products is", () => {
  for (const s of sealedSets()) {
    const any = productsInSet(s.id).some((p) => p.kind === "sealed" && cardIndexable(p, indexSignals(p), setById(s.id)));
    assert.equal(setIndexable(s.id), any, s.slug);
    if (s.line && SISTER_RANKED_LINES.has(s.line)) assert.equal(setIndexable(s.id), false, `${s.slug} is a sister-ranked game`);
  }
});

test("the sitemap lists only indexable sets, and the fresh data pages", () => {
  const paths = new Set(sitemap().map((e) => new URL(e.url).pathname));
  for (const s of sealedSets()) assert.equal(paths.has(`/sets/${s.slug}`), setIndexable(s.id), s.slug);
  for (const p of ["/hot-100", "/movers", "/restocks"]) assert.ok(paths.has(p), p);
  assert.match(fs.readFileSync("src/app/sets/[slug]/page.tsx", "utf8"), /setIndexable\(s\.id\) \? \{\} : \{ robots: \{ index: false, follow: true \} \}/);
});

test("the Black Friday page answers the TCGplayer question without claiming a sale", () => {
  const faq = holidayFaq("black-friday", 2026, { game: "TCG", stores: 10, regions: "the US" });
  const q = faq.find((f) => /TCGplayer/.test(f.q));
  assert.ok(q);
  assert.doesNotMatch(q!.a, /\d+% off|discount of/i);
  assert.ok(!holidayFaq("cyber-monday", 2026, { game: "TCG", stores: 10, regions: "the US" }).some((f) => /TCGplayer have/.test(f.q)));
});
