import { test } from "node:test";
import assert from "node:assert/strict";
import { diffRestocks, mergeRestocks, KEEP_DAYS } from "@/lib/restocks";

const at = "2026-11-17T09:47:00.000Z";
const e = (...o: unknown[][]) => ({ o: o as never });

test("a sold-out offer that is in stock now is a restock; a new listing, a pre-order and an unchanged offer are not", () => {
  const prev = { "1": e(["shopa", 3000, 0, "box?variant=1"], ["shopb", 3100, 1, "box?variant=2"], ["shopc", 3200, 0, "box?variant=3"]) };
  const cur = {
    "1": e(["shopa", 2999, 1, "box?variant=1"], ["shopb", 3100, 1, "box?variant=2"], ["shopc", 3200, 3, "box?variant=3"], ["shopd", 3300, 1, "box?variant=4"]),
    "2": e(["shopa", 1000, 1, "other?variant=9"]),
  };
  const got = diffRestocks(prev, cur, at);
  assert.deepEqual(got, [{ p: 1, s: "shopa", c: 2999, r: "box", t: at }]);
});

test("TCGplayer, eBay and Amazon rows are never restocks, and no earlier file means none", () => {
  const prev = { "1": e(["tcgplayer", 3000, 0, "https://x"], ["ebay", 3000, 0, "https://y"]) };
  const cur = { "1": e(["tcgplayer", 3000, 1, "https://x"], ["ebay", 3000, 1, "https://y"]) };
  assert.deepEqual(diffRestocks(prev, cur, at), []);
  assert.deepEqual(diffRestocks(undefined, cur, at), []);
});

test("merging keeps 7 days, newest first, and never repeats a restock seen in the last day", () => {
  const now = new Date(at);
  const old = [
    { p: 1, s: "shopa", c: 1, r: "box", t: "2026-11-17T01:00:00.000Z" },
    { p: 2, s: "shopa", c: 1, r: "box", t: new Date(now.getTime() - (KEEP_DAYS + 1) * 86_400_000).toISOString() },
  ];
  const fresh = [{ p: 1, s: "shopa", c: 2, r: "box", t: at }, { p: 3, s: "shopb", c: 5, r: "x", t: at }];
  const got = mergeRestocks(old, fresh, now);
  assert.deepEqual(got.map((x) => x.p), [3, 1]);
});
