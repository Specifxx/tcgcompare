// Our own crawl of the games no sister covers (lib/import/crawl.ts, crawl-run.ts, polite-http.ts; owner, 2026-11-14).
// A listing is taken only by the TCGplayer id it carries, the matcher only refuses, and the client is polite: robots.txt,
// two stores at a time, a second between requests, a 401/403/429 or challenge stops the store. Everything offline.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SITE } from "../src/site.config";
import { SISTERS } from "../src/lib/import/sisters";
import { buildIndex, type MatchIndex } from "../src/lib/import/match";
import {
  carryCrawl,
  chooseHandles,
  crawlStoreKeys,
  crawlVerdict,
  idsInListing,
  lineOfCollection,
  MAX_HANDLES_PER_STORE,
  pickId,
  pickOffer,
  takeCrawl,
  toListing,
  type CrawlListing,
  type CrawlStore,
  type PickContext,
  type ShopifyListing,
} from "../src/lib/import/crawl";
import { capHandles, mergeProbe, PRODUCT_PAGES, runCrawl, runProbe } from "../src/lib/import/crawl-run";
import { eachStore, isChallenge, parseRobots, RequestBudget, StopStore, StoreSession } from "../src/lib/import/polite-http";
import type { CrawlMeta, Product, SetInfo, StoreConfig } from "../src/lib/site-types";

// ── A small catalogue: two Star Wars: Unlimited products, one Flesh and Blood, one Magic ─────────────────────────────

const set = (id: number, name: string, line: string): SetInfo => ({ id, name, code: "", slug: name.toLowerCase().replace(/\W+/g, "-"), releasedOn: "2026-01-01", productCount: 1, upcoming: false, line });
const prod = (id: number, name: string, setId: number, sealedType: string): Product => ({ id, slug: `p${id}`, name, kind: "sealed", setId, number: null, rarity: null, attrs: {}, sealedType, image: null, tcgUrl: "", printings: ["Normal"] });
const SETS = [set(1, "Legends of the Force", "swu"), set(2, "Rosetta", "fab"), set(3, "Foundations", "mtg")];
const PRODUCTS = [
  prod(612345, "Legends of the Force Booster Box", 1, "Booster Box"),
  prod(612346, "Legends of the Force Booster Pack", 1, "Booster Pack"),
  prod(523456, "Rosetta Booster Box", 2, "Booster Box"),
  prod(554433, "Foundations Play Booster Box", 3, "Booster Box"),
];
const all = new Map(PRODUCTS.map((p) => [p.id, p]));
const lineOfSet = new Map(SETS.map((s) => [s.id, s.line]));
const indexes = new Map<string, MatchIndex>();
const ctx: PickContext = {
  products: all,
  lineOf: (p) => lineOfSet.get(p.setId),
  indexOf: (line) => {
    if (!indexes.has(line)) {
      const ss = SETS.filter((s) => s.line === line);
      indexes.set(line, buildIndex(PRODUCTS.filter((p) => ss.some((s) => s.id === p.setId)), ss, "code"));
    }
    return indexes.get(line)!;
  },
};

const listing = (over: Partial<ShopifyListing> = {}): ShopifyListing => ({
  id: 1,
  title: "Star Wars Unlimited Legends of the Force Booster Box",
  handle: "star-wars-unlimited-legends-of-the-force-booster-box",
  variants: [{ id: 11, title: "Default Title", price: "129.99", available: true, sku: "" }],
  images: [],
  ...over,
});
const crawled = (p: ShopifyListing, lines = ["swu"]): CrawlListing => toListing(p, "https://cards.test", lines);

// ── Ids inside a listing ────────────────────────────────────────────────────

test("the id in the handle is found and taken", () => {
  const l = crawled(listing({ handle: "star-wars-unlimited-legends-of-the-force-booster-box-612345" }));
  assert.deepEqual(l.ids, [{ id: 612345, where: "handle" }]);
  assert.deepEqual(pickId(l, ctx), { id: 612345 });
});

test("the id in TCGplayer's copied photo is found and taken", () => {
  for (const src of ["https://cdn.shopify.com/s/files/1/0001/files/612345_in_1000x1000.jpg?v=17", "https://tcgplayer-cdn.tcgplayer.com/product/612345_200w.jpg"]) {
    const l = crawled(listing({ images: [{ src }] }));
    assert.deepEqual(l.ids, [{ id: 612345, where: "image" }]);
    assert.deepEqual(pickId(l, ctx), { id: 612345 });
  }
});

test("the id in a variant SKU is found and taken; a barcode or a store's own code is not an id", () => {
  for (const sku of ["612345", "TCG-612345", "612345-NM"]) {
    const l = crawled(listing({ variants: [{ id: 1, title: "Default Title", price: "129.99", available: true, sku }] }));
    assert.deepEqual(pickId(l, ctx), { id: 612345 }, sku);
  }
  for (const sku of ["0810091234567", "SWU-LOF-BB", "LOF612345X"]) assert.deepEqual(idsInListing(listing({ variants: [{ id: 1, price: "1", sku }] })), [], sku);
});

test("two catalogue ids in one listing: refused", () => {
  const l = crawled(listing({ handle: "lof-booster-box-612345", images: [{ src: "https://cdn.test/files/612346_in_1000x1000.jpg" }] }));
  assert.equal((pickId(l, ctx) as { refuse: string }).refuse, "two-ids");
});

test("an id of another game, or of a game the listing was not crawled for: refused", () => {
  const mtg = crawled(listing({ title: "Foundations Play Booster Box", handle: "foundations-play-booster-box-554433" }));
  assert.equal((pickId(mtg, ctx) as { refuse: string }).refuse, "other-game");
  const fab = crawled(listing({ title: "Rosetta Booster Box", handle: "rosetta-booster-box-523456" }), ["swu"]);
  assert.equal((pickId(fab, ctx) as { refuse: string }).refuse, "other-game");
  assert.deepEqual(pickId(crawled(listing({ title: "Flesh and Blood Rosetta Booster Box", handle: "rosetta-booster-box-523456" }), ["fab"]), ctx), { id: 523456 });
});

test("no id, or one the catalogue does not hold: refused (the matcher never supplies an id)", () => {
  assert.equal((pickId(crawled(listing()), ctx) as { refuse: string }).refuse, "no-id");
  assert.equal((pickId(crawled(listing({ handle: "lof-box-999999" })), ctx) as { refuse: string }).refuse, "no-id");
});

test("a TCGplayer photo of another product beside the id: refused", () => {
  const l = crawled(listing({ handle: "lof-booster-box-612345", images: [{ src: "https://cdn.test/files/701234_in_1000x1000.jpg" }] }));
  assert.equal((pickId(l, ctx) as { refuse: string }).refuse, "photo-conflict");
});

test("the matcher disagrees, or the title names another kind of product: refused", () => {
  // A shifted handle: the title is the pack, the id is the box.
  const pack = crawled(listing({ title: "Star Wars Unlimited Legends of the Force Booster Pack", handle: "lof-booster-pack-612345" }));
  assert.equal((pickId(pack, ctx) as { refuse: string }).refuse, "type-differs");
  // The kind agrees but the one-game matcher reads another product of the same game.
  const c2: PickContext = {
    ...ctx,
    indexOf: () => ({ ...ctx.indexOf("swu"), sealed: [prod(612399, "Legends of the Force Booster Box", 1, "Booster Box")] }),
  };
  const box = crawled(listing({ handle: "lof-booster-box-612345" }));
  assert.equal((pickId(box, c2) as { refuse: string }).refuse, "matcher-disagrees");
  // A matcher that says nothing does not refuse when TCGplayer's own photo carries the id.
  assert.deepEqual(pickId(crawled(listing({ title: "LOF Booster Box (Sealed)", handle: "lof-612345", images: [{ src: "https://cdn.test/files/612345_in_1000x1000.jpg" }] })), ctx), { id: 612345 });
});

test("a handle or SKU number alone is not proof: the title must name the product or its set", () => {
  // A store's own sequential SKU, or a trailing handle number, that happens to be a same-game product's id.
  const sku = crawled(listing({ title: "Star Wars Unlimited Booster Box", handle: "swu-booster-box", variants: [{ id: 1, title: "Default Title", price: "129.99", available: true, sku: "612345" }] }));
  assert.deepEqual(pickId(sku, ctx), { refuse: "unconfirmed" });
  const handle = crawled(listing({ title: "Star Wars Unlimited Booster Box", handle: "swu-booster-box-612345" }));
  assert.deepEqual(pickId(handle, ctx), { refuse: "unconfirmed" });
  assert.deepEqual(pickId(crawled(listing({ title: "LOF Booster Box (Sealed)", handle: "lof-612345" })), ctx), { refuse: "unconfirmed" });
  // The set named in the title, or TCGplayer's photo of it, confirms it.
  assert.deepEqual(pickId(crawled(listing({ title: "Legends of the Force - Booster Box", handle: "swu-booster-box-612345" })), ctx), { id: 612345 });
  assert.deepEqual(pickId(crawled(listing({ title: "Star Wars Unlimited Booster Box", handle: "swu-booster-box-612345", images: [{ src: "https://cdn.test/files/612345_in_1000x1000.jpg" }] })), ctx), { id: 612345 });
});

test("a handle id and a SKU id that differ: refused, whether or not the catalogue holds both", () => {
  const l = crawled(listing({ handle: "swu-booster-box-999999", variants: [{ id: 1, title: "Default Title", price: "129.99", available: true, sku: "612345" }] }));
  assert.deepEqual(l.ids, [{ id: 999999, where: "handle" }, { id: 612345, where: "sku" }]);
  assert.equal((pickId(l, ctx) as { refuse: string }).refuse, "id-conflict");
  const same = crawled(listing({ handle: "lof-booster-box-612345", variants: [{ id: 1, title: "Default Title", price: "129.99", available: true, sku: "TCG-612345" }] }));
  assert.deepEqual(pickId(same, ctx), { id: 612345 });
});

test("opened, pre-owned, resealed, empty boxes and break spots are not the sealed box", () => {
  for (const tail of ["Booster Box (Opened, 20 packs)", "Booster Box - Open Box", "Booster Box - Pre-Owned", "Booster Box Resealed", "Empty Booster Box", "Booster Box - Box Break Spot", "Booster Box (Missing 2 packs)", "Booster Box Repack"]) {
    const l = crawled(listing({ title: `Legends of the Force ${tail}`, handle: "lof-booster-box-612345" }));
    assert.equal((pickId(l, ctx) as { refuse: string }).refuse, "unfit", tail);
  }
  // Words that merely contain them are fine.
  assert.deepEqual(pickId(crawled(listing({ title: "Legends of the Force Booster Box (Unopened)", handle: "lof-booster-box-612345" })), ctx), { id: 612345 });
});

test("a title naming another quantity, or a lone variant naming another product, is not the single box", () => {
  // A pack count ("(24 packs)") is left alone: most real box listings state theirs, and the catalogue claims none.
  for (const tail of ["Booster Box (6 Boxes)", "Booster Box - Sealed Display of 6", "Half Booster Box", "6 Boxes of Booster Box"]) {
    const l = crawled(listing({ title: `Legends of the Force ${tail}`, handle: "lof-booster-box-612345" }));
    assert.ok("refuse" in pickId(l, ctx), `${tail}: ${JSON.stringify(pickId(l, ctx))}`);
  }
  const pack = crawled(listing({ handle: "lof-booster-box-612345", variants: [{ id: 1, title: "Booster Pack", price: "5.99", available: true }] }));
  assert.equal((pickId(pack, ctx) as { refuse: string }).refuse, "listing");
  const vague = crawled(listing({ title: "Legends of the Force", handle: "lof-612345", variants: [{ id: 1, title: "Booster Pack", price: "5.99", available: true }] }));
  assert.equal((pickId(vague, ctx) as { refuse: string }).refuse, "type-differs");
  assert.deepEqual(pickOffer({ title: "LOF Booster Box", variants: [{ id: 1, title: "x6", price: "700", available: true }] }), { refuse: "variants-differ" });
  // A lone variant that names the same kind is the product.
  assert.deepEqual(pickId(crawled(listing({ handle: "lof-booster-box-612345", variants: [{ id: 1, title: "Sealed Booster Box", price: "129.99", available: true }] })), ctx), { id: 612345 });
});

test("foreign, unfit and multiple listings: refused", () => {
  const cases: [Partial<ShopifyListing>, string][] = [
    [{ title: "Legends of the Force Booster Box (Japanese)", handle: "lof-box-612345" }, "foreign"],
    [{ title: "Legends of the Force Booster Box", handle: "lof-box-jp-612345" }, "foreign"],
    [{ title: "Legends of the Force Booster Box - Damaged", handle: "lof-box-612345" }, "unfit"],
    [{ title: "Legends of the Force Booster Box (Pair)", handle: "lof-box-612345" }, "multiple"],
  ];
  for (const [over, why] of cases) assert.equal((pickId(crawled(listing(over)), ctx) as { refuse: string }).refuse, why, over.title);
});

test("variants: the cheapest available one; a listing whose variants are different products is refused", () => {
  assert.deepEqual(pickOffer({ variants: [
    { id: 1, title: "Near Mint", price: "120.00", available: false },
    { id: 2, title: "Default Title", price: "125.00", available: true },
    { id: 3, title: "Damaged Box", price: "80.00", available: true },
  ] }), { cents: 12500, inStock: true, variantId: 2 });
  assert.deepEqual(pickOffer({ variants: [{ id: 1, title: "Default Title", price: "99", available: false }] }), { cents: 9900, inStock: false, variantId: 1 });
  for (const titles of [["Booster Box", "Booster Pack"], ["Single Box", "Case of 6"], ["1", "x3"]])
    assert.deepEqual(pickOffer({ variants: titles.map((t, i) => ({ id: i, title: t, price: "10", available: true })) }), { refuse: "variants-differ" }, titles.join("/"));
  const l = crawled(listing({ handle: "lof-612345", variants: [{ id: 1, title: "Booster Box", price: "120", available: true }, { id: 2, title: "Booster Pack", price: "5", available: true }] }));
  assert.equal((pickId(l, ctx) as { refuse: string }).refuse, "listing");
});

// ── Into the import ─────────────────────────────────────────────────────────

test("a crawled store keeps the store directory's key; a new one gets its own; offers are one per store and product", () => {
  const known: StoreConfig[] = [{ key: "cards", name: "Cards", base: "https://www.cards.test", market: "US", collections: [], kind: "sealed" }];
  const { keyOf, added } = crawlStoreKeys(known, [
    { key: "cardsx", name: "Cards", base: "https://cards.test", market: "US" },
    { key: "cards", name: "Other", base: "https://other.test", market: "UK" },
  ]);
  assert.equal(keyOf.get("cards.test|US"), "cards");
  assert.deepEqual(added.map((s) => s.key), ["cardsuk"]);
  const l1 = crawled(listing({ handle: "lof-booster-box-612345" }));
  const l2 = { ...l1, cents: 11999, url: "https://cards.test/products/b" };
  const got = takeCrawl({ at: "", budget: 0, requests: 0, stores: [{ host: "cards.test", key: "cardsx", name: "Cards", base: "https://cards.test", market: "US", ok: true, requests: 3, listings: [l1, l2, crawled(listing())] }] }, ctx, keyOf);
  assert.equal(got.offers.get(612345)!.length, 1);
  assert.equal(got.offers.get(612345)![0].cents, 11999);
  assert.equal(got.offers.get(612345)![0].source, "cards");
  assert.equal(got.offers.get(612345)![0].currency, "USD");
  assert.deepEqual(got.refused, { "no-id": 1 });
});

test("a store not read this run keeps its crawled rows for 72 hours after its last good read, never longer", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const prevById = { "612345": { offers: [{ source: "old", market: "US" as const, currency: "USD", cents: 100, inStock: true, url: "", title: "" }] }, "554433": { offers: [{ source: "old", market: "US" as const, currency: "USD", cents: 100, inStock: true, url: "", title: "" }] } };
  const base = { stores: [{ base: "https://cards.test", market: "US" as const }], keyOf: new Map([["cards.test|US", "cards"]]), prevKeyOf: new Map([["cards.test|US", "old"]]), prevById, crawledProduct: (id: number) => id === 612345, now, maxAgeH: 72 };
  const fresh = carryCrawl({ ...base, readOk: new Set(), seen: { "cards.test|US": "2026-11-13T00:00:00Z" } });
  assert.equal(fresh.carried, 1);
  assert.equal(fresh.offers.get(612345)![0].source, "cards");
  assert.equal(carryCrawl({ ...base, readOk: new Set(), seen: { "cards.test|US": "2026-11-10T00:00:00Z" } }).carried, 0);
  assert.equal(carryCrawl({ ...base, readOk: new Set(["cards.test|US"]), seen: { "cards.test|US": "2026-11-14T00:00:00Z" } }).carried, 0);
  // Read in part: the old row is carried only for a product the run gave no fresh row.
  const part = { ...base, readOk: new Set<string>(), seen: { "cards.test|US": "2026-11-13T00:00:00Z" }, crawledProduct: () => true };
  assert.equal(carryCrawl(part).carried, 2);
  const c = carryCrawl({ ...part, fresh: new Map([["cards", new Set([612345])]]) });
  assert.equal(c.carried, 1);
  assert.deepEqual([...c.offers.keys()], [554433]);
});

// ── The probe's words ───────────────────────────────────────────────────────

test("crawl words: only games no sister covers, and a collection names one game or none", () => {
  const sisterLines = new Set(SISTERS.flatMap((s) => s.lines));
  const crawl = (SITE.lines ?? []).filter((l) => l.crawl);
  assert.ok(crawl.length >= 18);
  for (const l of crawl) assert.ok(!sisterLines.has(l.id), `${l.id} is a sister's game`);
  assert.ok(!crawl.some((l) => l.id === "rb"));
  const cases: [string, string, string | null][] = [
    ["weiss-schwarz-sealed", "Weiss Schwarz Sealed", "ws"],
    ["hololive-weiss-schwarz", "Weiß Schwarz hololive", "ws"],
    ["hololive-ocg", "hololive OFFICIAL CARD GAME", "holo"],
    ["fab-sealed", "FaB Sealed", "fab"],
    ["fabulous-finds", "Fabulous finds", null],
    ["star-wars-unlimited", "Star Wars: Unlimited", "swu"],
    ["dragon-ball-super-fusion-world", "Dragon Ball Super Fusion World", null],
    ["mtg-final-fantasy", "Magic Final Fantasy", null],
    ["pokemon-sealed", "Pokemon", null],
  ];
  for (const [handle, title, want] of cases) assert.equal(lineOfCollection({ handle, title }, crawl), want, handle);
  assert.deepEqual(chooseHandles([
    { handle: "swu-singles", title: "SWU Singles", products_count: 5000 },
    { handle: "star-wars-unlimited", title: "Star Wars Unlimited", products_count: 300 },
    { handle: "swu-sealed", title: "SWU Sealed", products_count: 40 },
    { handle: "swu-empty", title: "SWU", products_count: 0 },
  ]), ["swu-sealed", "star-wars-unlimited"]);
});

// ── The polite client ───────────────────────────────────────────────────────

type Route = { status?: number; body?: unknown; headers?: Record<string, string> };
function fakeNet(routes: Record<string, Route>) {
  const log: { url: string; at: number; ua: string }[] = [];
  let clock = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const hosts = new Map<string, number>();
  let maxHosts = 0;
  const f = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    inFlight++;
    hosts.set(u.host, (hosts.get(u.host) ?? 0) + 1);
    maxInFlight = Math.max(maxInFlight, hosts.get(u.host)!);
    maxHosts = Math.max(maxHosts, [...hosts.values()].filter((n) => n > 0).length);
    log.push({ url, at: clock, ua: String((init?.headers as Record<string, string>)["User-Agent"]) });
    await new Promise((r) => setImmediate(r));
    inFlight--;
    hosts.set(u.host, hosts.get(u.host)! - 1);
    const key = Object.keys(routes).find((k) => url === k || url.startsWith(`${k}?`) || (k.endsWith("*") && url.startsWith(k.slice(0, -1))));
    const r = key ? routes[key] : { status: 404, body: "not found" };
    const body = typeof r.body === "string" ? r.body : JSON.stringify(r.body ?? {});
    return new Response(body, { status: r.status ?? 200, headers: r.headers ?? { "content-type": typeof r.body === "string" ? "text/html" : "application/json" } });
  }) as unknown as typeof fetch;
  return {
    f,
    log,
    sleep: async (ms: number) => {
      clock += ms;
    },
    now: () => clock,
    stats: () => ({ maxInFlight, maxHosts }),
  };
}

test("robots.txt: our group, else *; wildcards and $; the longest rule wins", () => {
  const allows = parseRobots(["User-agent: *", "Disallow: /cart", "Disallow: /collections/*sort_by*", "Allow: /collections/x/products.json$", "Disallow: /collections/x/"].join("\n"));
  assert.equal(allows("/cart.js?country=US"), false);
  assert.equal(allows("/meta.json"), true);
  assert.equal(allows("/collections/a/products.json?sort_by=price"), false);
  assert.equal(allows("/collections/x/products.json"), true);
  assert.equal(allows("/collections/x/products.json?page=2"), false);
  const ours = parseRobots("User-agent: *\nDisallow:\n\nUser-agent: tcgprices\nDisallow: /collections\n");
  assert.equal(ours("/collections.json"), false);
  assert.equal(ours("/meta.json"), true);
});

test("a path robots.txt disallows is never asked for", async () => {
  const net = fakeNet({
    "https://a.test/robots.txt": { body: "User-agent: *\nDisallow: /collections/\n", headers: { "content-type": "text/plain" } },
    "https://a.test/meta.json": { body: { currency: "USD" } },
  });
  const s = new StoreSession("https://a.test", { fetch: net.f, sleep: net.sleep, now: net.now, budget: new RequestBudget(100), perStoreCap: 10 });
  assert.equal(await s.getJson("/collections/swu/products.json?limit=250&page=1"), null);
  assert.deepEqual(await s.getJson("/meta.json"), { currency: "USD" });
  assert.deepEqual(net.log.map((x) => new URL(x.url).pathname), ["/robots.txt", "/meta.json"]);
  assert.match(net.log[0].ua, /tcgprices\.app/);
});

test("a 403, a 429 or a challenge page stops the store with no retry; a missing robots.txt allows all", async () => {
  for (const [route, reason] of [
    [{ status: 403, body: "Forbidden" }, "blocked"],
    [{ status: 429, body: "slow down" }, "blocked"],
    [{ status: 503, body: "<html><title>Just a moment...</title><script src='/cdn-cgi/challenge-platform/x'></script></html>" }, "challenge"],
    [{ status: 200, body: "<html><div class='g-recaptcha'></div></html>" }, "challenge"],
  ] as [Route, string][]) {
    const net = fakeNet({ "https://a.test/meta.json": route });
    const s = new StoreSession("https://a.test", { fetch: net.f, sleep: net.sleep, now: net.now, budget: new RequestBudget(100), perStoreCap: 10 });
    await assert.rejects(s.getJson("/meta.json"), (e: unknown) => e instanceof StopStore && e.reason === reason);
    await assert.rejects(s.getJson("/collections.json"), StopStore);
    assert.equal(net.log.filter((x) => x.url.includes("/meta.json")).length, 1, "no retry");
    assert.equal(net.log.length, 2, "robots.txt (404) + the one request");
  }
  assert.ok(isChallenge(403, new Headers({ "cf-mitigated": "challenge" }), ""));
  assert.ok(!isChallenge(200, new Headers({ "content-type": "application/json" }), '{"products":[{"title":"captcha"}]}'));
});

test("one request at a time per store, a second apart; the run's budget and the store's cap hold", async () => {
  const net = fakeNet({ "https://a.test/x*": { body: { ok: 1 } } });
  const budget = new RequestBudget(4);
  const s = new StoreSession("https://a.test", { fetch: net.f, sleep: net.sleep, now: net.now, budget, perStoreCap: 10 });
  const got = await Promise.allSettled([1, 2, 3, 4, 5].map((n) => s.getJson(`/x${n}`)));
  assert.equal(net.log.length, 4);
  assert.equal(budget.used, 4);
  assert.deepEqual(got.map((g) => g.status), ["fulfilled", "fulfilled", "fulfilled", "rejected", "rejected"]);
  for (let i = 1; i < net.log.length; i++) assert.ok(net.log[i].at - net.log[i - 1].at >= 1000, "a second between requests");
  assert.equal(net.stats().maxInFlight, 1);
  const capped = new StoreSession("https://a.test", { fetch: net.f, sleep: net.sleep, now: net.now, budget: new RequestBudget(100), perStoreCap: 2 });
  await capped.getJson("/x1");
  await assert.rejects(capped.getJson("/x2"), (e: unknown) => e instanceof StopStore && e.reason === "store-cap");
});

test("exactly two stores at a time", async () => {
  let live = 0;
  let most = 0;
  await eachStore([1, 2, 3, 4, 5, 6], async () => {
    live++;
    most = Math.max(most, live);
    await new Promise((r) => setTimeout(r, 2));
    live--;
  });
  assert.equal(most, 2);
});

// ── The run, end to end on fixtures ─────────────────────────────────────────

const entry = (host: string, market: "US" | "UK", handles: string[], line = "swu"): CrawlStore => ({ host, key: host.split(".")[0], name: host, base: `https://${host}`, market, line, handles, probedAt: "2026-11-14T00:00:00Z" });

test("the crawl reads each store's collections, skips a store whose currency is not its market's, and stops a blocked one", async () => {
  const products = [listing({ id: 1, handle: "lof-booster-box-612345" }), listing({ id: 2, handle: "random" })];
  const net = fakeNet({
    "https://good.test/meta.json": { body: { currency: "USD" } },
    "https://good.test/collections/swu-sealed/products.json": { body: { products } },
    "https://wrong.test/meta.json": { body: { currency: "USD" } },
    "https://wrong.test/collections/swu/products.json": { body: { products } },
    "https://shut.test/meta.json": { status: 429, body: "no" },
    "https://more.test/meta.json": { body: { currency: "USD" } },
  });
  const run = await runCrawl([entry("good.test", "US", ["swu-sealed"]), entry("wrong.test", "UK", ["swu"]), entry("shut.test", "US", ["swu"]), entry("more.test", "US", ["none"])], {
    fetch: net.f,
    sleep: net.sleep,
    now: net.now,
    budget: 100,
    perStoreCap: 40,
  });
  const by = new Map(run.stores.map((s) => [s.host, s]));
  assert.equal(by.get("good.test")!.ok, true);
  assert.equal(by.get("good.test")!.listings.length, 2);
  assert.match(by.get("wrong.test")!.reason!, /currency-mismatch/);
  assert.equal(net.log.filter((x) => x.url.startsWith("https://wrong.test/collections")).length, 0, "no product page asked of a store in the wrong currency");
  assert.match(by.get("shut.test")!.reason!, /^blocked/);
  assert.equal(net.log.filter((x) => x.url.startsWith("https://shut.test")).length, 2);
  assert.equal(by.get("more.test")!.ok, true);
  assert.ok(net.stats().maxHosts <= 2, "never more than two stores at once");
  const { keyOf } = crawlStoreKeys([], run.stores);
  const got = takeCrawl(run, ctx, keyOf);
  assert.equal(got.taken, 1);
  assert.deepEqual([...got.offers.keys()], [612345]);
});

test("the run's budget is respected across stores", async () => {
  const net = fakeNet({ "https://*": { body: { currency: "USD" } } });
  const f = (async (u: string, i?: RequestInit) => net.f(u.replace(/^https:\/\/[^/]+/, "https://*"), i)) as unknown as typeof fetch;
  const entries = Array.from({ length: 10 }, (_, i) => entry(`s${i}.test`, "US", ["a", "b"]));
  const run = await runCrawl(entries, { fetch: f, sleep: net.sleep, now: net.now, budget: 9, perStoreCap: 40 });
  assert.equal(run.requests, 9);
  assert.ok(net.log.length <= 9);
  assert.ok(run.stores.some((s) => /^budget/.test(s.reason ?? "")));
});

test("the probe keeps only collections that name a crawled game; a blocked store leaves the list", async () => {
  const net = fakeNet({
    "https://a.test/collections.json": { body: { collections: [{ handle: "swu-sealed", title: "SWU Sealed", products_count: 12 }, { handle: "pokemon", title: "Pokemon", products_count: 99 }, { handle: "grand-archive", title: "Grand Archive", products_count: 7 }] } },
    "https://b.test/collections.json": { status: 403, body: "no" },
  });
  const r = await runProbe(
    [{ key: "a", name: "A", base: "https://a.test", market: "US" }, { key: "b", name: "B", base: "https://b.test", market: "US" }],
    SITE.lines ?? [],
    { fetch: net.f, sleep: net.sleep, now: net.now, budget: 100, perStoreCap: 6 },
  );
  assert.deepEqual(r.entries.map((e) => [e.line, e.handles]), [["ga", ["grand-archive"]], ["swu", ["swu-sealed"]]]);
  const merged = mergeProbe([entry("b.test", "US", ["old"]), entry("c.test", "US", ["kept"])], r);
  assert.deepEqual(merged.map((e) => e.host).sort(), ["a.test", "a.test", "c.test"]);
});

test("the crawl is a no-op with no store list, and the ops check reads its meta", () => {
  const src = fs.readFileSync("scripts/crawl-uncovered.ts", "utf8");
  assert.match(src, /empty or missing: nothing to read/);
  const meta = (c: Partial<CrawlMeta>): { crawl: CrawlMeta } => ({ crawl: { at: "2026-11-14T00:00:00Z", ran: true, listed: 3, stores: 3, read: 2, stopped: { blocked: 1 }, requests: 50, budget: 6000, listings: 400, taken: 30, refused: {}, offers: 28, carried: 0, seen: {}, ...c } });
  const now = Date.parse("2026-11-14T06:00:00Z");
  assert.equal(crawlVerdict(meta({}), 3, now).status, "ok");
  assert.equal(crawlVerdict(meta({ read: 0 }), 3, now).status, "fail");
  assert.equal(crawlVerdict(meta({ at: "2026-11-11T00:00:00Z" }), 3, now).status, "fail");
  assert.equal(crawlVerdict({}, 3, now).status, "fail");
  assert.equal(crawlVerdict(meta({ ran: false }), 3, now).status, "warn");
  assert.match(fs.readFileSync("scripts/ops-monitor.ts", "utf8"), /crawlVerdict\(/);
  for (const wf of [".github/workflows/refresh-prices.yml", ".github/workflows/trial-import.yml"]) {
    const y = fs.readFileSync(wf, "utf8");
    assert.ok(y.indexOf("scripts/crawl-uncovered.ts") > 0 && y.indexOf("scripts/crawl-uncovered.ts") < y.indexOf("scripts/import-all.ts"), `${wf}: the crawl runs before the import`);
  }
  assert.doesNotMatch(fs.readFileSync(".github/workflows/crawl-probe.yml", "utf8"), /\[deploy\]/);
});

// ── One shop, many markets; partial and failed reads ────────────────────────

test("a shop listed in two markets is one session: one robots.txt, one request at a time, a second apart", async () => {
  const net = fakeNet({
    "https://two.test/robots.txt": { body: "User-agent: *\nDisallow: /checkout\n", headers: { "content-type": "text/plain" } },
    "https://two.test/meta.json": { body: { currency: "USD" } },
    "https://two.test/collections/swu/products.json": { body: { products: [listing({ id: 1, handle: "lof-booster-box-612345" })] } },
    "https://other.test/meta.json": { body: { currency: "USD" } },
  });
  // A UK entry on the same host (the fake answers USD, so it is skipped for its currency, after asking).
  const run = await runCrawl([entry("two.test", "US", ["swu"]), { ...entry("two.test", "UK", ["swu"]), key: "twouk" }, entry("other.test", "US", ["x"])], {
    fetch: net.f,
    sleep: net.sleep,
    now: net.now,
    budget: 100,
    perStoreCap: 40,
  });
  assert.equal(net.stats().maxInFlight, 1, "never two requests in flight at one shop");
  assert.equal(net.log.filter((x) => x.url === "https://two.test/robots.txt").length, 1);
  const two = net.log.filter((x) => x.url.startsWith("https://two.test"));
  for (let i = 1; i < two.length; i++) assert.ok(two[i].at - two[i - 1].at >= 1000, "a second apart across markets");
  assert.equal(run.stores.find((s) => s.key === "two")!.ok, true);
  assert.match(run.stores.find((s) => s.key === "twouk")!.reason!, /currency-mismatch/);
  // The probe asks a two-market shop once, and lists it for both markets.
  const pnet = fakeNet({ "https://two.test/collections.json": { body: { collections: [{ handle: "swu-sealed", title: "SWU Sealed", products_count: 3 }] } } });
  const r = await runProbe([{ key: "two", name: "Two", base: "https://two.test", market: "US" }, { key: "twouk", name: "Two", base: "https://two.test", market: "UK" }], SITE.lines ?? [], { fetch: pnet.f, sleep: pnet.sleep, now: pnet.now, budget: 100, perStoreCap: 6 });
  assert.equal(pnet.log.filter((x) => x.url.includes("/collections.json")).length, 1);
  assert.deepEqual(r.entries.map((e) => e.market).sort(), ["UK", "US"]);
  assert.equal(r.probed.size, 2);
});

test("a store stopped by its cap keeps the collections it read to the end, marked partial", async () => {
  const full = Array.from({ length: 250 }, (_, i) => listing({ id: 1000 + i, handle: `p-${i}` }));
  const net = fakeNet({
    "https://cap.test/meta.json": { body: { currency: "USD" } },
    "https://cap.test/collections/a/products.json": { body: { products: [listing({ id: 1, handle: "lof-booster-box-612345" })] } },
    "https://cap.test/collections/b/products.json*": { body: { products: full } },
  });
  const run = await runCrawl([entry("cap.test", "US", ["a", "b"])], { fetch: net.f, sleep: net.sleep, now: net.now, budget: 100, perStoreCap: 5 });
  const s = run.stores[0];
  assert.equal(s.ok, false);
  assert.equal(s.partial, true);
  assert.match(s.reason!, /^store-cap/);
  assert.equal(s.listings.length, 1, "collection a kept, the unfinished b left out");
  const { keyOf } = crawlStoreKeys([], run.stores);
  const got = takeCrawl(run, ctx, keyOf);
  assert.deepEqual([...got.offers.keys()], [612345]);
  assert.deepEqual([...got.fresh.get("cap")!], [612345]);
});

test("a failed collection page (5xx, timeout, bad JSON) is not a read: the store is not ok; a 404 is an honest nothing", async () => {
  const good = { body: { products: [listing({ id: 1, handle: "lof-booster-box-612345" })] } };
  for (const bad of [{ status: 503, body: "oops", headers: { "content-type": "text/plain" } }, { status: 200, body: "<p>maintenance</p>", headers: { "content-type": "text/plain" } }] as Route[]) {
    const net = fakeNet({ "https://f.test/meta.json": { body: { currency: "USD" } }, "https://f.test/collections/a/products.json": good, "https://f.test/collections/b/products.json": bad });
    const run = await runCrawl([entry("f.test", "US", ["a", "b"])], { fetch: net.f, sleep: net.sleep, now: net.now, budget: 100, perStoreCap: 40 });
    assert.equal(run.stores[0].ok, false);
    assert.equal(run.stores[0].partial, true);
    assert.match(run.stores[0].reason!, /^errors: 1 of 2 collections failed \(b\)/);
    assert.equal(run.stores[0].listings.length, 1);
  }
  // Every collection times out: not ok, nothing partial (its rows are carried).
  const net = fakeNet({ "https://t.test/meta.json": { body: { currency: "USD" } } });
  const f = (async (u: string, i?: RequestInit) => {
    if (u.includes("/collections/")) throw new Error("timeout");
    return net.f(u, i);
  }) as unknown as typeof fetch;
  const run = await runCrawl([entry("t.test", "US", ["a", "b"])], { fetch: f, sleep: net.sleep, now: net.now, budget: 100, perStoreCap: 40 });
  assert.equal(run.stores[0].ok, false);
  assert.ok(!run.stores[0].partial);
  assert.match(run.stores[0].reason!, /^errors/);
  // A 404 collection is read: nothing there.
  const n404 = fakeNet({ "https://n.test/meta.json": { body: { currency: "USD" } } });
  const r404 = await runCrawl([entry("n.test", "US", ["gone"])], { fetch: n404.f, sleep: n404.sleep, now: n404.now, budget: 100, perStoreCap: 40 });
  assert.equal(r404.stores[0].ok, true);
});

test("the probe keeps at most MAX_HANDLES_PER_STORE collections a store, games taking turns", () => {
  const got = capHandles([
    { line: "a", handles: ["a1", "a2", "a3", "a4"] },
    { line: "b", handles: ["b1", "b2", "b3", "b4"] },
    { line: "c", handles: ["c1"] },
  ]);
  // Round 1: a1 b1 c1; round 2: a2 b2; round 3: a3 b3; round 4: a4 (8 in all).
  assert.deepEqual(got, [{ line: "a", handles: ["a1", "a2", "a3", "a4"] }, { line: "b", handles: ["b1", "b2", "b3"] }, { line: "c", handles: ["c1"] }]);
  assert.equal(got.flatMap((x) => x.handles).length, MAX_HANDLES_PER_STORE);
  assert.ok(PRODUCT_PAGES * MAX_HANDLES_PER_STORE + 3 <= 40, "a full read fits under CRAWL_STORE_CAP");
});

// ── Own-list shops: a listing with no id is taken by title, strictly ────────

test("pickByTitle: one product, its own type, in stock, in the price band; anything doubtful is no match", async () => {
  const { pickByTitle } = await import("../src/lib/import/crawl");
  const band = (id: number, cents: number) => id === 612345 && cents >= 7800 && cents <= 20800;
  const c: PickContext = { ...ctx, inBand: band };
  const l = (over: Partial<ShopifyListing> = {}) => crawled(listing(over));
  assert.deepEqual(pickByTitle(l(), c, "US"), { id: 612345 });
  // no market price / price outside the band / out of stock
  assert.equal("refuse" in pickByTitle(l({ variants: [{ id: 11, title: "Default Title", price: "29.99", available: true }] }), c, "US"), true);
  assert.equal("refuse" in pickByTitle(l({ variants: [{ id: 11, title: "Default Title", price: "129.99", available: false }] }), c, "US"), true);
  // another TCGplayer-shaped id, a case, a pack for a box, opened
  assert.equal("refuse" in pickByTitle(l({ handle: "x-999999" }), c, "US"), true);
  assert.equal("refuse" in pickByTitle(l({ title: "Star Wars Unlimited Legends of the Force Booster Box (6 Boxes)" }), c, "US"), true);
  assert.equal("refuse" in pickByTitle(l({ title: "Star Wars Unlimited Legends of the Force Booster Box Opened" }), c, "US"), true);
  // a handle that names another kind than the title (a box handle under a pack title) is two readings
  assert.equal("refuse" in pickByTitle(l({ title: "Star Wars Unlimited Legends of the Force Booster Pack", handle: "star-wars-unlimited-legends-of-the-force-booster-box-sealed-copy" }), c, "US"), true);
  // never without the band callback
  assert.equal("refuse" in pickByTitle(l(), ctx, "US"), true);
  // takeCrawl uses it only for an own store
  const run = (own: boolean) => ({ at: "", budget: 0, requests: 0, stores: [{ ...(own ? { own: true } : {}), host: "cards.test", key: "cards", name: "Cards", base: "https://cards.test", market: "US" as const, ok: true, requests: 1, listings: [l()] }] });
  const keyOf = new Map([["cards.test|US", "cards"]]);
  assert.equal(takeCrawl(run(true), c, keyOf).taken, 1);
  assert.equal(takeCrawl(run(true), c, keyOf).titled, 1);
  assert.equal(takeCrawl(run(false), c, keyOf).taken, 0);
});
