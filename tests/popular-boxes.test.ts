// The homepage's most in-demand booster boxes (lib/popular-boxes.ts): ranked by signals the data has, mixed across games.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { demandScore, mixAcrossGames, pickLaunches, withLaunches, LAUNCH_SLOTS, type Candidate } from "../src/lib/popular-boxes";

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

test("launch week leads: a box out in the last seven days goes first even with no views yet (merch, 2026-11-19)", () => {
  const list = [
    c(1, "old", { ageDays: 42, stores: 8, visits: 44 }),
    c(2, "old2", { ageDays: 14, stores: 8, visits: 20 }),
    c(3, "op", { ageDays: 0, stores: 8, marketCents: 20000, visits: 0 }),
    c(4, "swu", { ageDays: 0, stores: 6, visits: 0 }),
    c(5, "pre", { ageDays: -14, stores: 8, visits: 0 }),
    c(6, "late", { ageDays: 7, stores: 8, visits: 0 }),
    ...Array.from({ length: 30 }, (_, i) => c(100 + i, `g${i}`, { ageDays: 300, visits: 2 })),
  ];
  const out = withLaunches(list, 8);
  assert.deepEqual(out.slice(0, 2).map((x) => x.id), [3, 4], "the day-0 releases lead, best first");
  assert.ok(!pickLaunches(list).some((x) => x.id === 5), "a pre-order is not a launch");
  assert.ok(!pickLaunches(list).some((x) => x.id === 6), "day seven is past launch week");
  assert.ok(out.some((x) => x.id === 1), "the demand ranking still fills the rest");
  assert.equal(out.length, 8);
  assert.equal(new Set(out.map((x) => x.id)).size, out.length, "no box twice");
});

test("at most LAUNCH_SLOTS launches, one a game, and no game more than twice", () => {
  const list = [
    ...[1, 2, 3].map((i) => c(i, "big", { ageDays: 1, stores: 8 })),
    ...[10, 11, 12, 13].map((i) => c(i, `new${i}`, { ageDays: 2 })),
    ...[20, 21, 22].map((i) => c(i, "big", { ageDays: 90, visits: 50 })),
  ];
  const lead = pickLaunches(list);
  assert.equal(lead.length, LAUNCH_SLOTS);
  assert.equal(new Set(lead.map((x) => x.game)).size, lead.length);
  const out = withLaunches(list, 8);
  assert.ok(out.filter((x) => x.game === "big").length <= 2);
  assert.deepEqual(withLaunches(list), withLaunches([...list].reverse()), "deterministic");
});
