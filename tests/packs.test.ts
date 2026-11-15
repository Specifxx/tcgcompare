import test from "node:test";
import assert from "node:assert/strict";
import { packOfBox } from "../src/lib/packs";
import { carryCrawl } from "../src/lib/import/crawl";

const P = (id: number, name: string, sealedType: string, setId = 1) => ({ id, name, sealedType, setId });

test("a booster box pairs with its own set's single pack, never another edition's or a promo pack", () => {
  const set = [
    P(1, "Homeworlds - Booster Display", "Booster Box"),
    P(2, "Homeworlds - Booster Pack", "Booster Pack"),
    P(3, "Homeworlds Carbonite Edition - Booster Display", "Booster Box"),
    P(4, "Homeworlds Carbonite Edition - Booster Pack", "Booster Pack"),
    P(5, "Galactic Championship 2026 Promo Pack: Black", "Booster Pack"),
    P(6, "Homeworlds - Booster Case", "Case"),
  ];
  assert.equal(packOfBox(set[0], set)?.id, 2);
  assert.equal(packOfBox(set[2], set)?.id, 4);
  assert.equal(packOfBox(set[5], set), null);
  assert.equal(packOfBox(set[1], set), null);
  // Two packs with the same stem: no guess.
  assert.equal(packOfBox(set[0], [...set, P(7, "Homeworlds - Booster Pack", "Booster Pack")]), null);
});

test("own stores carry rows for every game, a sister-listed store's crawl only for the games no sister covers", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  const prevById = { "100": { offers: [{ source: "old", market: "US", currency: "USD", cents: 1, inStock: true, url: "u", title: "t" }] }, "200": { offers: [{ source: "old", market: "US", currency: "USD", cents: 1, inStock: true, url: "u", title: "t" }] } } as never;
  const mk = (ident: string) => ({
    stores: [{ base: "https://cards.test", market: "US" as const }],
    readOk: new Set<string>(),
    seen: { [ident]: "2026-11-15T00:00:00Z" },
    keyOf: new Map([[ident, "cards"]]),
    prevKeyOf: new Map([[ident, "old"]]),
    prevById,
    // 100 is a Pokémon product (a sister's game), 200 a Star Wars one.
    crawledProduct: (id: number, i: string) => (id === 200 ? true : i === "cards.test|US" && own),
    now,
    maxAgeH: 72,
  });
  let own = true;
  assert.equal(carryCrawl(mk("cards.test|US")).carried, 2);
  own = false;
  assert.equal(carryCrawl(mk("cards.test|US")).carried, 1);
});
