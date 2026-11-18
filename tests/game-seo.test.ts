import { test } from "node:test";
import assert from "node:assert/strict";
import { fitTitle, TITLE_MAX } from "@/lib/seo-title";
import { headlineWord, namesGame, productTitleLadder, seoSet, setPhrase, setTitleLadder } from "@/lib/game-seo";
import { lineById } from "@/lib/lines";
import { setFacts } from "@/lib/set-facts";
import type { Offer } from "@/lib/site-types";

// Cardmarket's playbook (DECISIONS.md 2026-11-18): every title names its game the way its players search it.
const op = { name: "The Dominance of God", code: "OP18", line: "op" };
const pkm = { name: "ME06: Delta Reign", code: "DLR", line: "pkm" };
const ua = { name: "UE27BT: Umamusume: Pretty Derby", code: "UE27BT", line: "ua" };
const lor = { name: "Into the Inkdark", code: "15", line: "lor" };
const mtg = { name: "Commander: Marvel: Darkhold Destiny", code: "MDC", line: "mtg" };
const ws = { name: "Tales of SERIES", code: "TAL/", line: "ws" };

test("a set title leads with its game, never the site's generic 'TCG'", () => {
  const t = fitTitle(setTitleLadder(op, ["Booster Box"])).absolute;
  assert.match(t, /^One Piece The Dominance of God \(OP18\) Booster Box/);
  assert.ok(t.length <= TITLE_MAX, t);
  for (const s of [op, pkm, ua, lor, mtg, ws]) {
    const x = fitTitle(setTitleLadder(s, ["Booster Box"])).absolute;
    assert.ok(!/^TCG /.test(x), x);
    assert.ok(x.length <= TITLE_MAX, x);
  }
});

test("a TCGplayer code prefix is dropped from the name; codes only where players type them", () => {
  assert.deepEqual(seoSet(pkm), { game: "Pokémon", name: "Delta Reign", code: null });
  assert.deepEqual(seoSet(ua), { game: "Union Arena", name: "Umamusume: Pretty Derby", code: "UE27BT" });
  assert.equal(seoSet(lor).code, null); // a lone number is no code
  assert.equal(seoSet(ws).code, null); // nor a slash code
  assert.equal(seoSet(mtg).name, "Commander: Marvel: Darkhold Destiny"); // "Commander:" has no digit: kept
  assert.equal(setPhrase(op), "One Piece The Dominance of God (OP18)");
});

test("Pokémon titles use ETB, the community's word, when the set has one", () => {
  assert.equal(headlineWord(["Booster Box", "Elite Trainer Box"], lineById("pkm")), "Booster Box & ETB");
  assert.equal(headlineWord(["Elite Trainer Box"], lineById("pkm")), "ETB");
  assert.equal(headlineWord(["Starter Deck"], lineById("cp")), "Starter Deck");
  assert.match(setTitleLadder(pkm, ["Booster Box", "Elite Trainer Box"])[0], /^Pokémon Delta Reign Booster Box & ETB Prices/);
});

test("a product title names the game once, and the code when players search it", () => {
  assert.equal(productTitleLadder("The Dominance of God Booster Box", op)[0], "One Piece The Dominance of God Booster Box (OP18) Price");
  // Lorcana's names already say "Disney Lorcana": no second game word.
  assert.equal(productTitleLadder("Disney Lorcana: Into the Inkdark Booster Box", lor)[0], "Disney Lorcana: Into the Inkdark Booster Box Price");
  assert.ok(namesGame("Pokemon Delta Reign ETB", lineById("pkm"))); // accents folded
  assert.ok(fitTitle(productTitleLadder("Delta Reign Booster Box", pkm)).absolute.startsWith("Pokémon Delta Reign Booster Box Price"));
});

const offer = (source: string, cents: number, market: Offer["market"] = "US"): Offer => ({ source, market, currency: "USD", cents, inStock: true, url: "", title: "" });

test("set facts say only what the data settles", () => {
  const facts = setFacts({
    phrase: "One Piece The Dominance of God (OP18)",
    releasedOn: "2026-11-21",
    upcoming: false,
    today: "2026-11-18",
    storeName: (o) => (o.source === "s1" ? "Shop One" : o.source),
    products: [
      { name: "The Dominance of God Booster Box", sealedType: "Booster Box", tcgCents: 10000, best: [offer("tcgplayer", 9000), offer("s1", 9200), offer("ebay", 5000)], inStockSources: 4 },
      { name: "The Dominance of God Booster Box Case", sealedType: "Case", tcgCents: 120000, best: [], inStockSources: 9 },
    ],
  });
  assert.equal(facts[0], "One Piece The Dominance of God (OP18) releases on November 21, 2026.");
  assert.match(facts[1], /^We compare 2 sealed products from it \(booster boxes and cases\)/);
  assert.equal(facts[2], "The cheapest The Dominance of God Booster Box in stock in the US is $92.00 at Shop One, 8% under TCGplayer's market price of $100.00.");
  assert.ok(!facts.join(" ").match(/packs per|print run|MSRP/i));
});

test("no headline box, no price sentence; no date, no date sentence", () => {
  const facts = setFacts({ phrase: "X", releasedOn: null, upcoming: false, today: "2026-11-18", storeName: () => "", products: [{ name: "X Deck", sealedType: "Starter Deck", tcgCents: 1000, best: [], inStockSources: 0 }] });
  assert.equal(facts.length, 1);
});

test("a set whose name already says its product type does not repeat it", () => {
  const t = setTitleLadder({ name: "Starter Deck 11: Timeline of Fate", code: "ST11", line: "cr" }, ["Starter Deck"]);
  assert.ok(t.every((x) => !/Starter Deck Starter Deck/.test(x)), t.join(" / "));
});
