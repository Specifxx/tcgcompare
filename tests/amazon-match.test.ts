// The Amazon matcher across 31 games (lib/import/amazon-match.ts, 2026-11-14). The wrong titles are the ones a run of
// the old one-game matcher over the real catalogue accepted; every product here is a real catalogue product (id, name,
// set, set code, game). A wrong match is worse than none, so most of these are refusals.
import assert from "node:assert/strict";
import { test } from "node:test";
import { amazonMatcher, gamesNamed, kindAgrees } from "@/lib/import/amazon-match";
import { splitSetCode } from "@/lib/import/match";
import { LINES } from "@/lib/lines";
import type { Product, SetInfo } from "@/lib/site-types";

const S = (id: number, name: string, code: string, line: string): SetInfo => ({ id, name, code, line, slug: String(id), releasedOn: "2026-01-01", productCount: 1, upcoming: false });
const P = (id: number, name: string, setId: number): Product => ({ id, slug: String(id), name, kind: "sealed", setId, number: null, rarity: null, attrs: {}, sealedType: null, image: null, tcgUrl: "", printings: [] });

const SETS = [
  S(22937, "The First Chapter", "1", "lor"),
  S(24511, "UE17BT: SOLO LEVELING", "UE17BT", "ua"),
  S(24624, "UE17BT: SOLO LEVELING Release Event Cards", "UE17BT_RE", "ua"),
  S(2924, "Classic Collection", "EX-01", "dg"),
  S(24618, "Starter Deck 23: Beatbreak", "ST-23", "dg"),
  S(24628, "Starter Deck 23: Beatbreak Release Event Cards", "ST-23_PR", "dg"),
  S(23599, "SV2a: Pokemon Card 151", "SV2a", "pkj"),
  S(23237, "SV: Scarlet & Violet 151", "MEW", "pkm"),
  S(24831, "ME06: Delta Reign", "DLR", "pkm"),
  S(24736, "The World's Strongest Warriors", "OP17", "op"),
  S(24637, "Adventure on Kami's Island", "OP15-EB04", "op"),
  S(24220, "Commander: FINAL FANTASY", "FIC", "mtg"),
  S(24808, "Magnificent Maestros", "MAMS", "ygo"),
  S(24900, "DZ-BT16: Parallactic Dawn", "DZ-BT16", "cfv"),
  S(24901, "Fusion World 07", "FB07", "fw"),
];
const PRODUCTS = [
  P(482406, "Disney Lorcana: The First Chapter Booster Pack", 22937),
  P(485256, "Disney Lorcana: The First Chapter Booster Box", 22937),
  P(660066, "SOLO LEVELING - Booster Pack (First Edition)", 24511),
  P(660067, "SOLO LEVELING - Booster Box (First Edition)", 24511),
  P(709842, "SOLO LEVELING - Booster Box (Second Edition)", 24511),
  P(679795, "SOLO LEVELING - Premium Release Event Pack", 24624),
  P(250006, "Classic Collection Booster Pack", 2924),
  P(250007, "Classic Collection Booster Box", 2924),
  P(680505, "Beatbreak Starter Deck", 24618),
  P(694371, "Welcome Tamers Pack Vol.2 (ST-23 & ST-24)", 24628),
  P(565242, "Pokemon Card 151 Booster Pack", 23599),
  P(565243, "Pokemon Card 151 Booster Box", 23599),
  P(502000, "Scarlet & Violet 151 Booster Bundle", 23237),
  P(502001, "Scarlet & Violet 151 Booster Pack", 23237),
  P(712094, "Delta Reign Booster Box", 24831),
  P(712099, "Delta Reign Booster Pack", 24831),
  P(712097, "Delta Reign Booster Bundle", 24831),
  P(704756, "The World's Strongest Warriors Booster Pack", 24736),
  P(704752, "The World's Strongest Warriors Booster Box", 24736),
  P(704757, "Double Pack Set Vol. 12", 24736),
  P(682056, "Adventure on Kami's Island Booster Pack", 24637),
  P(682789, "Double Pack Set Vol. 10", 24637),
  P(618907, "FINAL FANTASY Commander Deck Display", 24220),
  P(711214, "Magnificent Maestros Display", 24808),
  P(715297, "Magnificent Maestros Booster Pack", 24808),
  P(720001, "Parallactic Dawn Booster Box", 24900),
  P(720002, "Fusion World 07 Booster Box", 24901),
];
const am = amazonMatcher(PRODUCTS, SETS, LINES, "series", {});
const found = (title: string) => am.find(title)?.id ?? null;

test("a set's release-code prefix is read off its name, the code kept; a word before a colon that is a name stays", () => {
  assert.deepEqual(splitSetCode("ME06: Delta Reign"), { name: "Delta Reign", code: "ME06" });
  assert.deepEqual(splitSetCode("DZ-BT16: Parallactic Dawn"), { name: "Parallactic Dawn", code: "DZ-BT16" });
  assert.deepEqual(splitSetCode("SV: Scarlet & Violet 151"), { name: "Scarlet & Violet 151", code: "SV" });
  assert.deepEqual(splitSetCode("UE17BT: SOLO LEVELING"), { name: "SOLO LEVELING", code: "UE17BT" });
  for (const n of ["Commander: FINAL FANTASY", "Tarkir: Dragonstorm", "CookieRun: Braverse TCG Collectible Card Sets", "Godzilla: Reign of Kaiju", "Starter Deck 23: Beatbreak"])
    assert.deepEqual(splitSetCode(n), { name: n, code: "" }, n);
});

test("every game says how an Amazon title names it, and the games that share a word are kept apart", () => {
  for (const l of LINES) assert.ok(l.amazon?.any.length, `${l.id} has no Amazon words`);
  const one = (t: string) => gamesNamed(t, LINES).map((l) => l.id);
  assert.deepEqual(one("Pokémon TCG: Scarlet & Violet 151 Booster Bundle"), ["pkm"]);
  assert.deepEqual(one("Pokemon Card Game Japanese 151 Booster Box"), ["pkj"]);
  assert.deepEqual(one("Magic: The Gathering FINAL FANTASY Commander Deck Display"), ["mtg"]);
  assert.deepEqual(one("Dragon Ball Super Card Game Fusion World FB07 Booster Box"), ["fw"]);
  assert.deepEqual(one("Weiß Schwarz hololive production Premium Booster Box"), ["ws"]);
  assert.deepEqual(one("Yu-Gi-Oh! TCG Magnificent Maestros Display"), ["ygo"]);
  assert.deepEqual(one("Shadowverse Evolve Cardfight!! Vanguard Booster Box"), ["sve"]);
  assert.deepEqual(one("Booster Box (First Edition)"), [], "no game named");
});

test("another game's listing is never this product (the old matcher took all three)", () => {
  assert.equal(found("Union Arena SOLO LEVELING - Booster Box (First Edition)"), 660067, "Union Arena's own box, not Lorcana's First Chapter");
  assert.equal(found("Union Arena SOLO LEVELING - Booster Pack (First Edition)"), 660066);
  assert.equal(found("Union Arena GODDESS OF VICTORY: NIKKE - NIKKE Premium Pack: Limited First Edition"), null);
  assert.ok(!am.matches({ id: 485256 }, "Union Arena SOLO LEVELING - Booster Box (First Edition)"));
  assert.ok(!am.matches({ id: 482406 }, "Union Arena SOLO LEVELING - Booster Pack (First Edition)"));
  assert.equal(found("Pokémon 30th Celebration Classic Collection Pack"), null, "not Digimon's Classic Collection pack");
  assert.equal(found("Digimon Card Game Classic Collection Booster Pack"), 250006);
  assert.equal(found("Lorcana Digimon Classic Collection Booster Box"), null, "two games named");
  assert.equal(found("Classic Collection Booster Box"), null, "no game named");
});

test("English and Japanese Pokémon never cross, and Pokémon Japan is never searched", () => {
  assert.equal(found("Pokémon Scarlet & Violet 151 Booster Pack"), 502001, "the English pack, not the Japanese 151");
  assert.ok(!am.matches({ id: 565242 }, "Pokémon Scarlet & Violet 151 Booster Pack"));
  assert.equal(found("Pokemon Card Game Japanese 151 Booster Pack"), null, "a Japanese title is refused");
  assert.equal(found("Pokémon TCG 151 Booster Box Japanese"), null);
  assert.ok(!am.searchable(PRODUCTS.find((p) => p.id === 565243)!));
  assert.ok(am.searchable(PRODUCTS.find((p) => p.id === 502000)!));
  assert.ok(!am.searchable(P(1, "Duskmourn Play Booster Box (Japanese)", 24220)), "a foreign product name is never found");
});

test("a set whose name starts with its code matches a title that leaves the code out, or spells it", () => {
  assert.equal(found("Pokémon TCG: Mega Evolution—Delta Reign Booster Box (36 Packs)"), 712094);
  assert.equal(found("Pokemon ME06 Delta Reign Booster Bundle"), 712097);
  assert.equal(found("Pokemon Delta Reign Booster Pack"), 712099);
  assert.equal(found("Cardfight!! Vanguard DZ-BT16 Parallactic Dawn Booster Box"), 720001);
  assert.equal(found("Cardfight!! Vanguard Parallactic Dawn Booster Box English"), 720001);
});

test("a Double Pack Set, a release event pack or an empty box is not the product the store matcher reads", () => {
  assert.equal(found("One Piece Card Game The World's Strongest Warriors Double Pack Set Vol. 12"), 704757, "the Double Pack Set itself");
  assert.ok(!am.matches({ id: 704756 }, "One Piece Card Game The World's Strongest Warriors Double Pack Set Vol. 12"));
  assert.ok(!am.matches({ id: 682056 }, "One Piece Card Game Adventure on Kami's Island Double Pack Set Vol. 10"));
  assert.ok(!am.matches({ id: 680505 }, "Digimon Card Game Starter Deck 23: Beatbreak Release Event Cards Welcome Tamers Pack Vol.2 (ST-23 & ST-24)"));
  assert.equal(found("Digimon Card Game Beatbreak Starter Deck ST-23"), 680505);
  // "Starter Deck 23: " is Digimon's numbered set phrase (GameLine.numberedSets, 2026-11-28): the code can be left out.
  assert.equal(found("Digimon Card Game Beatbreak Starter Deck"), 680505);
  assert.equal(found("Digimon Card Game Starter Deck 24 Beatbreak"), null, "another deck's number");
  assert.equal(found("One Piece Card Game The World's Strongest Warriors Booster Box OP-17 EMPTY BOX"), null);
  assert.ok(!kindAgrees("Pokemon Delta Reign Booster Pack Sleeved", "Delta Reign Booster Pack"));
  assert.ok(kindAgrees("One Piece Double Pack Set Vol. 12", "Double Pack Set Vol. 12"));
});

test("right titles still match, one sample a major game", () => {
  assert.equal(found("Disney Lorcana TCG: The First Chapter Booster Box"), 485256);
  assert.equal(found("Disney Lorcana: The First Chapter Booster Pack"), 482406);
  assert.equal(found("ONE PIECE Card Game The World's Strongest Warriors [OP-17] Booster Box"), 704752);
  assert.equal(found("Magic: The Gathering FINAL FANTASY Commander Deck Display - 4 Decks"), 618907);
  assert.equal(found("YU-GI-OH! Magnificent Maestros Booster Pack"), 715297);
  assert.equal(found("Dragon Ball Super Card Game Fusion World 07 Booster Box FB07"), 720002);
  assert.equal(found("UNION ARENA SOLO LEVELING Booster Box (Second Edition)"), 709842);
});

test("searches name the game and the set without its code", () => {
  assert.equal(am.keywords(PRODUCTS.find((p) => p.id === 712094)!), "Pokémon Delta Reign Booster Box");
  assert.equal(am.keywords(PRODUCTS.find((p) => p.id === 704757)!), "One Piece Card Game The World's Strongest Warriors Double Pack Set Vol. 12");
  assert.equal(am.keywords(PRODUCTS.find((p) => p.id === 485256)!), "Disney Lorcana: The First Chapter Booster Box", "the game already in the name");
});
