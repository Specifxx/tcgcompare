import { test } from "node:test";
import assert from "node:assert/strict";
import { gameAnswers, typeAnswer, type AnswerInput } from "@/lib/game-answers";
import type { HubItem } from "@/lib/hub-snippet";
import type { Offer } from "@/lib/site-types";

// The game hubs' quick answers (DECISIONS.md 2026-11-28): real store prices only, never an MSRP or a pack count.
const o = (source: string, cents: number, extra: Partial<Offer> = {}): Offer => ({ source, market: "US", currency: "USD", cents, inStock: true, url: "", title: "", ...extra });
const box = (name: string, releasedOn: string, best: Offer[], extra: Partial<HubItem> = {}): HubItem => ({ name, sealedType: "Booster Box", releasedOn, upcoming: false, tcgCents: 9000, best, ...extra });
const names: Record<string, string> = { a: "Shop A ", b: "Shop B", c: "Shop C" };
const base = (extra: Partial<AnswerInput> = {}): AnswerInput => ({
  short: "Digimon",
  items: [box("Old Box", "2025-01-01", [o("a", 7000)]), box("New Box", "2026-11-01", [o("b", 8500), o("tcgplayer", 100)]), box("Next Box", "2026-12-12", [o("a", 1000, { preorder: true })], { upcoming: true })],
  sets: [{ name: "Next Set", releasedOn: "2026-12-12", upcoming: true }, { name: "New Set", releasedOn: "2026-11-01", upcoming: false }],
  stores: [{ name: "Shop B", n: 40 }, { name: "Shop A ", n: 12 }],
  storesAnywhere: 57,
  today: "2026-11-28",
  storeName: (x) => names[x.source] ?? x.source,
  ...extra,
});

test("the booster box answer gives the real US store range and the newest box, never an upcoming or pre-order price", () => {
  const [q] = gameAnswers(base());
  assert.equal(q.q, "How much is a Digimon booster box?");
  assert.match(q.a, /2 Digimon booster boxes are in stock at US stores we track, from \$70\.00 \(Old Box at Shop A\) to \$85\.00 \(New Box\)/);
  assert.match(q.a, /The newest, New Box, is \$90\.00 on TCGplayer's market and from \$85\.00 at Shop B\./);
  assert.doesNotMatch(q.a, /Next Box|\$10\.00|\$1\.00/);
  assert.match(q.a, /not a list price/);
  assert.doesNotMatch(q.a, /MSRP|packs? (per|in)/i);
});

test("the set answer names the newest released set and the next one with its date", () => {
  const qa = gameAnswers(base()).find((x) => x.q.startsWith("What is the newest"))!;
  assert.equal(qa.a, "The newest Digimon set we compare is New Set, released 1 November 2026. The next, Next Set, is due 12 December 2026, and its pre-orders are compared here as stores open them.");
});

test("the store answer counts stores and names the US stores with the most in stock", () => {
  const qa = gameAnswers(base()).find((x) => x.q.startsWith("Where"))!;
  assert.match(qa.a, /^57 stores list Digimon sealed product in our data today/);
  assert.match(qa.a, /Shop B \(40 products\) and Shop A \(12 products\)/);
});

test("a question today's data cannot answer is left out", () => {
  const out = gameAnswers(base({ items: [box("Pre", "2026-12-12", [o("a", 1000)], { upcoming: true, tcgCents: null })], sets: [], stores: [], storesAnywhere: 0 }));
  assert.deepEqual(out, []);
  const tcgOnly = gameAnswers(base({ items: [box("Only", "2026-10-01", [o("tcgplayer", 1)])], stores: [], storesAnywhere: 0 }));
  assert.equal(tcgOnly[0].a, "The newest, Only, is $90.00 on TCGplayer's market. These are what stores charge today, not a list price, and we update them every day.");
});

test("a type hub's answer uses its own words and skips what is not out yet", () => {
  const items = [box("Old Deck", "2025-01-01", [o("a", 1500)], { sealedType: "Starter Deck" }), box("A Box", "2026-01-01", [o("a", 9000)])];
  const qa = typeAnswer({ short: "Gundam", items, today: "2026-11-28", storeName: (x) => x.source }, { type: "Starter Deck", one: "starter deck", many: "starter decks" })!;
  assert.equal(qa.q, "How much is a Gundam starter deck?");
  assert.match(qa.a, /^Today one Gundam starter deck is in stock at a US store we track: Old Deck, \$15\.00 at a\./);
  assert.equal(typeAnswer({ short: "Lorcana", items, today: "2026-11-28", storeName: (x) => x.source }, { type: "Illumineer's Trove", one: "Illumineer's Trove", many: "Illumineer's Troves" }), null);
  assert.equal(typeAnswer({ short: "X", items: [box("E", "2026-01-01", [o("a", 1)], { sealedType: "Elite Trainer Box" })], today: "2026-11-28", storeName: (x) => x.source }, { type: "Elite Trainer Box", one: "elite trainer box", many: "elite trainer boxes" })!.q, "How much is a X elite trainer box?");
  const boxW = { type: "Booster Box", one: "booster box", many: "booster boxes" };
  const ask = (short: string) => typeAnswer({ short, items, today: "2026-11-28", storeName: (x) => x.source }, boxW)!.q;
  assert.equal(ask("Union Arena"), "How much is a Union Arena booster box?");
  assert.equal(ask("One Piece"), "How much is a One Piece booster box?");
  assert.equal(ask("Elestrals"), "How much is an Elestrals booster box?");
});
