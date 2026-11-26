import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromWire, mergeThreeWay, parseSyncState, sameList, syncOnce, toWire, type Post, type SyncState, type WireItem } from "../src/lib/vault-sync";
import type { VaultItem } from "../src/lib/vault";

// DECISIONS.md, "A signed-in member's collection follows them, and a weekly stash email" (2026-11-26).

const item = (id: string, qty: number, market = "US"): VaultItem => ({
  id,
  name: `Box ${id}`,
  href: `/card/${id}`,
  image: null,
  market,
  currency: market === "AU" ? "AUD" : "USD",
  addedCents: 1000,
  qty,
  addedAt: "2026-11-01T00:00:00.000Z",
});
const q = (list: VaultItem[]) => Object.fromEntries(list.map((i) => [`${i.market}:${i.id}`, i.qty]));

test("wire form round-trips and drops what the site can't value", () => {
  const i = { ...item("a", 2), image: "https://tcgplayer-cdn.tcgplayer.com/product/1_200w.jpg" };
  assert.deepEqual(fromWire(toWire(i)), i);
  assert.equal(fromWire({ id: "a", m: "XX", q: 1, a: 0, at: "" }), null);
  assert.equal(fromWire({ id: "a", m: "US", q: 0, a: 0, at: "" }), null);
  assert.equal(fromWire({ id: "a", m: "US", q: 1, a: 0, at: "" })!.name, "A product you own");
});

test("three-way merge: adds and removals from both sides survive; a quantity changed on one side takes that side", () => {
  const base = [item("a", 1), item("b", 2), item("c", 1), item("d", 1)];
  const local = [item("a", 3), item("b", 2), item("e", 1), item("d", 1)]; // a qty up, c removed, e added
  const remote = [item("a", 1), item("b", 5), item("c", 1), item("f", 2)]; // b qty up, d removed, f added
  assert.deepEqual(q(mergeThreeWay(base, local, remote)), { "US:a": 3, "US:b": 5, "US:e": 1, "US:f": 2 });
});

test("three-way merge: both sides changed one quantity keeps the larger, never the sum; a removal loses to an edit", () => {
  assert.deepEqual(q(mergeThreeWay([item("a", 1)], [item("a", 4)], [item("a", 2)])), { "US:a": 4 });
  assert.deepEqual(q(mergeThreeWay([item("a", 1)], [], [item("a", 3)])), { "US:a": 3 }, "edited remotely after a local removal: kept");
  // First sync of a browser: a union, the larger quantity where both have it.
  assert.deepEqual(q(mergeThreeWay([], [item("a", 2), item("b", 1, "AU")], [item("a", 1), item("c", 1)])), { "US:a": 2, "AU:b": 1, "US:c": 1 });
});

test("sameList compares items and quantities only", () => {
  assert.ok(sameList([item("a", 1), item("b", 2)], [item("b", 2), { ...item("a", 1), name: "x" }]));
  assert.ok(!sameList([item("a", 1)], [item("a", 2)]));
});

function server(initial: { rev: number; items: WireItem[]; weekly?: boolean }) {
  const db = { ...initial, weekly: initial.weekly ?? false };
  const calls: string[] = [];
  let interleave: (() => void) | null = null;
  const post: Post = async (body) => {
    calls.push(String(body.op));
    if (body.op === "get") return { status: 200, json: { ok: true, rev: db.rev, items: db.items, weekly: db.weekly, lastSentAt: null } };
    if (body.op === "put") {
      if (interleave) {
        const f = interleave;
        interleave = null;
        f();
      }
      if (body.baseRev !== db.rev) return { status: 409, json: { ok: false, conflict: true, rev: db.rev, items: db.items, weekly: db.weekly } };
      db.items = body.items as WireItem[];
      db.rev += 1;
      return { status: 200, json: { ok: true, rev: db.rev } };
    }
    return { status: 400, json: {} };
  };
  return { db, post, calls, beforeNextPut: (f: () => void) => (interleave = f) };
}

test("sync: first time a union is saved; unchanged after that, it only reads", async () => {
  const s = server({ rev: 0, items: [] });
  const r = await syncOnce("t", "me", [item("a", 2)], null, s.post);
  assert.equal(r.kind, "synced");
  assert.equal(s.db.rev, 1);
  assert.deepEqual(s.calls, ["get", "put"]);
  const again = await syncOnce("t", "me", [item("a", 2)], (r as { state: SyncState }).state, s.post);
  assert.equal(again.kind, "synced");
  assert.deepEqual(s.calls, ["get", "put", "get"]);
});

test("sync: another device writing in between is merged, never overwritten", async () => {
  const s = server({ rev: 3, items: [toWire(item("a", 1))] });
  const prev: SyncState = { who: "me", rev: 3, base: [toWire(item("a", 1))], weekly: false, lastSentAt: null, at: 0 };
  s.beforeNextPut(() => {
    s.db.items = [toWire(item("a", 1)), toWire(item("phone", 1))];
    s.db.rev = 4;
  });
  const r = await syncOnce("t", "me", [item("a", 1), item("laptop", 1)], prev, s.post);
  assert.equal(r.kind, "synced");
  assert.deepEqual(q((r as { items: VaultItem[] }).items), { "US:a": 1, "US:laptop": 1, "US:phone": 1 });
  assert.equal(s.db.rev, 5);
  assert.deepEqual(s.calls, ["get", "put", "put"]);
});

test("sync: another account's list in this browser is never copied into this one; 401 is signed out", async () => {
  const s = server({ rev: 2, items: [toWire(item("mine", 1))] });
  const prev: SyncState = { who: "someone-else", rev: 9, base: [toWire(item("theirs", 1))], weekly: true, lastSentAt: null, at: 0 };
  const r = await syncOnce("t", "me", [item("theirs", 1)], prev, s.post);
  assert.deepEqual(q((r as { items: VaultItem[] }).items), { "US:mine": 1 });
  assert.deepEqual(s.calls, ["get"]);
  const out = await syncOnce("t", "me", [], null, async () => ({ status: 401, json: {} }));
  assert.equal(out.kind, "signed-out");
  const down = await syncOnce("t", "me", [], null, async () => ({ status: 503, json: { error: "x" } }));
  assert.equal(down.kind, "offline");
});

test("stored sync state reads back safely", () => {
  assert.equal(parseSyncState("junk"), null);
  assert.equal(parseSyncState(JSON.stringify({ who: "a", rev: 1.5, base: [] })), null);
  assert.equal(parseSyncState(JSON.stringify({ who: "a", rev: 1, base: [], weekly: true }))!.weekly, true);
});

test("only the sync module talks to the account service, with no cookies", () => {
  const src = readFileSync(new URL("../src/lib/vault-sync.ts", import.meta.url), "utf8");
  assert.match(src, /credentials: "omit"/);
  assert.match(src, /\/api\/sister-premium\/stash/);
});

test("the account a token names tells two accounts apart even when their masked addresses match", async () => {
  const { accountOf } = await import("../src/lib/vault-sync");
  const tok = (sub: string) => `h.${Buffer.from(JSON.stringify({ sub })).toString("base64url")}.s`;
  assert.equal(accountOf(tok("bill@example.com"), "bi***@example.com"), "bill@example.com");
  assert.notEqual(accountOf(tok("bill@example.com"), "x"), accountOf(tok("billy@example.com"), "x"));
  assert.equal(accountOf("junk", "fallback"), "fallback");
});
