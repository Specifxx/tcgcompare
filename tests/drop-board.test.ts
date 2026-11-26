import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOARD_MAX, GONE_FLAGS, NO_TALLY, NO_VOTE, applyVote, dropState, heat, score, sortHot, underMarket, type Tally } from "../src/lib/drop-board";

// The deal board (owner, 2026-11-26): /drops and /drops/<id>.

test("a posted drop is live, moved or gone by our own latest check, never by a vote", () => {
  assert.equal(dropState(8000, 8000), "live");
  assert.equal(dropState(8000, 8100), "live", "inside the Sniper's own 2% tolerance");
  assert.equal(dropState(8000, 8900), "moved");
  assert.equal(dropState(8000, 7000), "moved", "cheaper now is still a different price");
  assert.equal(dropState(8000, null), "gone");
});

test("under market is claimed for a US price only, and only when it is under", () => {
  assert.equal(underMarket(9000, "US", 10000), 10);
  assert.equal(underMarket(9700, "US", 10000), null, "a point or two under is not a deal");
  assert.equal(underMarket(10000, "US", 10000), null);
  assert.equal(underMarket(11000, "US", 10000), null);
  assert.equal(underMarket(9000, "UK", 10000), null, "a pound price is never set against a dollar market");
  assert.equal(underMarket(9000, "US", null), null);
});

test("a tap changes the count the way the service will: toggle, switch, and gone on its own", () => {
  let s = applyVote(NO_TALLY, NO_VOTE, "hot");
  assert.deepEqual(s, { tally: { hot: 1, cold: 0, expired: 0 }, mine: { vote: 1, expired: false } });
  s = applyVote(s.tally, s.mine, "cold");
  assert.deepEqual(s.tally, { hot: 0, cold: 1, expired: 0 }, "hot to cold moves one vote, never two");
  s = applyVote(s.tally, s.mine, "expired");
  assert.deepEqual(s, { tally: { hot: 0, cold: 1, expired: 1 }, mine: { vote: -1, expired: true } });
  s = applyVote(s.tally, s.mine, "cold");
  s = applyVote(s.tally, s.mine, "expired");
  assert.deepEqual(s, { tally: NO_TALLY, mine: NO_VOTE }, "tapping again takes it back");
  assert.deepEqual(applyVote(NO_TALLY, { vote: 1, expired: false }, "hot").tally, NO_TALLY, "a stale count never goes below zero");
});

test("Hot: votes over age, the gone sink, ties stay newest first", () => {
  const now = Date.parse("2026-11-26T12:00:00Z");
  const h = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
  const t = (hot: number, cold = 0, expired = 0): Tally => ({ hot, cold, expired });
  assert.equal(score(t(5, 2)), 3);
  assert.ok(heat(t(3), h(2), now) > heat(t(3), h(30), now), "the same votes cool with age");
  assert.ok(heat(t(4), h(3), now) > heat(t(0), h(1), now), "votes beat a little freshness");
  assert.ok(heat(t(0), h(1), now) > heat(t(0, 2), h(1), now), "voted cold sinks under unvoted");
  const rows = [
    { id: "old-loved", at: h(60), state: "live" as const },
    { id: "new-quiet", at: h(1), state: "live" as const },
    { id: "new-loved", at: h(2), state: "live" as const },
    { id: "gone-loved", at: h(2), state: "gone" as const },
    { id: "flagged", at: h(1), state: "live" as const },
    { id: "newer-quiet", at: h(0.5), state: "live" as const },
  ];
  const order = sortHot(rows, { "old-loved": t(6), "new-loved": t(6), "gone-loved": t(20), flagged: t(9, 0, GONE_FLAGS) }, now).map((r) => r.id);
  assert.deepEqual(order.slice(0, 3), ["new-loved", "newer-quiet", "new-quiet"]);
  assert.deepEqual(new Set(order.slice(-2)), new Set(["gone-loved", "flagged"]), "sold out or flagged gone is under every live drop");
  assert.equal(rows[0]!.id, "old-loved", "the server's order is left as it was");
});

test("the board fits one tally request, and its pages follow the cost rules", () => {
  assert.ok(BOARD_MAX <= 60, "riftcompare's MAX_IDS");
  const board = readFileSync("src/app/drops/page.tsx", "utf8");
  assert.match(board, /export const revalidate = 86400;/);
  const one = readFileSync("src/app/drops/[id]/page.tsx", "utf8");
  assert.match(one, /export const dynamic = "force-dynamic";/);
  assert.match(one, /robots: \{ index: false, follow: true \}/, "a drop's page leaves in two weeks: never indexed");
  assert.match(one, /if \(!r\) redirect\("\/drops"\);/, "a shared link never 404s");
  assert.doesNotMatch(board + one, /generateStaticParams|cookies\(\)|headers\(\)|searchParams/);
  assert.match(readFileSync("next.config.js", "utf8"), /"\/drops\/:id"\]/, "kept by the CDN, not ISR");
});

test("votes order the board and nothing else; nothing is typed and nobody is asked to sign in", () => {
  const ui = readFileSync("src/components/DropBoard.tsx", "utf8");
  assert.doesNotMatch(ui, /<input|<textarea|email|sign in/i);
  assert.match(ui, /rel="sponsored nofollow noopener"/);
  for (const f of ["src/lib/sniper.ts", "src/components/PriceTable.tsx", "src/lib/data.ts", "src/lib/alert-feed.ts", "src/components/ProductTile.tsx"])
    assert.doesNotMatch(readFileSync(f, "utf8"), /deal-votes|drop-board|DropBoard/, f);
});
