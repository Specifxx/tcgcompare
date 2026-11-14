import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SITE } from "@/site.config";
import { LINES } from "@/lib/lines";
import { sealedSets } from "@/lib/hubs";
import { gameViews } from "@/lib/game-hubs";
import { CART_SITE } from "@/components/cart/cart-config";
import sitemap from "../src/app/sitemap";

// Page fixes of 2026-11-14 (the engine copy from YGO Compare and BandaiCompare left these behind).

test("Enter in the search box goes to a search page that exists, is one static copy and reads the query", () => {
  const box = fs.readFileSync("src/components/SearchBox.tsx", "utf8");
  const targets = [...box.matchAll(/router\.push\([^;]*?`\/([a-z-]+)\?q=/g)].map((m) => m[1]);
  assert.deepEqual(targets, ["search"], "the typed-words fallback");
  for (const t of targets) assert.ok(fs.existsSync(`src/app/${t}/page.tsx`), `/${t} has no page`);
  const page = fs.readFileSync("src/app/search/page.tsx", "utf8");
  assert.match(page, /export const dynamic = "force-static";/);
  assert.match(page, /robots: \{ index: false/);
  assert.doesNotMatch(page, /searchParams|cookies\(\)|headers\(\)/, "the page never reads the request");
  const results = fs.readFileSync("src/components/SearchResults.tsx", "utf8");
  assert.match(results, /useSearchParams\(\)/);
  assert.match(results, /\/api\/search\?q=\$\{encodeURIComponent\(q/);
  assert.ok(!sitemap().some((e) => new URL(e.url).pathname.startsWith("/search")), "a results page is never in the sitemap");
});

test("/sets shows only games with sets, and every game it links has a hub", () => {
  const listed = sealedSets();
  const withSets = LINES.filter((l) => listed.some((s) => s.line === l.id));
  const hubs = new Set(gameViews().map((v) => v.line.id));
  for (const l of withSets) assert.ok(hubs.has(l.id), `${l.slug} has sets but no /games page`);
  assert.match(fs.readFileSync("src/app/sets/page.tsx", "utf8"), /\.filter\(\(\{ list \}\) => list\.length > 0\)/);
});

test("the cart credits this site, not the site the engine was copied from", () => {
  assert.equal(CART_SITE, SITE.domain);
  assert.equal(CART_SITE, "tcgprices.app");
});

test("no user-facing source names YGO Compare or BandaiCompare as this site", () => {
  const files = (d: string): string[] =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(`${d}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${d}/${e.name}`] : []));
  for (const f of [...files("src/app"), ...files("src/components")]) {
    // Strip comments: the history notes may name where code came from.
    const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
    assert.doesNotMatch(src, /ygocompare|YGO Compare|BandaiCompare|bandaicompare/i, f);
  }
});
