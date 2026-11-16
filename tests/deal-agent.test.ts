import test from "node:test";
import assert from "node:assert/strict";
import { judge, MIN_HISTORY_DAYS } from "../src/lib/deal-agent";
import { dailyBefore, recordLows, storeLowsByMarket } from "../src/lib/import/store-lows";
import type { Offer } from "../src/lib/site-types";

const flat = (n: number, c: number) => Array.from({ length: n }, () => c);
const o = (x: Partial<Offer>): Offer => ({ source: "store", market: "US", currency: "USD", cents: 1000, inStock: true, url: "", title: "", ...x });

test("one store, or none in stock, is never a verdict", () => {
  assert.equal(judge({ nowCents: 900, stores: 1, medianCents: 900, history: flat(30, 1200) }).verdict, "unclear");
  assert.equal(judge({ nowCents: 0, stores: 3, medianCents: 900, history: flat(30, 1200) }).verdict, "unclear");
});

test("a price too good to be true is a question, not a deal", () => {
  assert.equal(judge({ nowCents: 3000, stores: 4, medianCents: 10000, history: flat(30, 10000) }).verdict, "unclear");
  assert.equal(judge({ nowCents: 4000, stores: 2, medianCents: 4500, tcgCents: 10000, history: [] }).verdict, "unclear");
  assert.equal(judge({ nowCents: 5000, stores: 3, medianCents: 5200, history: flat(30, 10000) }).verdict, "unclear");
});

test("without enough history the best verdict is good, and it says why", () => {
  const r = judge({ nowCents: 8000, stores: 4, medianCents: 10000, history: flat(MIN_HISTORY_DAYS - 1, 10000) });
  assert.equal(r.verdict, "good");
  assert.equal(r.confidence, "low");
  assert.ok(r.reasons.some((x) => /only 13 days/.test(x)));
});

test("genuinely low: lowest in the window, 15%+ under usual, and held a second day", () => {
  const h = [...flat(40, 10000), 8000];
  const r = judge({ nowCents: 8000, stores: 4, medianCents: 8500, history: h });
  assert.equal(r.verdict, "genuine-low");
  assert.equal(r.vsUsualPct, -20);
  assert.equal(r.confidence, "high");
});

test("a first-day dip, or a shallow one, is only good", () => {
  assert.equal(judge({ nowCents: 8000, stores: 4, medianCents: 8500, history: flat(40, 10000) }).verdict, "good");
  assert.equal(judge({ nowCents: 9000, stores: 4, medianCents: 9100, history: [...flat(40, 10000), 9000] }).verdict, "good");
});

test("a price above its usual price is high, near it is typical", () => {
  assert.equal(judge({ nowCents: 11500, stores: 3, medianCents: 11800, history: flat(30, 10000) }).verdict, "high");
  assert.equal(judge({ nowCents: 10000, stores: 3, medianCents: 10500, history: flat(30, 10000) }).verdict, "typical");
});

test("store lows: never eBay, Amazon, TCGplayer, pre-orders or out of stock", () => {
  assert.deepEqual(
    storeLowsByMarket([o({ cents: 900, source: "ebay" }), o({ cents: 800, source: "amazon" }), o({ cents: 700, source: "tcgplayer" }), o({ cents: 600, preorder: true }), o({ cents: 500, inStock: false }), o({ cents: 1200 }), o({ cents: 1100, market: "UK" })]),
    { US: 1200, UK: 1100 },
  );
});

test("store lows are recorded as changes, out of stock is 0, and the daily series skips days before the first point", () => {
  let s = recordLows(undefined, 100, { US: 1000 });
  s = recordLows(s, 101, { US: 1000 }); // unchanged: no new point
  s = recordLows(s, 103, {}); // US out of stock
  s = recordLows(s, 104, { US: 900 });
  assert.deepEqual(s.US, [[100, 1000], [103, 0], [104, 900]]);
  assert.deepEqual(dailyBefore(s.US, 105, 10), [1000, 1000, 1000, 0, 900]);
});
