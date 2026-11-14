// A sealed sister's stores are judged one by one (meta.json `seen`), and the rift sister (Rift Compare): a group's
// TCGplayer id comes from its tcgplayer reference row, per-store freshness from meta.seen.SealedListing.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadSisterOffers, SISTERS, tcgIdOfProductUrl } from "@/lib/import/sisters";

const now = new Date("2026-11-14T06:00:00Z");
const fresh = "2026-11-14T01:00:00Z";
const stale = "2026-11-01T00:00:00Z";

test("a sealed sister skips a store its own import has not read for 72 hours", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sis-"));
  const dir = path.join(root, "mtgcompare");
  fs.mkdirSync(path.join(dir, "data/public"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src/data"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "src/data/stores.json"),
    JSON.stringify([
      { key: "goodshop", name: "Good Shop", base: "https://goodshop.com/", market: "US" },
      { key: "oldshop", name: "Old Shop", base: "https://oldshop.com", market: "US" },
      { key: "newshop", name: "New Shop", base: "https://newshop.com", market: "US" },
    ]),
  );
  // newshop has no `seen` time: it was read with the export, so the export's own time stands.
  fs.writeFileSync(path.join(dir, "data/public/meta.json"), JSON.stringify({ generatedAt: fresh, seen: { goodshop: fresh, oldshop: stale } }));
  fs.writeFileSync(
    path.join(dir, "data/public/products.json"),
    JSON.stringify([{ id: "p1", imageUrl: "https://tcgplayer-cdn.tcgplayer.com/product/500001_in_1000x1000.jpg" }]),
  );
  const offer = (store: string, priceCents: number) => ({ productId: "p1", store, market: "US", url: `https://${store}.com/products/box`, priceCents, inStock: true });
  fs.writeFileSync(path.join(dir, "data/public/offers.json"), JSON.stringify([offer("goodshop", 9999), offer("oldshop", 5000), offer("newshop", 9500)]));
  const r = loadSisterOffers(root, now, SISTERS.filter((s) => s.id === "mtg"));
  assert.equal(r.status.mtg.ok, true);
  assert.deepEqual(r.offers.get(500001)!.map((o) => o.source).sort(), ["goodshop", "newshop"]);
});

test("tcgIdOfProductUrl reads TCGplayer's own product links only", () => {
  assert.equal(tcgIdOfProductUrl("https://www.tcgplayer.com/product/635368/riftbound-origins-booster-display"), 635368);
  assert.equal(tcgIdOfProductUrl("https://tcgplayer.com/product/635368"), 635368);
  assert.equal(tcgIdOfProductUrl("https://evil.example/www.tcgplayer.com/product/635368/x"), null);
  assert.equal(tcgIdOfProductUrl("https://www.tcgplayer.com/search/riftbound/product?q=1"), null);
  assert.equal(tcgIdOfProductUrl(null), null);
});

function riftFixture(meta: object, rows: object[]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sis-"));
  const dir = path.join(root, "TCGEmpire/data/public");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta));
  fs.writeFileSync(path.join(dir, "sealed-listings.json"), JSON.stringify(rows));
  return root;
}

const tcg = (groupKey: string, id: number) => ({
  groupKey,
  title: groupKey,
  retailer: "tcgplayer",
  retailerName: "TCGplayer",
  priceCents: 10000,
  url: `https://www.tcgplayer.com/product/${id}/riftbound-x`,
  inStock: true,
  country: "US",
});
const store = (groupKey: string, o: object = {}) => ({
  groupKey,
  title: "League of Legends Riftbound TCG: Origins Booster Box",
  retailer: "danireon",
  retailerName: "Danireon Cards & Games",
  priceCents: 30800,
  url: "https://www.danireon.com/products/origins-booster-box?variant=1",
  inStock: true,
  country: "US",
  ...o,
});

test("a rift sister's store rows are taken by its TCGplayer row's id, one id per group and one group per id, fresh stores only", () => {
  const rows = [
    tcg("OGN|Booster Box", 635368),
    store("OGN|Booster Box"),
    store("OGN|Booster Box", { retailer: "northshop", retailerName: "North Shop", url: "https://northshop.ca/products/ogn-box", country: "CA", priceCents: 39999, inStock: false }),
    // Marketplaces and references are never stores.
    store("OGN|Booster Box", { retailer: "ebay_us", url: "https://www.ebay.com/itm/1" }),
    store("OGN|Booster Box", { retailer: "ebay", url: "https://www.ebay.com.au/itm/2", country: "AU" }),
    store("OGN|Booster Box", { retailer: "cardmarket", url: "https://www.cardmarket.com/x", country: "EU" }),
    store("OGN|Booster Box", { retailer: "amazon", url: "https://www.amazon.com/dp/B0" }),
    // A stale store, a store with no stamp, no price, no link, a market we do not run.
    store("OGN|Booster Box", { retailer: "oldshop", url: "https://oldshop.com.au/products/box", country: "AU" }),
    store("OGN|Booster Box", { retailer: "nostamp", url: "https://nostamp.com/products/box" }),
    store("OGN|Booster Box", { retailer: "free", priceCents: 0, url: "https://free.com/p" }),
    store("OGN|Booster Box", { retailer: "nolink", url: "/products/box" }),
    store("OGN|Booster Box", { retailer: "jpshop", url: "https://jpshop.jp/p", country: "JP" }),
    // A group with no TCGplayer row prices nothing.
    store("REC|Booster Box", { priceCents: 12000 }),
    // A group naming two ids, and an id two groups name: both ambiguous.
    tcg("SFD|Booster Box", 700001),
    tcg("SFD|Booster Box", 700002),
    store("SFD|Booster Box", { priceCents: 11000 }),
    tcg("LGC|Bundle", 700003),
    tcg("LGC|Bundle Case", 700003),
    store("LGC|Bundle", { priceCents: 5000 }),
    store("LGC|Bundle Case", { priceCents: 25000 }),
  ];
  const seen = { "danireon|US": fresh, "northshop|CA": fresh, "oldshop|AU": stale, "free|US": fresh, "nolink|US": fresh, "jpshop|JP": fresh, "ebay_us|US": fresh };
  const root = riftFixture({ generatedAt: fresh, seen: { SealedListing: seen } }, rows);
  const r = loadSisterOffers(root, now, SISTERS.filter((s) => s.id === "rift"));
  assert.equal(r.status.rift.ok, true);
  assert.deepEqual([...r.offers.keys()], [635368]);
  assert.deepEqual(r.offers.get(635368)!.map((o) => [o.source, o.market, o.currency, o.cents, o.inStock]).sort(), [
    ["danireon", "US", "USD", 30800, true],
    ["northshop", "CA", "CAD", 39999, false],
  ]);
  assert.deepEqual(r.stores.map((s) => [s.key, s.name, s.base, s.market]).sort(), [
    ["danireon", "Danireon Cards & Games", "https://www.danireon.com", "US"],
    ["northshop", "North Shop", "https://northshop.ca", "CA"],
  ]);
  assert.equal(r.status.rift.products, 1);
});

test("a stale rift sister is skipped whole", () => {
  const root = riftFixture({ generatedAt: stale, seen: { SealedListing: { "danireon|US": stale } } }, [tcg("OGN|Booster Box", 635368), store("OGN|Booster Box")]);
  const r = loadSisterOffers(root, now, SISTERS.filter((s) => s.id === "rift"));
  assert.equal(r.status.rift.ok, false);
  assert.equal(r.offers.size, 0);
});

test("the import workflows check out only Rift Compare's sealed listings and meta, non-cone", () => {
  for (const f of [".github/workflows/refresh-prices.yml", ".github/workflows/trial-import.yml"]) {
    const y = fs.readFileSync(f, "utf8");
    const at = y.indexOf("repository: Specifxx/TCGEmpire");
    assert.ok(at > 0, `${f}: TCGEmpire checkout`);
    const end = y.indexOf("\n      - ", at);
    const step = y.slice(at, end > 0 ? end : undefined);
    assert.match(step, /path: sisters\/TCGEmpire/);
    assert.match(step, /data\/public\/sealed-listings\.json/);
    assert.match(step, /data\/public\/meta\.json/);
    assert.match(step, /sparse-checkout-cone-mode: false/);
    assert.doesNotMatch(step, /data\/public\/listings|data\/public\s*(?:\n|\\n|")/, `${f}: never the whole data folder`);
  }
});
