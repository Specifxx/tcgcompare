// The homepage's most in-demand booster boxes (lib/popular-boxes.ts): ranked by signals the data has, mixed across games.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { demandScore, mixAcrossGames, type Candidate } from "../src/lib/popular-boxes";

const c = (id: number, game: string, o: Partial<Candidate> = {}): Candidate => ({ id, game, stores: 4, ageDays: 60, marketCents: 12000, change7d: 0, ...o });

test("more stores, a newer set, a bigger market and a rising price each score higher", () => {
  const base = demandScore(c(1, "a"));
  assert.ok(demandScore(c(1, "a", { stores: 8 })) > base);
  assert.ok(demandScore(c(1, "a", { ageDays: 10 })) > base);
  assert.ok(demandScore(c(1, "a", { marketCents: 40000 })) > base);
  assert.ok(demandScore(c(1, "a", { change7d: 8 })) > base);
  assert.ok(demandScore(c(1, "a", { change7d: null })) < demandScore(c(1, "a", { change7d: 3 })), "no figure is neutral, never a boost");
  assert.ok(demandScore(c(1, "a")) <= 100 && demandScore(c(1, "a", { ageDays: -20 })) <= 100);
});

test("every game's best box is placed before any game's second, and no game has more than two", () => {
  const list = [
    ...[1, 2, 3, 4, 5].map((i) => c(i, "big", { stores: 8, ageDays: 5 })),
    c(10, "small", { stores: 2, ageDays: 200, marketCents: 6000 }),
    c(11, "other", { stores: 1, ageDays: 300, marketCents: 5000 }),
  ];
  const out = mixAcrossGames(list, 8);
  assert.deepEqual(out.slice(0, 3).map((x) => x.game).sort(), ["big", "other", "small"]);
  assert.equal(out.filter((x) => x.game === "big").length, 2);
  assert.equal(out.length, 4);
});

test("the shelf is deterministic and reads only real data, with no paid link", () => {
  const list = [c(3, "a"), c(2, "b"), c(1, "c")];
  assert.deepEqual(mixAcrossGames(list), mixAcrossGames([...list].reverse()));
  const src = readFileSync("src/lib/popular-boxes.ts", "utf8");
  assert.doesNotMatch(src, /Math\.random|fetch\(|ebay|affiliate/i);
});
