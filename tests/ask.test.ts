// "Ask our prices" (lib/ask.ts): rules, no model. A sentence becomes our own pages and a search, and never an invented answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { askPick, askSearchUrl, askSeeAll, parseAsk } from "../src/lib/ask";

const games = [
  { slug: "pokemon", short: "Pokémon", name: "Pokémon TCG" },
  { slug: "one-piece", short: "One Piece", name: "One Piece Card Game" },
  { slug: "dragon-ball-fusion-world", short: "Fusion World", name: "Dragon Ball Super Fusion World" },
];

test("filler comes out, the product words stay", () => {
  assert.equal(parseAsk("cheapest Surging Sparks booster box in the UK").words, "surging sparks booster box");
  assert.equal(parseAsk("what's the best price for a one piece booster box under $120?").words, "one piece booster box");
});

test("plain section asks route to our own pages", () => {
  assert.deepEqual(parseAsk("pre-orders out this month").routes[0], { href: "/preorders", label: "Pre-orders" });
  assert.equal(parseAsk("what is back in stock").routes[0].href, "/restocks");
  assert.equal(parseAsk("price drops today").routes[0].href, "/movers");
  assert.equal(parseAsk("any deals on tins").routes[0].href, "/tools/deal-finder");
});

test("a named game adds its hub, the longest name first", () => {
  assert.equal(parseAsk("dragon ball super fusion world boxes", games).routes[0].href, "/games/dragon-ball-fusion-world");
  assert.equal(parseAsk("one piece pre-orders", games).routes.map((r) => r.href).join(), "/preorders,/games/one-piece");
});

test("a pasted store link goes to the price checker and nothing is searched", () => {
  const a = parseAsk("https://shop.example.com/products/some-box");
  assert.equal(a.words, "");
  assert.equal(askSearchUrl(a), null);
  assert.ok(askSeeAll(a)!.href.startsWith("/tools/is-this-a-good-price#link="));
});

test("nothing to search for means no request, and a search is the cheap CDN-cached endpoint", () => {
  assert.equal(askSearchUrl(parseAsk("cheapest")), null);
  assert.equal(askSearchUrl(parseAsk("surging sparks"), 4), "/api/search?q=surging%20sparks&limit=4");
  assert.equal(askSearchUrl(parseAsk("cheapest surging sparks"), 4), "/api/search?q=surging%20sparks&limit=40");
  assert.equal(askSeeAll(parseAsk("cheapest")), null);
});

test("no model, no secret, no server import", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/lib/ask.ts", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/anthropic|openai|fetch\(|process\.env|from "\.\/(data|db)"/i.test(src));
});

test('"cheapest" keeps the lowest-priced matches, and a row with no price never leads', () => {
  const rows = [{ price: "$150.00" }, { price: "—" }, { price: "$89.99" }, { price: "$1,200" }, { price: "$95.50" }];
  assert.deepEqual(askPick(parseAsk("cheapest box"), rows, 2).map((r) => r.price), ["$89.99", "$95.50"]);
  assert.deepEqual(askPick(parseAsk("booster box"), rows, 2).map((r) => r.price), ["$150.00", "—"], "otherwise as ranked");
});
