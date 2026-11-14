// TCG Prices has no eBay prices (owner, 2026-11-14): eBay is the pinned tagged search row only. A bug report found an
// "eBay AU" row marked BEST PRICE at A$639.95 on a Yu-Gi-Oh! display, and the "Cheapest in Australia" box naming eBay:
// a sister site's eBay listing had been reused as an offer. These pin every layer that could let one through again.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { priceRows } from "@/lib/price-rows";
import { decodeEntry, summarize } from "@/lib/price-store";
import { ebayPricesIn, ebayPriceVerdict } from "@/lib/no-ebay-prices";
import type { Offer } from "@/lib/site-types";

const offer = (source: string, cents: number, market: Offer["market"] = "AU"): Offer => ({ source, market, currency: "AUD", cents, inStock: true, url: `https://${source}.example/p`, title: "" });

test("eBay and Amazon are never the cheapest row", () => {
  const rows = priceRows([offer("ebay", 63995), offer("amazon", 60000), offer("gamesempire", 69995), offer("cardcastle", 71000)], "AU");
  assert.equal(rows.cheapest?.source, "gamesempire");
  const only = priceRows([offer("ebay", 63995)], "AU");
  assert.equal(only.cheapest, null);
});

test("an eBay offer in a stored entry is dropped when read", () => {
  const e = decodeEntry({ t: {}, o: [["ebay", 63995, 1, "https://www.ebay.com.au/itm/1", "", 0, "AU"], ["gamesempire", 69995, 1, "p"]] as never, c7: null, c30: null });
  assert.ok(e.offers.every((o) => o.source !== "ebay"));
});

test("the summary's cheapest per market and source counts never include eBay or Amazon", () => {
  const s = summarize({ tcg: {}, offers: [offer("ebay", 63995), offer("amazon", 60000), offer("gamesempire", 69995)], change7d: null, change30d: null });
  assert.ok(s.b.every((t) => t[0] !== "ebay" && t[0] !== "amazon"));
  assert.equal(s.e, undefined);
});

test("the import never adds an eBay offer (no own eBay state, no sister eBay listing)", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "scripts/import-all.ts"), "utf8");
  assert.doesNotMatch(src, /sisterEbay/);
  assert.doesNotMatch(src, /offers\.push\(\{\s*\.\.\.e\.offer/);
});

test("the ops check goes red on an eBay price in the published data", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "noebay-"));
  fs.mkdirSync(path.join(dir, "prices"));
  fs.writeFileSync(path.join(dir, "prices", "1.json"), JSON.stringify({ "9": { t: {}, o: [["shop", 100, 1, "p"]] } }));
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify({ "9": { t: {}, b: [["shop", 100, 1, "p"]] } }));
  assert.equal(ebayPriceVerdict(dir).status, "ok");
  fs.writeFileSync(path.join(dir, "prices", "1.json"), JSON.stringify({ "9": { t: {}, o: [["ebay", 90, 1, "https://www.ebay.com/itm/1", "", 0, "US"]] } }));
  assert.deepEqual(ebayPricesIn(dir), { offers: 1, products: 1, picks: 0 });
  assert.equal(ebayPriceVerdict(dir).status, "fail");
});
