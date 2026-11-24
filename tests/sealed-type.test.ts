import { test } from "node:test";
import assert from "node:assert/strict";
import { sealedTypeOf } from "../src/lib/import/tcgcsv";

test("a Commander Deck Case is a sealed case of decks, a deck case is an accessory", () => {
  assert.equal(sealedTypeOf("Star Trek Commander Deck Case"), "Case");
  assert.equal(sealedTypeOf("Star Trek Commander Deck Case (Collector's Edition)"), "Case");
  assert.equal(sealedTypeOf("Nauctis: The Sunken Realm Commander Deck Case"), "Case");
  assert.equal(sealedTypeOf("Ultra PRO Deck Case - Charizard"), "Insert");
  assert.equal(sealedTypeOf("Gamegenic Deck Case 100+"), "Insert");
  assert.equal(sealedTypeOf("Dragon Shield Deck Box"), "Insert");
});
