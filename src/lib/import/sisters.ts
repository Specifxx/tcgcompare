// Store prices from our sister sites (owner, 2026-11-14: "we have so many stores that we can use").
//
// Every Compare Empire card site publishes its day's store offers in its own public repository. This site reads
// those files instead of visiting the stores a second time: no extra load on any shop, and no second copy of the
// matching rules that keep a price on the right product. A sister's offer is taken ONLY when it names its product by
// TCGplayer's product id, which is this catalogue's id too:
//
// - "engine" sisters (YGO, Lorcana, Gundam, Bandai, Cyberpunk Compare): data/public/prices/<set>.json is keyed by
//   the TCGplayer product id.
// - "sealed" sisters (DexCompare, MTG Compare): their products are their own, but a product whose photo is
//   TCGplayer's (tcgplayer-cdn…/product/<id>_…) was built from that TCGplayer product. No photo id, no offers.
// - "snapshot" sisters (OP Compare): the `snapshot` branch holds sealed.json.gz (its sealed products, whose id IS the
//   TCGplayer product id) and o/<id range>.json.gz (every product's offers); the store list is src/lib/stores.ts on
//   main, checked out beside it.
// - "rift" sisters (Rift Compare, Riftbound): data/public/sealed-listings.json groups store rows by its own sealed
//   classifier (groupKey = set|type), and each group's TCGplayer reference row (retailer "tcgplayer") names the
//   TCGplayer product in its url. A group with one id, whose id no other group has, prices that id; anything else
//   prices nothing. The row carries its store (retailer, retailerName, url host, country), so no store list is read.
//
// Never a title match here. eBay, TCGplayer and Amazon rows are left behind (this site makes its own), and so is a
// sister whose data is older than MAX_AGE_H, and every store the sister's own import has not read for MAX_AGE_H
// (its meta.json `seen` time, or the row's own): a shop that stopped answering is not a price.
//
// The workflow checks the sisters' data out beside this repo (SISTER_DIR, sparse); nothing is fetched over HTTP.
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { CURRENCY, MARKETS, type Market, type Offer, type StoreConfig } from "@/lib/site-types";

export interface SisterSource {
  id: string;
  /** Folder name under SISTER_DIR (the repository's name). */
  dir: string;
  kind: "engine" | "sealed" | "snapshot" | "rift";
  /** Where data/public lives inside the repository. */
  data: string;
  /** The store list: src/content/stores.ts (engine) or src/data/stores.json (sealed). A snapshot sister's is a path under SISTER_DIR; a rift sister's rows carry their store, so it has none. */
  stores: string;
  /** The games (SITE.lines ids) whose store rows this sister publishes. Our own crawl never reads these (lib/import/crawl.ts). */
  lines: string[];
}

export const SISTERS: SisterSource[] = [
  { id: "dex", dir: "CompareEmpire", kind: "sealed", data: "apps/dexcompare-sealed/data/public", stores: "apps/dexcompare-sealed/src/data/stores.json", lines: ["pkm", "pkj"] },
  { id: "mtg", dir: "mtgcompare", kind: "sealed", data: "data/public", stores: "src/data/stores.json", lines: ["mtg"] },
  { id: "ygo", dir: "ygocompare", kind: "engine", data: "data/public", stores: "src/content/stores.ts", lines: ["ygo"] },
  { id: "lorcana", dir: "lorcanacompare", kind: "engine", data: "data/public", stores: "src/content/stores.ts", lines: ["lor"] },
  { id: "gundam", dir: "GundamCompare", kind: "engine", data: "data/public", stores: "src/content/stores.ts", lines: ["gun"] },
  { id: "bandai", dir: "bandaicompare", kind: "engine", data: "data/public", stores: "src/content/stores.ts", lines: ["ua", "fw", "dg"] },
  { id: "cyberpunk", dir: "cyberpunkcompare", kind: "engine", data: "data/public", stores: "src/content/stores.ts", lines: ["cp"] },
  { id: "op", dir: "OpCompare-snapshot", kind: "snapshot", data: ".", stores: "../OpCompare/src/lib/stores.ts", lines: ["op"] },
  { id: "rift", dir: "TCGEmpire", kind: "rift", data: "data/public", stores: "", lines: ["rb"] },
];

export const MAX_AGE_H = 72;
const NOT_STORES = new Set(["ebay", "tcgplayer", "amazon"]);

/** Hours since `at` (an ISO time), Infinity when it is missing or unreadable. */
const ageHours = (at: string | null | undefined, now: Date): number => {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) ? (now.getTime() - t) / 3_600_000 : Infinity;
};

export interface SisterStatus { ok: boolean; offers: number; products: number; at: string | null; error?: string; stores?: string[] }
export interface SisterResult {
  offers: Map<number, Offer[]>;
  /** eBay listings an engine sister already found with its own calls (one per product and market): reused, never searched again. */
  ebay: Map<number, Offer[]>;
  /** Every store with at least one offer taken, under the key its offers carry. */
  stores: StoreConfig[];
  status: Record<string, SisterStatus>;
}

interface RawStore { key: string; name: string; base: string; market: string }

/** The stores of an engine sister's src/content/stores.ts, read as text (one object per line). */
export function parseStoresTs(src: string): RawStore[] {
  const out: RawStore[] = [];
  const re = /\{\s*key:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*base:\s*"([^"]+)",\s*(?:market|country):\s*"([A-Z]+)"/g;
  for (let m = re.exec(src); m; m = re.exec(src)) out.push({ key: m[1], name: m[2], base: m[3].replace(/\/+$/, ""), market: m[4] });
  return out;
}

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

/** The TCGplayer product id inside TCGplayer's own photo URL, or null. */
export function tcgIdOfImage(url: string | null | undefined): number | null {
  const m = /tcgplayer-cdn\.tcgplayer\.com\/product\/(\d+)_/.exec(url ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * One store directory for the whole site. A shop keeps one key however many sisters list it: stores are told apart by
 * host + market (a shop with a .com and a .ca front is two stores), and a key two different shops would share takes the
 * market, then a number.
 */
export class StoreBook {
  private byIdentity = new Map<string, StoreConfig>();
  private keys = new Set<string>();
  private used = new Set<string>();

  key(raw: RawStore): string | null {
    const host = hostOf(raw.base);
    if (!host || !(MARKETS as string[]).includes(raw.market)) return null;
    const identity = `${host}|${raw.market}`;
    let s = this.byIdentity.get(identity);
    if (!s) {
      let key = raw.key.toLowerCase().replace(/[^a-z0-9]+/g, "") || host.replace(/[^a-z0-9]+/g, "");
      if (NOT_STORES.has(key) || this.keys.has(key)) key = `${key}${raw.market.toLowerCase()}`;
      for (let n = 2; this.keys.has(key); n++) key = `${key.replace(/\d+$/, "")}${n}`;
      this.keys.add(key);
      s = { key, name: raw.name, base: raw.base, market: raw.market as Market, collections: [], kind: "sealed" };
      this.byIdentity.set(identity, s);
    }
    return s.key;
  }
  use(key: string) {
    this.used.add(key);
  }
  list(): StoreConfig[] {
    return [...this.byIdentity.values()].filter((s) => this.used.has(s.key)).sort((a, b) => a.key.localeCompare(b.key));
  }
}

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

type Tuple = [string, number, number, string, string?, (number | null)?, string?];

function readEngine(root: string, src: SisterSource, book: StoreBook, add: (id: number, o: Offer) => void, addEbay: (id: number, o: Offer) => void): { at: string | null; products: number } {
  const stores = new Map(parseStoresTs(fs.readFileSync(path.join(root, src.stores), "utf8")).map((s) => [s.key, s]));
  const meta = readJson<{ updatedAt?: string }>(path.join(root, src.data, "meta.json"));
  const dir = path.join(root, src.data, "prices");
  const seen = new Set<number>();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const shard = readJson<Record<string, { o?: Tuple[] }>>(path.join(dir, f));
    for (const [id, e] of Object.entries(shard)) {
      for (const t of e.o ?? []) {
        const [source, cents, flags, ref, printing, ship, mk] = t;
        // The sister's own eBay result for this product: a listing with stated postage, in stock, no printing.
        if (source === "ebay" && !printing && ship != null && mk && (MARKETS as string[]).includes(mk) && (flags & 1) === 1 && cents > 0 && /^https:\/\/www\.ebay\./.test(ref)) {
          const market = mk as Market;
          addEbay(Number(id), { source: "ebay", market, currency: CURRENCY[market], cents, inStock: true, url: ref, title: "", shippingCents: ship });
          continue;
        }
        const raw = stores.get(source);
        // Sealed only: a row that names a printing ("Foil", "1st Edition") is a card's, or an edition this site does not split.
        if (!raw || NOT_STORES.has(source) || printing || !(cents > 0)) continue;
        const key = book.key(raw);
        if (!key) continue;
        const market = raw.market as Market;
        add(Number(id), {
          source: key,
          market,
          currency: CURRENCY[market],
          cents,
          inStock: (flags & 1) === 1,
          preorder: (flags & 2) === 2 || undefined,
          url: /^https?:\/\//.test(ref) ? ref : `${raw.base}/products/${ref}`,
          title: "",
        });
        seen.add(Number(id));
      }
    }
  }
  return { at: meta.updatedAt ?? null, products: seen.size };
}

function readSealed(root: string, src: SisterSource, book: StoreBook, add: (id: number, o: Offer) => void, now: Date): { at: string | null; products: number } {
  const stores = new Map(readJson<RawStore[]>(path.join(root, src.stores)).map((s) => [s.key, { ...s, base: s.base.replace(/\/+$/, "") }]));
  // `seen` is each store's last successful read by the sister's own import (its site shows a row older than 72 hours
  // as "unknown", never in stock); a store missing from it was read with the export.
  const meta = readJson<{ generatedAt?: string; seen?: Record<string, string> }>(path.join(root, src.data, "meta.json"));
  const fresh = new Map<string, boolean>();
  const isFresh = (store: string) => {
    if (!fresh.has(store)) fresh.set(store, ageHours(meta.seen?.[store] ?? meta.generatedAt, now) <= MAX_AGE_H);
    return fresh.get(store)!;
  };
  const products = readJson<{ id: string; imageUrl?: string | null }[]>(path.join(root, src.data, "products.json"));
  // One TCGplayer id, one sister product: an id two of them share is ambiguous and prices neither.
  const count = new Map<number, number>();
  for (const p of products) {
    const id = tcgIdOfImage(p.imageUrl);
    if (id != null) count.set(id, (count.get(id) ?? 0) + 1);
  }
  const tcgId = new Map<string, number>();
  for (const p of products) {
    const id = tcgIdOfImage(p.imageUrl);
    if (id != null && count.get(id) === 1) tcgId.set(p.id, id);
  }
  const offers = readJson<{ productId: string; store: string; market: string; title?: string; url: string; priceCents: number; inStock: boolean }[]>(
    path.join(root, src.data, "offers.json"),
  );
  const seen = new Set<number>();
  for (const o of offers) {
    const id = tcgId.get(o.productId);
    const raw = stores.get(o.store);
    if (id == null || !raw || NOT_STORES.has(o.store) || !(o.priceCents > 0) || !/^https?:\/\//.test(o.url) || !isFresh(o.store)) continue;
    // The store's row in this market only (a store config names one market; its other fronts are other rows).
    const key = book.key({ ...raw, market: o.market });
    if (!key) continue;
    const market = o.market as Market;
    add(id, { source: key, market, currency: CURRENCY[market], cents: o.priceCents, inStock: !!o.inStock, url: o.url, title: o.title ?? "" });
    seen.add(id);
  }
  return { at: meta.generatedAt ?? null, products: seen.size };
}

const readGz = <T>(file: string): T => JSON.parse(gunzipSync(fs.readFileSync(file)).toString("utf8")) as T;

/** The snapshot's own range rule (OP Compare, src/lib/price-snapshot.ts): offers of ids n*1024…n*1024+1023 share a file. */
export const snapshotRange = (id: number) => String(Math.floor(id / 1024)).padStart(3, "0");

interface SnapshotOffer { source: string; market: string; priceCents: number; currency: string; url: string; inStock: boolean; condition?: string | null; updatedAt?: string }

function readSnapshot(root: string, src: SisterSource, book: StoreBook, add: (id: number, o: Offer) => void, now: Date): { at: string | null; products: number } {
  const stores = new Map(parseStoresTs(fs.readFileSync(path.join(root, src.stores), "utf8")).map((s) => [s.key, s]));
  const meta = readJson<{ lastImportAt?: string; generatedAt?: string }>(path.join(root, src.data, "meta.json"));
  const sealed = readGz<{ id: number }[]>(path.join(root, src.data, "sealed.json.gz"));
  const files = new Map<string, Record<string, SnapshotOffer[]>>();
  const seen = new Set<number>();
  for (const { id } of sealed) {
    const r = snapshotRange(id);
    if (!files.has(r)) {
      const f = path.join(root, src.data, "o", `${r}.json.gz`);
      files.set(r, fs.existsSync(f) ? readGz<Record<string, SnapshotOffer[]>>(f) : {});
    }
    for (const o of files.get(r)![String(id)] ?? []) {
      if (!o.source?.startsWith("store:") || o.condition || !(o.priceCents > 0) || !/^https?:\/\//.test(o.url)) continue;
      // A row its own import has not seen for MAX_AGE_H is a shop that stopped answering, not a price.
      if (!(ageHours(o.updatedAt, now) <= MAX_AGE_H)) continue;
      const raw = stores.get(o.source.slice(6));
      if (!raw || !(MARKETS as string[]).includes(o.market) || CURRENCY[o.market as Market] !== o.currency) continue;
      const key = book.key({ ...raw, market: o.market });
      if (!key) continue;
      const market = o.market as Market;
      add(id, { source: key, market, currency: o.currency, cents: o.priceCents, inStock: !!o.inStock, url: o.url, title: "" });
      seen.add(id);
    }
  }
  return { at: meta.lastImportAt ?? meta.generatedAt ?? null, products: seen.size };
}

interface RiftListing {
  groupKey: string;
  title?: string;
  retailer: string;
  retailerName?: string;
  priceCents: number;
  url: string;
  inStock: boolean;
  country: string;
}

/** TCGplayer's own product id in a tcgplayer.com/product/<id>/… link, or null. */
export function tcgIdOfProductUrl(url: string | null | undefined): number | null {
  const m = /^https:\/\/(?:www\.)?tcgplayer\.com\/product\/(\d+)(?:[/?#]|$)/.exec(url ?? "");
  return m ? Number(m[1]) : null;
}

/** Rift Compare's marketplace and reference rows: never a store here. */
const RIFT_NOT_STORES = /^(?:ebay(?:_[a-z]+)?|tcgplayer|amazon(?:_[a-z]+)?|cardmarket)$/;

function readRift(root: string, src: SisterSource, book: StoreBook, add: (id: number, o: Offer) => void, now: Date): { at: string | null; products: number } {
  const meta = readJson<{ generatedAt?: string; seen?: { SealedListing?: Record<string, string> } }>(path.join(root, src.data, "meta.json"));
  const rows = readJson<RiftListing[]>(path.join(root, src.data, "sealed-listings.json"));
  // One TCGplayer id per group and one group per id; a group that names two, or an id two groups name, prices nothing.
  const idsOf = new Map<string, Set<number>>();
  const groupsOf = new Map<number, Set<string>>();
  for (const r of rows) {
    if (r.retailer !== "tcgplayer") continue;
    const id = tcgIdOfProductUrl(r.url);
    if (id == null || !r.groupKey) continue;
    if (!idsOf.has(r.groupKey)) idsOf.set(r.groupKey, new Set());
    idsOf.get(r.groupKey)!.add(id);
    if (!groupsOf.has(id)) groupsOf.set(id, new Set());
    groupsOf.get(id)!.add(r.groupKey);
  }
  const tcgId = new Map<string, number>();
  for (const [g, ids] of idsOf) {
    if (ids.size !== 1) continue;
    const id = [...ids][0];
    if (groupsOf.get(id)!.size === 1) tcgId.set(g, id);
  }
  const seenAt = meta.seen?.SealedListing ?? {};
  const seen = new Set<number>();
  for (const r of rows) {
    const id = tcgId.get(r.groupKey);
    if (id == null || !r.retailer || RIFT_NOT_STORES.test(r.retailer) || !(r.priceCents > 0) || !/^https?:\/\//.test(r.url)) continue;
    if (!(MARKETS as string[]).includes(r.country)) continue;
    // A store and market Rift Compare's import has not read for MAX_AGE_H (or never stamped): skipped.
    if (!(ageHours(seenAt[`${r.retailer}|${r.country}`], now) <= MAX_AGE_H)) continue;
    let base: string;
    try {
      base = new URL(r.url).origin;
    } catch {
      continue;
    }
    const key = book.key({ key: r.retailer, name: r.retailerName || r.retailer, base, market: r.country });
    if (!key) continue;
    const market = r.country as Market;
    add(id, { source: key, market, currency: CURRENCY[market], cents: r.priceCents, inStock: !!r.inStock, url: r.url, title: r.title ?? "" });
    seen.add(id);
  }
  return { at: meta.generatedAt ?? null, products: seen.size };
}

/** Reads every sister under `root`. A sister that is missing, unreadable or stale is reported and skipped. */
export function loadSisterOffers(root: string, now = new Date(), sources: SisterSource[] = SISTERS): SisterResult {
  const book = new StoreBook();
  const offers = new Map<number, Offer[]>();
  const ebay = new Map<number, Offer[]>();
  const status: Record<string, SisterStatus> = {};
  for (const src of sources) {
    const mine = new Map<number, Map<string, Offer>>();
    const add = (id: number, o: Offer) => {
      if (!mine.has(id)) mine.set(id, new Map());
      const cur = mine.get(id)!.get(o.source);
      // One row a store: in stock before sold out, then the cheaper.
      if (!cur || (o.inStock && !cur.inStock) || (o.inStock === cur.inStock && o.cents < cur.cents)) mine.get(id)!.set(o.source, o);
    };
    try {
      const mineEbay = new Map<number, Offer[]>();
      const addEbay = (id: number, o: Offer) => {
        const list = mineEbay.get(id) ?? [];
        if (!list.some((x) => x.market === o.market)) list.push(o);
        mineEbay.set(id, list);
      };
      const dir = path.join(root, src.dir);
      const got =
        src.kind === "engine"
          ? readEngine(dir, src, book, add, addEbay)
          : src.kind === "snapshot"
            ? readSnapshot(dir, src, book, add, now)
            : src.kind === "rift"
              ? readRift(dir, src, book, add, now)
              : readSealed(dir, src, book, add, now);
      const ageH = ageHours(got.at, now);
      if (!(ageH <= MAX_AGE_H)) throw new Error(`data is ${Number.isFinite(ageH) ? `${Math.round(ageH)} hours` : "of unknown age"} old`);
      let n = 0;
      const keys = new Set<string>();
      for (const [id, rows] of mine)
        for (const o of rows.values()) {
          keys.add(o.source);
          if (!offers.has(id)) offers.set(id, []);
          offers.get(id)!.push(o);
          book.use(o.source);
          n++;
        }
      for (const [id, list] of mineEbay) ebay.set(id, list);
      status[src.id] = { ok: true, offers: n, products: got.products, at: got.at, stores: [...keys].sort() };
      console.log(`[sister] ${src.id}: ${n} offers on ${got.products} products (data of ${got.at})`);
    } catch (e) {
      const msg = (e as Error).message.slice(0, 200);
      status[src.id] = { ok: false, offers: 0, products: 0, at: null, error: msg };
      console.warn(`[sister] ${src.id} SKIPPED: ${msg}`);
    }
  }
  return { offers, ebay, stores: book.list(), status };
}
