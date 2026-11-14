// Store vetting (lib/import/vet.ts; owner, 2026-11-14): a rule may only refuse.
import test from "node:test";
import assert from "node:assert/strict";
import { vetStores } from "../src/lib/import/vet";
import type { Offer, StoreConfig } from "../src/lib/site-types";

const store = (key: string, base: string): StoreConfig => ({ key, name: key, base, market: "US", collections: [], kind: "sealed" });
const offer = (source: string, cents: number, inStock = true): Offer => ({ source, market: "US", currency: "USD", cents, inStock, url: "https://x.test/p", title: "" });
const run = (stores: StoreConfig[], offers: Map<number, Offer[]>, blocklist: Record<string, string> = {}) =>
  vetStores({ stores, offers, refCents: () => 10_000, fx: { USD: 1 }, blocklist });

test("a blocked host and a shop with no domain of its own are refused", () => {
  const r = run([store("good", "https://www.goodcards.com"), store("chroma", "https://chromavaults.myshopify.com"), store("bad", "https://badcards.com")], new Map(), { "badcards.com": "reported" });
  assert.deepEqual(r.map((x) => [x.key, x.rule]), [["bad", "blocked"], ["chroma", "no-domain"]]);
});

test("a shelf priced far under market is refused; one bargain, or a sold-out price, is not", () => {
  const offers = new Map<number, Offer[]>();
  for (let id = 1; id <= 6; id++) offers.set(id, [offer("scam", 4_000), offer("fair", 11_000), offer("ghost", 3_000, false)]);
  offers.get(1)!.push(offer("onesale", 5_000));
  const r = run(["scam", "fair", "ghost", "onesale"].map((k) => store(k, `https://${k}.com`)), offers);
  assert.deepEqual(r.map((x) => x.key), ["scam"]);
  assert.match(r[0].why, /40% of TCGplayer's market across 6 products/);
});
