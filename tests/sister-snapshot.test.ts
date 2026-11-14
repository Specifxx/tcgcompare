// A snapshot sister (OP Compare): sealed ids are TCGplayer's, offers sit in o/<range>.json.gz, stores in a TS list.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { loadSisterOffers, snapshotRange, SISTERS } from "@/lib/import/sisters";

const gz = (v: unknown) => gzipSync(Buffer.from(JSON.stringify(v)));

test("a snapshot sister's store rows are taken by product id, sealed, fresh and in the market's own currency only", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sis-"));
  const snap = path.join(root, "OpCompare-snapshot");
  fs.mkdirSync(path.join(snap, "o"), { recursive: true });
  fs.mkdirSync(path.join(root, "OpCompare/src/lib"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "OpCompare/src/lib/stores.ts"),
    `export const STORES = [\n  { key: "goodshop", name: "Good Shop", base: "https://goodshop.com/", country: "US", collections: ["x"] },\n  { key: "northshop", name: "North Shop", base: "https://northshop.ca", country: "CA", collections: [] },\n];\n`,
  );
  const now = new Date("2026-11-14T06:00:00Z");
  const at = "2026-11-14T00:30:00Z";
  fs.writeFileSync(path.join(snap, "meta.json"), JSON.stringify({ lastImportAt: at }));
  fs.writeFileSync(path.join(snap, "sealed.json.gz"), gz([{ id: 704756 }]));
  const row = (o: object) => ({ source: "store:goodshop", market: "US", priceCents: 9999, currency: "USD", url: "https://goodshop.com/products/box", inStock: true, condition: null, updatedAt: at, ...o });
  assert.equal(snapshotRange(704756), "688");
  fs.writeFileSync(
    path.join(snap, "o", "688.json.gz"),
    gz({
      "704756": [
        row({}),
        row({ source: "store:northshop", market: "CA", currency: "CAD", priceCents: 13999, url: "https://northshop.ca/products/box", inStock: false }),
        row({ source: "tcgplayer", priceCents: 9000 }),
        row({ source: "ebay", priceCents: 8000 }),
        row({ source: "store:unknown", priceCents: 100 }),
        row({ source: "store:northshop", market: "CA", currency: "USD", priceCents: 5000 }),
        row({ priceCents: 1, condition: "NM" }),
        row({ priceCents: 2, updatedAt: "2026-11-01T00:00:00Z" }),
      ],
      // A card of the same range: not in sealed.json.gz, never read.
      "704757": [row({ priceCents: 5 })],
    }),
  );
  const r = loadSisterOffers(root, now, SISTERS.filter((s) => s.id === "op"));
  assert.equal(r.status.op.ok, true);
  assert.deepEqual([...r.offers.keys()], [704756]);
  const rows = r.offers.get(704756)!;
  assert.deepEqual(rows.map((o) => [o.source, o.market, o.currency, o.cents, o.inStock]).sort(), [
    ["goodshop", "US", "USD", 9999, true],
    ["northshop", "CA", "CAD", 13999, false],
  ]);
  assert.deepEqual(r.stores.map((s) => s.base).sort(), ["https://goodshop.com", "https://northshop.ca"]);
});

test("a stale snapshot is skipped whole", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sis-"));
  const snap = path.join(root, "OpCompare-snapshot");
  fs.mkdirSync(path.join(snap, "o"), { recursive: true });
  fs.mkdirSync(path.join(root, "OpCompare/src/lib"), { recursive: true });
  fs.writeFileSync(path.join(root, "OpCompare/src/lib/stores.ts"), "");
  fs.writeFileSync(path.join(snap, "meta.json"), JSON.stringify({ lastImportAt: "2026-11-01T00:00:00Z" }));
  fs.writeFileSync(path.join(snap, "sealed.json.gz"), gz([]));
  const r = loadSisterOffers(root, new Date("2026-11-14T06:00:00Z"), SISTERS.filter((s) => s.id === "op"));
  assert.equal(r.status.op.ok, false);
});
