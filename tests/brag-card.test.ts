import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { bragLink, bragModel, type BragInput } from "../src/lib/brag-card";
import { bragGap, gapBragFields } from "../src/lib/share";
import type { Offer } from "../src/lib/site-types";

// Brag cards (DECISIONS.md 2026-11-26, community plan move 4).
const base: BragInput = {
  site: "TCG Prices",
  host: "www.tcgprices.app",
  accent: "#818cf8",
  kicker: "My sealed stash",
  title: "3 sealed items at today's US store prices",
  value: "$1,240.50",
  cta: "Track yours free",
  date: new Date("2026-11-26T12:00:00Z"),
};
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const o = (source: string, cents: number, extra: Partial<Offer> = {}): Offer => ({ source, market: "US", currency: "USD", cents, inStock: true, url: "", title: "", ...extra });

test("the model clips every line, keeps at most three rows and upper-cases the kicker", () => {
  const m = bragModel({ ...base, title: "x ".repeat(80), rows: Array.from({ length: 5 }, (_, n) => ({ label: `Row ${n}`, value: "$1" })) });
  assert.ok(m.title.length <= 64 && m.title.endsWith("…"));
  assert.equal(m.rows.length, 3);
  assert.equal(m.rows[0].tone, "neutral");
  assert.equal(m.kicker, "MY SEALED STASH");
  assert.equal(m.host, "tcgprices.app");
  assert.equal(m.day, "Nov 26, 2026");
  assert.equal(m.pill, null);
});

test("only a #rrggbb accent and a same-origin or https picture reach the canvas", () => {
  assert.equal(bragModel({ ...base, accent: "red; background:url(x)" }).accent, "#3b82f6");
  assert.equal(bragModel({ ...base, image: "data:text/html,x" }).image, null);
  assert.equal(bragModel({ ...base, image: "http://insecure.example/x.jpg" }).image, null);
  assert.equal(bragModel({ ...base, image: "/card-art/x.webp" }).image, "/card-art/x.webp");
  assert.equal(bragModel({ ...base, image: "https://tcgplayer-cdn.tcgplayer.com/product/1_400w.jpg" }).imageShape, "box");
  assert.equal(bragModel({ ...base, pill: { text: "", tone: "up" } }).pill, null);
});

test("the link back is our page, tagged as a brag card share", () => {
  assert.equal(bragLink("https://tcgprices.app", "/collection", "stash"), "https://tcgprices.app/collection?utm_source=share&utm_medium=brag-card&utm_campaign=stash");
  assert.equal(bragLink("https://tcgprices.app", "/card/x?a=1", "saved"), "https://tcgprices.app/card/x?a=1&utm_source=share&utm_medium=brag-card&utm_campaign=saved");
});

test("the found-it-cheaper card shows only the page's real store gap, never eBay, Amazon or TCGplayer as the cheapest", () => {
  const offers = [o("ebay", 100), o("amazon", 150), o("tcgplayer", 200), o("collectorscache", 25499), o("bigstore", 28899), o("x", 20000, { inStock: false })];
  const gap = bragGap(offers, "US")!;
  assert.equal(gap.low.source, "collectorscache");
  assert.equal(gap.sellers, 2);
  const vsRef = gapBragFields("Destined Rivals Booster Box", gap, "US", money, 27999);
  assert.equal(vsRef.value, "$254.99");
  assert.equal(vsRef.pill.text, "$25.00 under TCGplayer market (9% less)", "in the US the yardstick is TCGplayer's market price");
  assert.deepEqual(vsRef.rows.map((r) => r.label), ["Cheapest: collectorscache", "TCGplayer market", "Stores compared"]);
  const spread = gapBragFields("Destined Rivals Booster Box", gap, "US", money, 24000);
  assert.equal(spread.pill.text, "$34.00 less than the dearest store", "no saving against a market price the store is above");
  const uk = bragGap([o("a", 9000, { market: "UK", currency: "GBP" }), o("b", 9900, { market: "UK", currency: "GBP" })], "UK")!;
  assert.match(gapBragFields("X", uk, "UK", money, 50000).pill.text, /dearest store/, "the US market price is never set against pounds");
  for (const f of [vsRef, spread]) assert.doesNotMatch(JSON.stringify(f), /saved|bought/i, "it never claims the visitor bought");
  assert.equal(bragGap([o("ebay", 100), o("tcgplayer", 200), o("collectorscache", 25499)], "US"), null, "one store is no comparison");
});

test("the cards are drawn in the browser only, and every real share is counted", () => {
  const src = fs.readFileSync("src/lib/brag-card.ts", "utf8");
  assert.doesNotMatch(src, /fetch\(|next\/og|ImageResponse/);
  const view = fs.readFileSync("src/components/vault/VaultView.tsx", "utf8");
  assert.match(view, /trackShare\("brag_share"/);
  const btn = fs.readFileSync("src/components/ShareButton.tsx", "utf8");
  assert.match(btn, /track\("brag_share"/);
  assert.match(btn, /canShare/, "the product card is offered only where a picture can be shared");
});
