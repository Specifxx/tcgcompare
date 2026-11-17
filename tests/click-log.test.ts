import { test } from "node:test";
import assert from "node:assert/strict";
import { goHref, isPaidSource } from "../src/lib/affiliate";
import { parse, summarise, regionOf } from "../scripts/paid-click-share";

test("goHref carries row position and price gap, and only when known", () => {
  const o = { url: "https://store.example/p", source: "x", market: "US" };
  const q = new URL(goHref(o, 5, "card", { pos: 3, gapPct: 7.6 }), "https://a.b").searchParams;
  assert.equal(q.get("r"), "3");
  assert.equal(q.get("g"), "8");
  const bare = new URL(goHref(o, 5, "card"), "https://a.b").searchParams;
  assert.equal(bare.has("r"), false);
  assert.equal(bare.has("g"), false);
});

test("paid sources are eBay, TCGplayer and Amazon", () => {
  assert.deepEqual(["ebay", "tcgplayer", "amazon", "somestore"].map(isPaidSource), [true, true, true, false]);
});

test("the click summary reads runtime-log lines and groups by region", () => {
  const log = [
    `{"evt":"buy_click_geo","country":"AU","paid":true,"position":1}`,
    `{"message":"{\\"evt\\":\\"buy_click_geo\\",\\"country\\":\\"AU\\",\\"paid\\":false,\\"position\\":4}"}`,
    `{"evt":"buy_click_geo","country":"DE","paid":true,"position":2}`,
    `unrelated line`,
  ].join("\n");
  const rows = parse(log);
  assert.equal(rows.length, 3);
  assert.equal(regionOf("DE"), "EU");
  const s = summarise(rows);
  const au = s.find((x) => x.region === "AU")!;
  assert.equal(au.clicks, 2);
  assert.equal(au.paidShare, 0.5);
});
