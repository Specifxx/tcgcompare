import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  dropEvents,
  dropId,
  dropMessage,
  MAX_POSTS,
  eligible,
  embedFor,
  emptySniperState,
  judgeLive,
  productPath,
  rankEvents,
  recordPosted,
  restockEvents,
  telegramText,
  type SniperProduct,
  type SniperStore,
  type Tuple,
} from "@/lib/sniper";

const fx = { USD: 1, AUD: 1.5, CAD: 1.4, EUR: 0.9, GBP: 0.75, SGD: 1.3 };
const box: SniperProduct = { id: 1, slug: "some-booster-box", name: "Some Booster Box", sealedType: "Booster Box", image: null, line: "pkm", marketCents: 10000 };
const pack: SniperProduct = { ...box, id: 2, slug: "pack", sealedType: "Booster Pack" };
const ygo: SniperProduct = { ...box, id: 3, slug: "ygo-box", line: "ygo" };
const products = new Map([box, pack, ygo].map((p) => [p.id, p]));
const us: SniperStore = { key: "shopus", name: "Shop US", base: "https://shop-us.example", market: "US" };
const au: SniperStore = { key: "shopau", name: "Shop AU", base: "https://shop-au.example", market: "AU" };
const stores = new Map([us, au].map((s) => [s.key, s]));
const at = "2026-11-19T09:47:00.000Z";
const NOW = Date.parse(at);

test("only the five games' headline sealed products with a real market price are eligible", () => {
  assert.equal(eligible(box), true);
  assert.equal(eligible(pack), false, "loose packs are noise");
  assert.equal(eligible(ygo), false, "not one of the five games");
  assert.equal(eligible({ ...box, marketCents: 1000 }), false, "under US$25");
  assert.equal(eligible({ ...box, marketCents: null }), false);
});

test("a restock is this run's event, inside the price band, with its variant ref", () => {
  const ev = restockEvents({
    events: [
      { p: 1, s: "shopus", c: 11000, r: "box", t: at },
      { p: 1, s: "shopau", c: 30000, r: "box", t: at }, // A$300 = US$200, twice market: a wrong match or a scalper
      { p: 1, s: "shopus", c: 9000, r: "box", t: "2026-11-18T21:37:00.000Z" }, // an older run
      { p: 2, s: "shopus", c: 500, r: "pack", t: at },
    ],
    at,
    products,
    stores,
    fx,
    offers: () => [["shopus", 11000, 1, "box?variant=7"]] as Tuple[],
  });
  assert.equal(ev.length, 1);
  assert.equal(ev[0].ref, "box?variant=7");
  assert.equal(ev[0].store.key, "shopus");
});

test("a drop is the market's cheapest in-stock store price falling 10%+, never a pre-order, never far under market", () => {
  const prev = { "1": { o: [["shopus", 10000, 1, "a?variant=1"], ["tcgplayer", 9000, 1, "https://tcgplayer"]] as Tuple[] } };
  const cur = (cents: number, flags = 1) => ({ "1": { o: [["shopus", cents, flags, "a?variant=1"], ["tcgplayer", 8000, 1, "https://tcgplayer"]] as Tuple[] } });
  assert.equal(dropEvents({ prev, cur: cur(8500), products, stores, fx }).length, 1);
  assert.equal(dropEvents({ prev, cur: cur(8500), products, stores, fx })[0].kind, "drop");
  assert.equal(dropEvents({ prev, cur: cur(9500), products, stores, fx }).length, 0, "5% is not a drop");
  assert.equal(dropEvents({ prev, cur: cur(4000), products, stores, fx }).length, 0, "40% of market is not a deal, it is a wrong price");
  assert.equal(dropEvents({ prev, cur: cur(8500, 3), products, stores, fx }).length, 0, "a pre-order");
  assert.equal(dropEvents({ prev: undefined, cur: cur(8500), products, stores, fx }).length, 0);
});

test("dedupe: a store's restock once per cooldown; a drop again only a further 5% lower or after its cooldown", () => {
  const [r] = restockEvents({ events: [{ p: 1, s: "shopus", c: 11000, r: "box", t: at }], at, products, stores, fx, offers: () => [] });
  const s1 = recordPosted(emptySniperState(), [r], NOW);
  assert.equal(rankEvents([r], s1, NOW + 86_400_000).length, 0);
  assert.equal(rankEvents([r], s1, NOW + 4 * 86_400_000).length, 1);
  const d = { kind: "drop" as const, product: box, store: us, cents: 9000, ref: "a", was: 10000, pct: 10 };
  const s2 = recordPosted(emptySniperState(), [d], NOW);
  assert.equal(rankEvents([d], s2, NOW + 86_400_000).length, 0);
  assert.equal(rankEvents([{ ...d, cents: 8500 }], s2, NOW + 86_400_000).length, 1);
});

test("one post per product a run, restocks before drops", () => {
  const r = { kind: "restock" as const, product: box, store: au, cents: 15000, ref: "a" };
  const d = { kind: "drop" as const, product: box, store: us, cents: 9000, ref: "a", was: 10000, pct: 10 };
  const ranked = rankEvents([d, r], emptySniperState(), NOW);
  assert.deepEqual(ranked.map((e) => e.kind), ["restock"]);
});

test("the live check: available, the same variant, no dearer than ours", () => {
  const js = { variants: [{ id: 7, available: true, price: 10999 }, { id: 8, available: false, price: 9000 }] };
  assert.deepEqual(judgeLive(js, "7", 11000), { ok: true, cents: 10999 });
  assert.equal(judgeLive(js, "8", 9000).ok, false, "sold out now");
  assert.equal(judgeLive(js, "9", 9000).ok, false, "variant gone");
  assert.equal(judgeLive(js, "7", 9000).ok, false, "dearer now");
  assert.deepEqual(judgeLive(js, null, 11000), { ok: true, cents: 10999 }, "no variant: the cheapest available one");
  assert.equal(judgeLive(null, "7", 11000).ok, false, "no answer, no post");
  assert.equal(judgeLive({ variants: [] }, null, 11000).ok, false);
});

test("product paths: a handle or a URL on the store's own host only", () => {
  assert.deepEqual(productPath("box-1?variant=7", "https://shop-us.example"), { handle: "box-1", variant: "7" });
  assert.deepEqual(productPath("https://www.shop-us.example/products/box-1", "https://shop-us.example"), { handle: "box-1", variant: null });
  assert.equal(productPath("https://elsewhere.example/products/box-1", "https://shop-us.example"), null);
  assert.equal(productPath("https://shop-us.example/MTG-Box/WOCD6426-BOX", "https://shop-us.example"), null);
});

test("the post: the live price in the store's own currency, a live 'checked' timestamp, a tagged link to our page", () => {
  const r = { kind: "restock" as const, product: box, store: au, cents: 15000, ref: "a" };
  const em = embedFor(r, 14999, NOW, "https://tcgprices.app");
  assert.match(em.description, /A\$149\.99/);
  assert.match(em.description, new RegExp(`<t:${NOW / 1000}:R>`));
  assert.equal(em.url, "https://tcgprices.app/card/some-booster-box?utm_source=discord&utm_medium=social&utm_campaign=sealed-sniper");
  assert.doesNotMatch(JSON.stringify(em), /ebay/i, "no eBay price, no eBay link of our own");
});

test("the script checks the store before every post and never calls eBay", () => {
  const src = fs.readFileSync("scripts/sniper.ts", "utf8");
  assert.match(src, /judgeLive\(/);
  assert.match(src, /StoreSession/);
  assert.doesNotMatch(src, /ebay/i);
  const wf = fs.readFileSync(".github/workflows/refresh-prices.yml", "utf8");
  assert.match(wf, /scripts\/sniper\.ts/);
  assert.ok(wf.indexOf("scripts/sniper.ts") < wf.indexOf("Commit data"), "runs before the data commit, so HEAD is the previous prices");
});

test("one run is one drop: one message with every post, each link tagged with the drop", () => {
  const r = { kind: "restock" as const, product: box, store: au, cents: 15000, ref: "a" };
  const drop = dropId(Date.UTC(2026, 10, 20, 21, 37));
  assert.equal(drop, "sniper-2026112021");
  const em = embedFor(r, 14999, NOW, "https://tcgprices.app", drop);
  assert.match(em.url, /&utm_content=sniper-2026112021$/);
  const m = dropMessage([em, em]);
  assert.equal(m.embeds.length, 2);
  assert.match(m.content, /2 deals/);
  assert.deepEqual(m.allowed_mentions, { parse: [] });
  assert.ok(MAX_POSTS <= 10, "Discord takes at most 10 embeds in one message");
  const src = fs.readFileSync("scripts/sniper.ts", "utf8");
  assert.equal((src.match(/await post\(/g) ?? []).length, 1, "the script posts once a run");
});

test("Telegram gets the same drop as one plain message: no Discord markup, links tagged telegram, under 4,096 characters", () => {
  const r = { kind: "restock" as const, product: box, store: au, cents: 15000, ref: "a" };
  const em = embedFor(r, 14999, NOW, "https://tcgprices.app", "sniper-2026112021");
  const t = telegramText([em, em]);
  assert.match(t, /^Sealed Sniper drop: 2 deals/);
  assert.doesNotMatch(t, /\*\*|<t:|\]\(/);
  assert.match(t, /at 09:47 UTC/);
  assert.match(t, /utm_source=telegram&.*utm_content=sniper-2026112021/);
  assert.doesNotMatch(t, /utm_source=discord/);
  assert.ok(telegramText(Array.from({ length: 10 }, () => ({ ...em, description: em.description + "x".repeat(900) }))).length <= 4096);
  const src = fs.readFileSync("scripts/sniper.ts", "utf8");
  assert.equal((src.match(/await postTelegram\(/g) ?? []).length, 1, "one Telegram message a run");
  const wf = fs.readFileSync(".github/workflows/refresh-prices.yml", "utf8");
  assert.match(wf, /TELEGRAM_BOT_TOKEN: \$\{\{ secrets\.TELEGRAM_BOT_TOKEN \}\}/);
});
