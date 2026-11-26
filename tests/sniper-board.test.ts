import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appendDrops, dropLogId, DROP_LOG_DAYS, DROP_LOG_MAX } from "../src/lib/sniper-board";
import { sniperKey, type SniperEvent } from "../src/lib/sniper";

const product = { id: 7, slug: "box", name: "Box", sealedType: "Booster Box", line: "pkm", marketCents: 10000 };
const store = { key: "s1", name: "Shop", base: "https://shop.example", market: "US" as const };
const drop: SniperEvent = { kind: "drop", product, store, cents: 8000, ref: "/products/box", was: 9500, pct: 16 };
const restock: SniperEvent = { kind: "restock", product: { ...product, id: 8 }, store, cents: 9000, ref: "/products/b" };

test("posted events are logged newest first with ids riftcompare accepts", () => {
  const now = Date.parse("2026-11-26T09:47:00Z");
  const log = appendDrops(null, [drop, restock], sniperKey, now);
  assert.equal(log.drops.length, 2);
  assert.match(log.drops[0]!.id, /^[a-f0-9]{12}$/);
  assert.match(log.drops[0]!.id, /^[a-z0-9-]{6,64}$/);
  assert.deepEqual({ ...log.drops[0], id: "" }, { id: "", at: "2026-11-26T09:47:00.000Z", kind: "drop", p: 7, s: "s1", c: 8000, was: 9500, pct: 16 });
  assert.equal(log.drops[1]!.was, undefined);
  assert.equal(log.drops[0]!.id, dropLogId(sniperKey(drop), "2026-11-26T09:47:00.000Z"));
});

test("old drops fall out and the log is capped", () => {
  const t0 = Date.parse("2026-11-01T00:00:00Z");
  let log = appendDrops(null, [drop], sniperKey, t0);
  log = appendDrops(log, [restock], sniperKey, t0 + (DROP_LOG_DAYS + 1) * 86_400_000);
  assert.equal(log.drops.length, 1);
  assert.equal(log.drops[0]!.kind, "restock");
  const many = Array.from({ length: DROP_LOG_MAX + 10 }, (_, i) => ({ ...restock, product: { ...product, id: 100 + i } }));
  assert.equal(appendDrops(null, many, sniperKey, t0).drops.length, DROP_LOG_MAX);
});

test("the log holds no private field and votes never reach a price", () => {
  const src = readFileSync("src/components/DropVotes.tsx", "utf8");
  assert.match(src, /riftcompare\.com\/api\/deal-votes/);
  assert.doesNotMatch(src, /email|<input/i);
  for (const f of ["src/lib/sniper.ts", "src/components/PriceTable.tsx"]) assert.doesNotMatch(readFileSync(f, "utf8"), /deal-votes|DropVotes/);
});
