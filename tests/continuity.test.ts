// The import's continuity rules (lib/import/continuity.ts, lib/culled.ts; DECISIONS.md 2026-11-14): a page that
// existed never 404s, whatever took it away, and a sister that is down does not take its stores off the site at once.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { carryDownSisters, culledTarget, groupIsRead, groupsToKeep, heldForDownSisters, updateCulled, type SisterMemo } from "../src/lib/import/continuity";
import { culledRedirect } from "../src/lib/culled";
import { focusCatalog } from "../src/lib/import/focus";
import { SITE } from "../src/site.config";
import type { Offer, Product, SetInfo, StoreConfig } from "../src/lib/site-types";

const set = (id: number, slug: string, line?: string, releasedOn = "2026-01-01"): SetInfo => ({ id, name: slug, code: slug, slug, releasedOn, productCount: 1, upcoming: false, ...(line ? { line } : {}) });
const prod = (id: number, slug: string, setId: number, extra: Partial<Product> = {}): Product =>
  ({ id, slug, name: slug, kind: "sealed", setId, sealedType: "Booster Box", image: null, tcgUrl: "https://tcgplayer.com/x", printings: [], ...extra }) as unknown as Product;
const offer = (source: string, inStock = true, market: Offer["market"] = "US"): Offer => ({ source, market, currency: "USD", cents: 10_000, inStock, url: `https://${source}.test/p`, title: "" });
const store = (key: string, base = `https://${key}.test`): StoreConfig => ({ key, name: key, base, market: "US", collections: [], kind: "sealed" });

// ---- TCGCSV groups -------------------------------------------------------------------------------------------

test("a group past the age window is still read while the last catalogue has a page in it, or it is a catch-all", () => {
  const oldest = Date.parse("2021-11-20T00:00:00Z");
  const old = { groupId: 2576, publishedOn: "2021-11-19T00:00:00" };
  assert.equal(groupIsRead(old, oldest, new Set()), false);
  assert.equal(groupIsRead(old, oldest, new Set([2576])), true);
  assert.equal(groupIsRead({ groupId: 9, publishedOn: "2025-01-01T00:00:00" }, oldest, new Set()), true);
  assert.equal(groupIsRead({ groupId: 9, publishedOn: "" }, oldest, new Set()), true);
  const keep = groupsToKeep({ sets: [set(1, "a"), set(2, "b")], products: [prod(10, "x", 2)] }, [2576]);
  assert.deepEqual([...keep].sort((a, b) => a - b), [2, 2576]);
  assert.deepEqual([...groupsToKeep(null)], []);
});

test("the site names its catch-all groups (Secret Lair, Challenger Decks, Pokemon Miscellaneous)", () => {
  for (const id of [2576, 2632, 2203, 2374]) assert.ok(SITE.catalogFocus?.evergreenGroups?.includes(id), String(id));
});

// ---- culled.json ---------------------------------------------------------------------------------------------

test("a product that had a page and is gone for any reason is culled with its set and game", () => {
  const prev = {
    sets: [set(1, "alpha", "mtg"), set(2, "secret-lair", "mtg"), set(3, "battle-academy-2024", "pkm")],
    products: [prod(10, "kept-box", 1), prod(11, "dropped-by-focus", 1), prod(12, "group-aged-out", 2), prod(13, "academy", 3)],
  };
  // Today: group 2 was not read at all, set 3 has nothing kept but TCGCSV still serves it.
  const out = updateCulled({ existing: {}, prev, kept: [prod(10, "kept-box", 1)], setsToday: [set(1, "alpha", "mtg"), set(3, "battle-academy-2024", "pkm")] });
  assert.deepEqual(out, {
    academy: { set: "battle-academy-2024", line: "pkm" },
    "dropped-by-focus": { set: "alpha", line: "mtg" },
    "group-aged-out": { set: "secret-lair", line: "mtg" },
  });
});

test("old string entries are still read, gain their line when the set is known, and a product back leaves the list", () => {
  const out = updateCulled({
    existing: { "old-one": "battle-academy-2024", "unknown-set": "gone-set", "back-again": "alpha" },
    prev: { sets: [set(3, "battle-academy-2024", "pkm")], products: [] },
    kept: [prod(20, "back-again", 1)],
    setsToday: [],
  });
  assert.deepEqual(out, { "old-one": { set: "battle-academy-2024", line: "pkm" }, "unknown-set": "gone-set" });
  assert.deepEqual(culledTarget("gone-set"), { set: "gone-set", line: null });
  assert.deepEqual(culledTarget({ set: "a", line: "pkm" }), { set: "a", line: "pkm" });
  assert.equal(culledTarget(null), null);
});

test("a culled product goes to its set, else its game's hub, else the set's hub", () => {
  const hub = (l: string) => (l === "pkm" ? "/games/pokemon" : null);
  const ofSet = () => "/sealed";
  assert.equal(culledRedirect({ set: "alpha", line: "mtg" }, (s) => s === "alpha", hub, ofSet), "/sets/alpha");
  assert.equal(culledRedirect({ set: "battle-academy-2024", line: "pkm" }, () => false, hub, ofSet), "/games/pokemon");
  assert.equal(culledRedirect({ set: "x", line: null }, () => false, hub, ofSet), "/sealed");
  assert.equal(culledRedirect({ set: "x", line: "nope" }, () => false, hub, ofSet), "/sealed");
});

test("every entry in the committed culled.json reads in either format", () => {
  const file = path.join(process.cwd(), "data", "public", "culled.json");
  if (!fs.existsSync(file)) return;
  for (const [slug, e] of Object.entries(JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, never>)) assert.ok(culledTarget(e), slug);
});

// ---- a sister that is down -----------------------------------------------------------------------------------

const now = new Date("2026-11-14T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

test("a down sister's stores keep their previous rows while its data is under 72 hours old", () => {
  const prevById = { "1": { offers: [offer("shopa"), offer("shopb"), offer("tcgplayer")] }, "2": { offers: [offer("shopa", false)] } };
  const live = new Map<number, Offer[]>([[1, [offer("shopb")]]]);
  const status: Record<string, SisterMemo> = { mtg: { ok: false, offers: 0, products: 0, at: null, error: "missing" }, ygo: { ok: true, offers: 1, products: 1, at: hoursAgo(1), stores: ["shopb"] } };
  const prevStatus: Record<string, SisterMemo> = { mtg: { ok: true, offers: 2, products: 2, at: hoursAgo(30), stores: ["shopa", "shopb"] } };
  const r = carryDownSisters({ status, prevStatus, prevById, live, liveStores: [store("shopb")], prevStores: [store("shopa"), store("shopb")], now, maxAgeH: 72 });
  // shopb is live through ygo, so only shopa is carried; never the TCGplayer row.
  assert.deepEqual([...r.offers].map(([id, l]) => [id, l.map((o) => o.source)]), [[1, ["shopa"]], [2, ["shopa"]]]);
  assert.deepEqual(r.stores.map((s) => s.key), ["shopa"]);
  assert.deepEqual([...r.downStores].sort(), ["shopa", "shopb"]);
  assert.equal(r.status.mtg.carried, 2);
  assert.equal(r.status.mtg.at, hoursAgo(30), "a down sister keeps the time its data was last fresh");
  assert.deepEqual(r.status.mtg.stores, ["shopa", "shopb"]);
  assert.equal(r.status.ygo, status.ygo);
});

test("nothing is carried 72 hours after a down sister's data was last fresh, but its stores still hold products", () => {
  const prevById = { "1": { offers: [offer("shopa")] } };
  const status: Record<string, SisterMemo> = { mtg: { ok: false, offers: 0, products: 0, at: null, error: "data is 80 hours old" } };
  const prevStatus: Record<string, SisterMemo> = { mtg: { ok: false, offers: 0, products: 0, at: hoursAgo(73), stores: ["shopa"], carried: 1 } };
  const r = carryDownSisters({ status, prevStatus, prevById, live: new Map(), liveStores: [], prevStores: [store("shopa")], now, maxAgeH: 72 });
  assert.equal(r.offers.size, 0);
  assert.equal(r.status.mtg.carried, 0);
  assert.deepEqual([...r.downStores], ["shopa"]);
});

test("a carried key today's directory gives another shop is never reused; without a store list the missing stores are the sister's", () => {
  const prevById = { "1": { offers: [offer("shopa"), offer("shopc")] } };
  const status: Record<string, SisterMemo> = { mtg: { ok: false, offers: 0, products: 0, at: null } };
  const prevStatus: Record<string, SisterMemo> = { mtg: { ok: true, offers: 2, products: 1, at: hoursAgo(5) } };
  const r = carryDownSisters({
    status,
    prevStatus,
    prevById,
    live: new Map([[9, [offer("shopa")]]]),
    liveStores: [store("shopa", "https://another-shop.test")],
    prevStores: [store("shopa"), store("shopc")],
    now,
    maxAgeH: 72,
  });
  assert.deepEqual([...r.downStores], ["shopc"]);
  assert.deepEqual([...r.offers].map(([id, l]) => [id, l.map((o) => o.source)]), [[1, ["shopc"]]]);
});

test("a product kept only for a down sister's stock is held, not culled", () => {
  const products = [prod(1, "old-box", 1), prod(2, "other-box", 1), prod(3, "never-kept", 1)];
  const sets = [set(1, "old-set", "mtg", "2020-01-01")];
  const prevById = { "1": { offers: [offer("shopa"), offer("shopz")] }, "2": { offers: [offer("shopx"), offer("shopy")] }, "3": { offers: [offer("shopa")] } };
  const previous = new Set([1, 2]);
  // The sister behind shopa is down and nothing was carried: the focus alone would drop all three (old, no stock).
  const kept = focusCatalog({ products, sets, offers: new Map(), tcg: {}, rule: SITE.catalogFocus!, now, previous });
  assert.equal(kept.length, 0);
  const held = heldForDownSisters({ products, keptIds: new Set(kept.map((p) => p.id)), previous, prevById, downStores: new Set(["shopa"]) });
  assert.deepEqual(held.map((p) => p.slug), ["old-box"]);
  assert.deepEqual(heldForDownSisters({ products, keptIds: new Set(), previous, prevById, downStores: new Set() }), []);
});
