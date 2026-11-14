import { test } from "node:test";
const NEXT_CONFIG = "../next.config.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SITE } from "@/site.config";
import { products, sealedOnlyCatalog, setBySlug } from "@/lib/data";
import { retiredCardTarget } from "@/lib/card-redirects";
import { sealedSets } from "@/lib/hubs";
import { POSTS } from "@/content/blog";
import sitemap from "../src/app/sitemap";

// Sealed only (owner, 2026-11-06, DECISIONS.md): no single card is shown, every old card URL 301s, and the sitemap
// lists sealed pages only.
test("the site is sealed only and the catalogue it reads has no card", () => {
  assert.equal(SITE.sealedOnly, true);
  assert.ok(products().length > 0);
  assert.ok(products().every((p) => p.kind === "sealed"));
});

test("sealedOnlyCatalog drops cards and recounts each set from its sealed products", () => {
  const card = { id: 1, slug: "a-card-ab-001", name: "A Card", kind: "card" as const, setId: 7, number: "AB-001", rarity: "Rare", attrs: {}, sealedType: null, image: null, tcgUrl: "", printings: [] };
  const box = { ...card, id: 2, slug: "first-set-booster-box", name: "First Set Booster Box", kind: "sealed" as const, number: null, rarity: null, sealedType: "Booster Box" };
  const c = sealedOnlyCatalog({ generatedAt: "", sets: [{ id: 7, name: "First Set", code: "AB", slug: "first-set", releasedOn: null, productCount: 2, upcoming: false }], products: [card, box] }, true);
  assert.deepEqual(c.products.map((p) => p.id), [2]);
  assert.equal(c.sets[0].productCount, 1);
});

test("the card page redirects a retired card permanently and the redirect file ships with the functions", () => {
  const page = fs.readFileSync("src/app/card/[slug]/page.tsx", "utf8");
  assert.match(page, /permanentRedirect\(to\)/);
  assert.match(fs.readFileSync("next.config.js", "utf8"), /\.\/data\/redirects\/\*\.json/);
});

test("the sitemap lists no card, card hub or retired page", () => {
  const urls = sitemap().map((u) => new URL(u.url).pathname);
  assert.ok(urls.length > 100);
  const sealed = new Set(products().map((p) => `/card/${p.slug}`));
  for (const u of urls) {
    assert.ok(!u.startsWith("/cards"), u);
    assert.ok(!/^\/tools\/(rising|demand|best-basket|trade)$/.test(u), u);
    if (u.startsWith("/card/")) assert.ok(sealed.has(u), `${u} is not a sealed product`);
  }
  assert.ok(!urls.some((u) => products().some((p) => p.sealedType === "Insert" && u === `/card/${p.slug}`)), "no pack insert");
});

// Real catalogue rows, 2026-11-06: TCGplayer files oversized cards, tokens and single promo cards under "sealed".
test("a single card TCGplayer files as sealed is not a sealed product", () => {
  const box = { id: 2, slug: "x-booster-box", name: "X Booster Box", kind: "sealed" as const, setId: 7, number: null, rarity: null, attrs: {}, sealedType: "Booster Box", image: null, tcgUrl: "", printings: [] };
  const oversized = { ...box, id: 3, slug: "blue-eyes-oversized", name: "Blue-Eyes White Dragon (Oversized)", sealedType: null, attrs: { Attack: "3000" } };
  const promo = { ...box, id: 4, slug: "black-luster-soldier", name: "Black Luster Soldier", sealedType: null, rarity: "Secret Rare" };
  const c = sealedOnlyCatalog({ generatedAt: "", sets: [{ id: 7, name: "X", code: "X", slug: "x", releasedOn: null, productCount: 3, upcoming: false }], products: [box, oversized, promo] }, true);
  assert.deepEqual(c.products.map((p) => p.id), [2]);
  assert.ok(products().every((p) => !p.rarity));
});

