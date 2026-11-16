// Our own crawl, for the games no sister site covers (owner, 2026-11-14: "wayyyy more stores", with scam vetting).
//
// The sisters (lib/import/sisters.ts) price only their own games. For the rest (SITE.lines with `crawl` words) this
// site reads the stores it already knows: data/crawl/stores.json (scripts/crawl-probe.ts, weekly) names, per store and
// game, the Shopify collections that hold that game; scripts/crawl-uncovered.ts reads those collections' products.json
// through lib/import/polite-http.ts and writes the listings it found; the import (scripts/import-all.ts) takes a
// listing ONLY by the TCGplayer product id the listing itself carries (pickId below) and sends the offers through the
// same vetting, price band and freshness rules as a sister's.
//
// Never a title match. TCGplayer-synced shops put TCGplayer's product id in the listing: in the handle
// ("…-booster-box-448432"), in the SKU, or in the photo they copied (448432_in_1000x1000.jpg). A listing is taken when
// exactly one catalogue id appears across all of them, that id is a sealed product of a game the listing was crawled
// for, no other catalogue id (of any game) and no other TCGplayer photo id appears, and the store matcher, read
// against that game alone, either agrees or says nothing. The matcher only ever refuses; it never supplies an id.
//
// Everything here is pure: tests/crawl.test.ts pins it with fixtures.
import type { GameLine, Market, Meta, Offer, Product, StoreConfig } from "@/lib/site-types";
import { CURRENCY } from "@/lib/site-types";
import { handleOf, isForeign, isMulti, isPreorder, isUnfitListing, matchSealed, type MatchIndex } from "./match";
import { sealedTypeOf } from "./tcgcsv";
import { tokens } from "@/lib/slug";

// ── What the crawl reads ────────────────────────────────────────────────────

export interface ShopifyImage {
  src?: string | null;
}
export interface ShopifyListingVariant {
  id: number;
  title?: string | null;
  price: string;
  available?: boolean;
  sku?: string | null;
  featured_image?: ShopifyImage | null;
}
export interface ShopifyListing {
  id: number;
  title: string;
  handle: string;
  tags?: string[] | string;
  product_type?: string;
  variants: ShopifyListingVariant[];
  images?: ShopifyImage[];
}

/** One entry of data/crawl/stores.json (written by the probe): a store and one game's collections there. */
export interface CrawlStore {
  host: string;
  key: string;
  name: string;
  base: string;
  market: Market;
  line: string;
  handles: string[];
  probedAt: string;
  /** A store of data/crawl/own-stores.json (no sister lists it): every game is read, the sisters' games too. */
  own?: boolean;
}

/** A store listing as the crawl hands it to the import: no decision about the product yet, only what the listing says. */
export interface CrawlListing {
  /** The games whose collections listed it. */
  lines: string[];
  title: string;
  url: string;
  cents: number;
  inStock: boolean;
  preorder?: boolean;
  ids: FoundId[];
  /** The kind of product its one variant's title names ("Booster Box"), when it names one. */
  variantKind?: string;
  /** Set when the listing itself is unusable (its variants are different products, it has no price). */
  refuse?: string;
}

export interface CrawlStoreRun {
  /** A store of data/crawl/own-stores.json: its listings may also be taken by title (pickByTitle). */
  own?: boolean;
  host: string;
  key: string;
  name: string;
  base: string;
  market: Market;
  /** Every collection read to the end. */
  ok: boolean;
  /** Not ok, but some collections were read to the end: `listings` holds theirs (a cap, the budget, the deadline or a
   *  failed collection stopped the rest). The import takes them and carries the store's other rows (carryCrawl). */
  partial?: boolean;
  /** Why the store was stopped or skipped this run, or which collections failed. */
  reason?: string;
  requests: number;
  listings: CrawlListing[];
}

/** What scripts/crawl-uncovered.ts writes (data/crawl/listings.json, git-ignored) for the import to read. */
export interface CrawlRun {
  at: string;
  budget: number;
  requests: number;
  stores: CrawlStoreRun[];
}

// ── Ids inside a listing ────────────────────────────────────────────────────

export interface FoundId {
  id: number;
  where: "handle" | "sku" | "image";
}

const HANDLE_ID = /-(\d{5,7})$/;
const SKU_ID = /^(?:tcg(?:player)?[-_ ]?)?(\d{5,7})(?:[-_ ].*)?$/i;
const IMAGE_IDS = [/\/(\d{5,7})_in_\d+x\d+[^/]*$/, /tcgplayer-cdn\.tcgplayer\.com\/product\/(\d{5,7})_/];

const imageFile = (src: string) => src.split(/[?#]/)[0];

/** Every TCGplayer-shaped product id the listing carries: its handle's trailing number, its variants' SKUs, its photos. */
export function idsInListing(p: Pick<ShopifyListing, "handle" | "variants" | "images">): FoundId[] {
  const out: FoundId[] = [];
  const add = (id: number, where: FoundId["where"]) => {
    if (id > 0 && !out.some((x) => x.id === id && x.where === where)) out.push({ id, where });
  };
  const h = HANDLE_ID.exec(p.handle ?? "");
  if (h) add(Number(h[1]), "handle");
  for (const v of p.variants ?? []) {
    const s = SKU_ID.exec((v.sku ?? "").trim());
    if (s) add(Number(s[1]), "sku");
  }
  const srcs = [...(p.images ?? []).map((i) => i?.src), ...(p.variants ?? []).map((v) => v.featured_image?.src)];
  for (const src of srcs) {
    if (!src) continue;
    for (const re of IMAGE_IDS) {
      const m = re.exec(imageFile(src));
      if (m) add(Number(m[1]), "image");
    }
  }
  return out;
}

// ── One offer per listing ───────────────────────────────────────────────────

// A variant title that only names condition, language or the single item: the same product.
const SAME_PRODUCT = /^(default title|default|new|sealed|factory sealed|brand new|english|en|near mint|nm|mint|standard|regular|single|1|one)$/i;
// A variant that names a kind of product, a quantity or a case: another product in the same listing.
const OTHER_PRODUCT = /booster|display|\bbox\b|\bcase\b|\bpacks?\b|\bdecks?\b|bundle|\btin\b|collection|starter|\bset\b|\bx\s*\d+|\d+\s*x\b|\bqty\b|quantity|\bof \d+\b|^\d+$/i;
const BAD_VARIANT = /lightly played|moderately played|\bplayed\b|\blp\b|\bmp\b|damaged|dented|crushed|opened|used|heavily|\bhp\b|\bdmg\b|poor|japanese|chinese|korean|french|german|italian|spanish|\bjp\b|\bjpn\b/i;

export type VariantPick = { cents: number; inStock: boolean; variantId: number; said?: string } | { refuse: string };

// A lone variant's title that names only a quantity ("x6", "Qty 3", "of 12", "6"): not one of the product.
const QUANTITY = /\bx\s*\d+|\d+\s*x\b|\bqty\b|quantity|\bof \d+\b|^\d+$/i;

/**
 * One offer per listing: the cheapest in-stock variant (else the cheapest at all), among variants that are this
 * product. A listing whose variants are different products ("Booster Box" / "Booster Pack") is refused whole: which
 * one carries the id cannot be told. A lone variant that names a quantity is refused; one that names a kind of
 * product other than the listing's title says is refused, and the kind it names is kept (`said`) for pickId.
 */
export function pickOffer(p: Pick<ShopifyListing, "variants"> & { title?: string }): VariantPick {
  const vs = p.variants ?? [];
  if (!vs.length) return { refuse: "no-variant" };
  let said: string | undefined;
  if (vs.length > 1) {
    const named = vs.map((v) => (v.title ?? "").trim()).filter((t) => t && !SAME_PRODUCT.test(t) && !BAD_VARIANT.test(t));
    if (named.some((t) => OTHER_PRODUCT.test(t)) || new Set(named.map((t) => t.toLowerCase())).size > 1) return { refuse: "variants-differ" };
  } else {
    const t = (vs[0].title ?? "").trim();
    if (t && !SAME_PRODUCT.test(t) && !BAD_VARIANT.test(t) && OTHER_PRODUCT.test(t)) {
      const kind = sealedTypeOf(t);
      if (kind === "Other") {
        if (QUANTITY.test(t)) return { refuse: "variants-differ" };
      } else {
        const titled = sealedTypeOf(p.title ?? "");
        if (titled !== "Other" && titled !== kind) return { refuse: "variants-differ" };
        said = kind;
      }
    }
  }
  const ok = vs.filter((v) => !BAD_VARIANT.test(v.title ?? "")).filter((v) => {
    const c = Math.round(Number(v.price) * 100);
    return Number.isFinite(c) && c > 0;
  });
  if (!ok.length) return { refuse: "no-price" };
  const inStock = ok.filter((v) => v.available);
  const pool = (inStock.length ? inStock : ok).slice().sort((a, b) => Number(a.price) - Number(b.price));
  const v = pool[0];
  return { cents: Math.round(Number(v.price) * 100), inStock: !!v.available, variantId: v.id, ...(said ? { said } : {}) };
}

/** A Shopify product as the crawl keeps it. */
export function toListing(p: ShopifyListing, base: string, lines: string[]): CrawlListing {
  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(",").map((t) => t.trim());
  const pick = pickOffer(p);
  const url = `${base}/products/${p.handle}`;
  const ids = idsInListing(p);
  if ("refuse" in pick) return { lines, title: p.title, url, cents: 0, inStock: false, ids, refuse: pick.refuse };
  return {
    lines,
    title: p.title,
    url: `${url}?variant=${pick.variantId}`,
    cents: pick.cents,
    inStock: pick.inStock,
    ...(isPreorder(p.title, tags) ? { preorder: true } : {}),
    ...(pick.said ? { variantKind: pick.said } : {}),
    ids,
  };
}

// ── Which product, if any ───────────────────────────────────────────────────

export interface PickContext {
  /** Every catalogue product (all games), by id. */
  products: ReadonlyMap<number, Product>;
  /** A product's game (SITE.lines id). */
  lineOf: (p: Product) => string | undefined;
  /** The store matcher's index of ONE game. */
  indexOf: (line: string) => MatchIndex;
  /** Whether a price (cents in `market`'s currency) is 60-160% of the product's TCGplayer market price; false when it has none. */
  inBand?: (id: number, cents: number, market: Market) => boolean;
  /**
   * AI placements recorded in shadow mode (scripts/ai-shadow-match.ts, store host + "|" + title), only when the import
   * runs with AI_SHADOW_LIVE=1 (owner, 2026-11-16: TCG Prices wants as many listings as possible, light filtering).
   */
  ai?: ReadonlyMap<string, { id: number; pass: boolean; reasons: string[] }>;
  /** A wide price sanity band for an AI placement: 40-250% of TCGplayer's market price; false when it has none. */
  inBandWide?: (id: number, cents: number, market: Market) => boolean;
}

export type Refused =
  | "listing"
  | "unfit"
  | "foreign"
  | "no-id"
  | "two-ids"
  | "id-conflict"
  | "unconfirmed"
  | "other-game"
  | "photo-conflict"
  | "not-sealed"
  | "multiple"
  | "type-differs"
  | "matcher-disagrees";

export type IdPick = { id: number } | { refuse: Refused; detail?: string };

// Not a sealed product as the catalogue means one, though the shared isUnfitListing (used, damaged, graded) lets it
// by: an opened or resealed box, an empty one, a break spot, a repack or mystery box, one missing its packs.
const NOT_SEALED_AS_SOLD = /\bopened\b|\bopen[- ]box\b|\bpre-?owned\b|\bsecond[- ]hand\b|\bre-?sealed\b|\bempty\b|\bbreaks?\b|\bspots?\b|\brepacks?\b|\bmystery\b|\bno packs\b|\bmissing\b/i;
// Another quantity than one: "(6 Boxes)", "6 boxes", "Display of 6", "Half Booster Box".
const OTHER_QUANTITY = /\(\d+\s*(boxes|displays)\)|\b\d+\s*boxes\b|display of \d+|\bhalf\b/i;

/** Every word of the set's name (its code-like words aside) is in the title. */
function namesSet(title: string, p: Product, idx: MatchIndex): boolean {
  const setTokens = idx.setName.get(p.setId) ?? [];
  const words = setTokens.filter((t) => !/\d/.test(t));
  const need = words.length ? words : setTokens;
  if (!need.length) return false;
  const have = new Set(tokens(title));
  return need.every((t) => have.has(t));
}

export function pickId(l: CrawlListing, ctx: PickContext): IdPick {
  if (l.refuse) return { refuse: "listing", detail: l.refuse };
  if (isUnfitListing(l.title) || NOT_SEALED_AS_SOLD.test(l.title)) return { refuse: "unfit" };
  if (isForeign(l.title) || isForeign(handleOf(l.url))) return { refuse: "foreign" };
  const known = [...new Set(l.ids.map((x) => x.id).filter((id) => ctx.products.has(id)))];
  if (!known.length) return { refuse: "no-id" };
  if (known.length > 1) return { refuse: "two-ids", detail: known.join(",") };
  const id = known[0];
  const p = ctx.products.get(id)!;
  const line = ctx.lineOf(p);
  if (!line || !l.lines.includes(line)) return { refuse: "other-game", detail: line };
  // Any other TCGplayer-shaped id beside it, in the catalogue or not, says the listing is not plainly this product:
  // a photo of another product (a single, a pack), or a handle and a SKU naming two products.
  if (l.ids.some((x) => x.where === "image" && x.id !== id)) return { refuse: "photo-conflict" };
  const other = l.ids.find((x) => x.where !== "image" && x.id !== id);
  if (other) return { refuse: "id-conflict", detail: `${other.where} ${other.id}` };
  if (p.kind !== "sealed" || p.sealedType === "Insert") return { refuse: "not-sealed" };
  if (isMulti(l.title) !== isMulti(p.name)) return { refuse: "multiple" };
  if (OTHER_QUANTITY.test(l.title) && !OTHER_QUANTITY.test(p.name)) return { refuse: "multiple", detail: "quantity" };
  // The title (or its one variant) names a kind of product ("Booster Pack") and the id is another kind ("Booster Box"): a shifted handle.
  const kind = sealedTypeOf(p.name);
  const said = sealedTypeOf(l.title);
  if (said !== "Other" && said !== kind) return { refuse: "type-differs", detail: `${said} / ${kind}` };
  if (l.variantKind && l.variantKind !== kind) return { refuse: "type-differs", detail: `${l.variantKind} / ${kind}` };
  const idx = ctx.indexOf(line);
  const m = matchSealed(l.title, idx);
  if (m && m.product.id !== id) return { refuse: "matcher-disagrees", detail: String(m.product.id) };
  // A number in a handle or SKU may be the store's own numbering: unless TCGplayer's own photo carries the id, the
  // title must say which product it is (the matcher lands on it, or the title names its set).
  const photo = l.ids.some((x) => x.where === "image" && x.id === id);
  if (!photo && !m && !namesSet(l.title, p, idx)) return { refuse: "unconfirmed" };
  return { id };
}

/**
 * A listing of an own-list shop (data/crawl/own-stores.json) with NO TCGplayer id, taken by its title (owner's go,
 * 2026-11-15: the id-only rule left most new shops empty). Strict: in stock, no other TCGplayer-shaped id, none of
 * pickId's refusals, the one-game matcher lands on exactly one product (across all the listing's games), the title
 * names a product type and it is the product's own, the quantity agrees, and the price is 60-160% of TCGplayer's
 * market price (a product with no market price is refused). Anything doubtful is no match.
 */
export function pickByTitle(l: CrawlListing, ctx: PickContext, market: Market): IdPick {
  if (l.refuse) return { refuse: "listing", detail: l.refuse };
  if (!ctx.inBand) return { refuse: "no-id" };
  if (l.ids.length) return { refuse: "no-id" };
  if (!l.inStock) return { refuse: "unconfirmed", detail: "out of stock" };
  if (isUnfitListing(l.title) || NOT_SEALED_AS_SOLD.test(l.title)) return { refuse: "unfit" };
  if (isForeign(l.title) || isForeign(handleOf(l.url))) return { refuse: "foreign" };
  if (OTHER_QUANTITY.test(l.title)) return { refuse: "multiple", detail: "quantity" };
  const said = sealedTypeOf(l.title);
  if (said === "Other") return { refuse: "unconfirmed", detail: "no product type" };
  // The handle is the shop's own second statement of the product: a handle that says another kind (a "booster box"
  // handle under a "Booster Pack" title, a "jumbo" pack) is two readings, so neither is taken.
  const handleWords = handleOf(l.url).replace(/[-_]+/g, " ");
  const handleSaid = sealedTypeOf(handleWords);
  if (handleSaid !== "Other" && handleSaid !== said) return { refuse: "type-differs", detail: `handle ${handleSaid} / ${said}` };
  const hits = l.lines.map((line) => matchSealed(l.title, ctx.indexOf(line))).filter((m): m is NonNullable<typeof m> => !!m);
  if (hits.length !== 1) return { refuse: "unconfirmed", detail: hits.length ? "two games" : "no match" };
  const p = hits[0].product;
  if (p.kind !== "sealed" || p.sealedType === "Insert") return { refuse: "not-sealed" };
  if (/\bjumbo\b/i.test(`${l.title} ${handleWords}`) !== /\bjumbo\b/i.test(p.name)) return { refuse: "unconfirmed", detail: "jumbo" };
  if (isMulti(l.title) !== isMulti(p.name)) return { refuse: "multiple" };
  if (said !== sealedTypeOf(p.name)) return { refuse: "type-differs", detail: `${said} / ${sealedTypeOf(p.name)}` };
  if (l.variantKind && l.variantKind !== sealedTypeOf(p.name)) return { refuse: "type-differs", detail: l.variantKind };
  if (!ctx.inBand(p.id, l.cents, market)) return { refuse: "unconfirmed", detail: "price outside 60-160% of market" };
  return { id: p.id };
}

/**
 * A listing with no id, placed on a product by the AI shadow pass. Light sanity only (owner, 2026-11-16): in stock, not
 * unfit / foreign / opened / another quantity, the product is sealed (not an insert) and of a game the listing was
 * crawled for, the shadow guard passed (or its only complaint is that the title names no product type), and the price
 * sits in the wide 40-250% band of TCGplayer's market price. Anything else is no match.
 */
export function pickByAi(l: CrawlListing, host: string, ctx: PickContext, market: Market): IdPick {
  const d = ctx.ai?.get(`${host}|${l.title}`);
  if (!d) return { refuse: "no-id" };
  if (l.refuse) return { refuse: "listing", detail: l.refuse };
  if (l.ids.length || !l.inStock) return { refuse: "no-id" };
  if (isUnfitListing(l.title) || NOT_SEALED_AS_SOLD.test(l.title)) return { refuse: "unfit" };
  if (isForeign(l.title) || isForeign(handleOf(l.url))) return { refuse: "foreign" };
  if (OTHER_QUANTITY.test(l.title)) return { refuse: "multiple", detail: "quantity" };
  if (!d.pass && !d.reasons.every((r) => r === "no-type")) return { refuse: "unconfirmed", detail: `ai guard: ${d.reasons.join(",")}` };
  const p = ctx.products.get(d.id);
  if (!p || p.kind !== "sealed" || p.sealedType === "Insert") return { refuse: "not-sealed" };
  const line = ctx.lineOf(p);
  if (!line || !l.lines.includes(line)) return { refuse: "other-game" };
  if (!ctx.inBandWide?.(p.id, l.cents, market)) return { refuse: "unconfirmed", detail: "ai: price outside 40-250% of market" };
  return { id: p.id };
}

// ── Into the import ─────────────────────────────────────────────────────────

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};
export const storeIdentity = (base: string, market: string) => `${hostOf(base)}|${market}`;

/**
 * The crawl's stores under the keys today's store directory uses: a store the sisters already list keeps its key; a
 * store only the crawl reads keeps the probe's key, or takes the market and a number when another shop holds it.
 */
export function crawlStoreKeys(known: readonly StoreConfig[], crawled: readonly { key: string; name: string; base: string; market: Market }[]): { keyOf: Map<string, string>; added: StoreConfig[] } {
  const byIdentity = new Map(known.map((s) => [storeIdentity(s.base, s.market), s.key]));
  const taken = new Set(known.map((s) => s.key));
  const keyOf = new Map<string, string>();
  const added: StoreConfig[] = [];
  for (const s of crawled) {
    const ident = storeIdentity(s.base, s.market);
    if (keyOf.has(ident)) continue;
    let key = byIdentity.get(ident);
    if (!key) {
      key = s.key;
      if (taken.has(key)) key = `${key}${s.market.toLowerCase()}`;
      for (let n = 2; taken.has(key); n++) key = `${key.replace(/\d+$/, "")}${n}`;
      taken.add(key);
      added.push({ key, name: s.name, base: s.base.replace(/\/+$/, ""), market: s.market, collections: [], kind: "sealed" });
    }
    keyOf.set(ident, key);
  }
  return { keyOf, added };
}

export interface CrawlTake {
  offers: Map<number, Offer[]>;
  /** Today's store key → the products it was taken for this run (carryCrawl leaves those to the fresh row). */
  fresh: Map<string, Set<number>>;
  taken: number;
  /** Of `taken`, those taken by title (own-list shops, pickByTitle). */
  titled?: number;
  /** Of `taken`, those placed by the AI shadow pass (pickByAi). */
  aiTaken?: number;
  refused: Record<string, number>;
  /** Refusals by "reason: detail", the 40 commonest. */
  refusedDetail?: Record<string, number>;
  /** Listings taken, by game line. */
  takenByLine?: Record<string, number>;
  listings: number;
}

/** Every listing of the run through pickId: one offer per store and product (in stock first, then the cheaper). */
export function takeCrawl(run: CrawlRun, ctx: PickContext, keyOf: ReadonlyMap<string, string>): CrawlTake {
  const offers = new Map<number, Offer[]>();
  const fresh = new Map<string, Set<number>>();
  const refused: Record<string, number> = {};
  const detail: Record<string, number> = {};
  const byLine: Record<string, number> = {};
  let taken = 0;
  let titled = 0;
  let aiTaken = 0;
  let listings = 0;
  for (const s of run.stores) {
    // A partial read still yields the collections it read to the end.
    if (!s.ok && !s.partial) continue;
    const key = keyOf.get(storeIdentity(s.base, s.market));
    if (!key) continue;
    const best = new Map<number, Offer>();
    for (const l of s.listings) {
      listings++;
      let r = pickId(l, ctx);
      if ("refuse" in r && r.refuse === "no-id" && s.own) {
        const byTitle = pickByTitle(l, ctx, s.market);
        if ("id" in byTitle) {
          r = byTitle;
          titled++;
        } else if (byTitle.refuse !== "no-id") r = { refuse: byTitle.refuse, detail: byTitle.detail };
      }
      if ("refuse" in r && r.refuse === "no-id" && ctx.ai) {
        const byAi = pickByAi(l, s.host, ctx, s.market);
        if ("id" in byAi) {
          r = byAi;
          aiTaken++;
        } else if (byAi.refuse !== "no-id") r = { refuse: byAi.refuse, detail: byAi.detail };
      }
      if ("refuse" in r) {
        refused[r.refuse] = (refused[r.refuse] ?? 0) + 1;
        const dk = `${r.refuse}: ${(r.detail ?? "").slice(0, 40)}`;
        detail[dk] = (detail[dk] ?? 0) + 1;
        continue;
      }
      taken++;
      const tp = ctx.products.get(r.id);
      const tl = tp ? ctx.lineOf(tp) : null;
      if (tl) byLine[tl] = (byLine[tl] ?? 0) + 1;
      const o: Offer = { source: key, market: s.market, currency: CURRENCY[s.market], cents: l.cents, inStock: l.inStock, url: l.url, title: l.title, ...(l.preorder ? { preorder: true } : {}) };
      const cur = best.get(r.id);
      if (!cur || (o.inStock && !cur.inStock) || (o.inStock === cur.inStock && o.cents < cur.cents)) best.set(r.id, o);
    }
    for (const [id, o] of best) {
      if (!offers.has(id)) offers.set(id, []);
      offers.get(id)!.push(o);
      if (!fresh.has(key)) fresh.set(key, new Set());
      fresh.get(key)!.add(id);
    }
  }
  const refusedDetail = Object.fromEntries(Object.entries(detail).sort((a, b) => b[1] - a[1]).slice(0, 40));
  return { offers, fresh, taken, refused, refusedDetail, takenByLine: byLine, listings, titled, aiTaken };
}

/**
 * A store the crawl could not read this run (stopped, not reached in the budget, or the crawl did not run) keeps its
 * crawled rows from the previous import for at most `maxAgeH` after its last good read: a shop that stopped answering
 * is not a price for longer than that. Only rows on products of a crawled game are carried (a sister prices the rest).
 * A store read in part (a failed collection, a cap) keeps its old rows only for products it gave no fresh row (`fresh`).
 */
export function carryCrawl(args: {
  stores: readonly { base: string; market: Market }[];
  readOk: ReadonlySet<string>;
  seen: Readonly<Record<string, string>>;
  keyOf: ReadonlyMap<string, string>;
  prevById: Readonly<Record<string, { offers: readonly Offer[] }>>;
  prevKeyOf: ReadonlyMap<string, string>;
  /** Whether a previous row for this product may be carried for this store (`ident` = host|market). */
  crawledProduct: (id: number, ident: string) => boolean;
  /** Today's store key → products it has a fresh row for this run. */
  fresh?: ReadonlyMap<string, ReadonlySet<number>>;
  now: Date;
  maxAgeH: number;
}): { offers: Map<number, Offer[]>; carried: number } {
  const offers = new Map<number, Offer[]>();
  let carried = 0;
  const wanted = new Map<string, { key: string; ident: string }>(); // previous key → today's key and identity
  for (const s of args.stores) {
    const ident = storeIdentity(s.base, s.market);
    if (args.readOk.has(ident)) continue;
    const at = Date.parse(args.seen[ident] ?? "");
    if (!Number.isFinite(at) || (args.now.getTime() - at) / 3_600_000 > args.maxAgeH) continue;
    const prev = args.prevKeyOf.get(ident);
    const key = args.keyOf.get(ident);
    if (prev && key) wanted.set(prev, { key, ident });
  }
  if (!wanted.size) return { offers, carried };
  for (const [id, e] of Object.entries(args.prevById)) {
    for (const o of e.offers) {
      const w = wanted.get(o.source);
      if (!w || !args.crawledProduct(Number(id), w.ident)) continue;
      const key = w.key;
      if (args.fresh?.get(key)?.has(Number(id))) continue;
      if (!offers.has(Number(id))) offers.set(Number(id), []);
      offers.get(Number(id))!.push({ ...o, source: key });
      carried++;
    }
  }
  return { offers, carried };
}

// ── The probe: which collections hold a game ────────────────────────────────

const norm = (s: string) => ` ${s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

/** The game a collection (its handle and title) names, by its line's `crawl` words; null when none, or two, do. */
export function lineOfCollection(c: { handle: string; title?: string | null }, lines: readonly Pick<GameLine, "id" | "crawl">[]): string | null {
  const text = `${norm(c.handle)} ${norm(c.title ?? "")}`;
  const hits = lines.filter((l) => l.crawl && l.crawl.any.some((w) => text.includes(norm(w))) && !(l.crawl.not ?? []).some((w) => text.includes(norm(w))));
  return hits.length === 1 ? hits[0].id : null;
}

const SINGLES = /\bsingles?\b|\bpromos?\b|\bproxy\b|\bsleeves?\b|\bplaymats?\b|\baccessor|\bsupplies\b/;
const SEALEDISH = /\bsealed\b|\bbooster\b|\bbox(es)?\b|\bdecks?\b|\bpacks?\b|\bdisplay\b|\bproducts?\b/;
export const MAX_HANDLES_PER_GAME = 4;
/** Collections a store, all its games together (crawl-run.ts capHandles): 8 × 4 pages + robots + currency fit under 40. */
export const MAX_HANDLES_PER_STORE = 8;

/**
 * The collections worth reading for one game at one store: never a singles or accessories collection, sealed-looking
 * ones first, then the larger, at most MAX_HANDLES_PER_GAME. Empty collections are left out.
 */
export function chooseHandles(cs: readonly { handle: string; title?: string | null; products_count?: number | null }[]): string[] {
  return cs
    .filter((c) => c.products_count !== 0)
    .filter((c) => {
      const t = `${norm(c.handle)} ${norm(c.title ?? "")}`;
      return !SINGLES.test(t) || SEALEDISH.test(t);
    })
    .map((c) => ({ c, s: SEALEDISH.test(`${norm(c.handle)} ${norm(c.title ?? "")}`) ? 0 : 1 }))
    .sort((a, b) => a.s - b.s || (b.c.products_count ?? 0) - (a.c.products_count ?? 0) || a.c.handle.localeCompare(b.c.handle))
    .slice(0, MAX_HANDLES_PER_GAME)
    .map((x) => x.c.handle);
}

// ── The ops monitor's check ─────────────────────────────────────────────────

/** The crawl check's verdict (scripts/ops-monitor.ts): stale crawl data, or no store read at all, is red. */
export function crawlVerdict(meta: Pick<Meta, "crawl">, listed: number, nowMs: number): { status: "ok" | "warn" | "fail"; detail: string } {
  const c = meta.crawl;
  if (!c || !c.at) return { status: "fail", detail: `${listed} store-game entries probed, but the last import read no crawl run — check the Refresh prices workflow's crawl step` };
  const age = (nowMs - Date.parse(c.at)) / 3_600_000;
  if (!(age <= 54)) return { status: "fail", detail: `the last crawl run is ${Number.isFinite(age) ? age.toFixed(0) : "?"}h old` };
  if (!c.ran) return { status: "warn", detail: `the last import had no crawl run of its own; the last one is ${age.toFixed(1)}h old` };
  if (c.read === 0) return { status: "fail", detail: `0 of ${c.stores} stores read (stopped: ${JSON.stringify(c.stopped)})` };
  const stopped = Object.values(c.stopped).reduce((x, n) => x + n, 0);
  const detail = `${c.read} of ${c.stores} stores read, ${c.requests}/${c.budget} requests, ${c.taken} of ${c.listings} listings taken, ${c.offers} offers, ${c.carried} carried, stopped ${JSON.stringify(c.stopped)}, ${age.toFixed(1)}h old`;
  return { status: age > 30 || stopped > c.stores / 2 ? "warn" : "ok", detail };
}

