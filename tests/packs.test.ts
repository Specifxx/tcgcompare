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

test("a printing tag pairs a box with the same printing's pack only (TCGplayer's Yu-Gi-Oh! names)", () => {
  const set = [
    P(1, "Glorious Victors Booster Box [1st Edition]", "Booster Box"),
    P(2, "Glorious Victors Booster Pack [1st Edition]", "Booster Pack"),
    P(3, "Glorious Victors Booster Pack [Unlimited Edition]", "Booster Pack"),
    P(4, "Glorious Victors Booster Box [Unlimited Edition]", "Booster Box"),
  ];
  assert.equal(packOfBox(set[0], set)?.id, 2);
  assert.equal(packOfBox(set[3], set)?.id, 3);
  // A tagged box never pairs with an untagged pack, nor the other way round.
  assert.equal(packOfBox(set[0], [set[0], P(5, "Glorious Victors Booster Pack", "Booster Pack")]), null);
  assert.equal(packOfBox(P(6, "Glorious Victors Booster Box", "Booster Box"), [set[1]]), null);
  // "[2nd Print]", "[Second Edition]" are printings; "[Cell]" is not, and pairs with nothing.
  assert.equal(packOfBox(P(7, "Advent of Genesis Booster Box [2nd Print]", "Booster Box"), [P(8, "Advent of Genesis Booster Pack [2nd Print]", "Booster Pack")])?.id, 8);
  assert.equal(packOfBox(P(9, "Cross Force Booster Box", "Booster Box"), [P(10, "Cross Force Booster Pack [Cell]", "Booster Pack")]), null);
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
