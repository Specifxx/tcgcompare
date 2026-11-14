// Keeping a page's URL alive across a bad day (the import's continuity rules; DECISIONS.md, 2026-11-14).
//
// - A product that had a page and has none today, for ANY reason (the focus dropped it, its TCGplayer group fell out
//   of the age window, TCGCSV stopped listing it), goes to culled.json with its set and its game, so its URL 301s to
//   the set, or to the game's hub when the set is gone too. Never a 404.
// - A TCGplayer group that still holds a product the last import kept is read whatever its age, and so is a catch-all
//   group the site names (SITE.catalogFocus.evergreenGroups): their publishedOn says nothing about their products.
// - A sister site that is down (missing, unreadable or stale) does not take its stores' rows off the site at once:
//   the previous import's rows of its stores are carried for at most MAX_AGE_H after its data was last fresh, and no
//   product the last import kept is culled only because that sister was down (its rows were the reason it stayed).
//
// Pure functions only: scripts/import-all.ts reads the files and writes the results.
import type { Catalog, Offer, Product, SetInfo, StoreConfig } from "@/lib/site-types";

const NOT_STORES = new Set(["tcgplayer", "ebay", "amazon"]);
const HOUR = 3_600_000;

// ---------------------------------------------------------------------------------------------------------------
// TCGCSV groups

/** Whether a TCGCSV group is read today: recent enough, or holding a product we keep, or a named catch-all group. */
export function groupIsRead(g: { groupId: number; publishedOn?: string | null }, oldestMs: number, keep: ReadonlySet<number>): boolean {
  if (keep.has(g.groupId)) return true;
  return !g.publishedOn || new Date(g.publishedOn).getTime() >= oldestMs;
}

/** The groups the age window must not drop: every set the last catalogue still had a page for, plus the catch-alls. */
export function groupsToKeep(prev: Pick<Catalog, "sets" | "products"> | null, evergreen: readonly number[] = []): Set<number> {
  const out = new Set<number>(evergreen);
  for (const p of prev?.products ?? []) out.add(p.setId);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// culled.json: product slug -> its set slug (the original format) or { set, line } (since 2026-11-14). Both are read.

export type CulledEntry = string | { set: string; line?: string };
export type CulledMap = Record<string, CulledEntry>;

/** One entry, either format, as { set, line }. */
export function culledTarget(e: CulledEntry | null | undefined): { set: string; line: string | null } | null {
  if (e == null) return null;
  if (typeof e === "string") return { set: e, line: null };
  if (typeof e.set !== "string") return null;
  return { set: e.set, line: typeof e.line === "string" && e.line ? e.line : null };
}

/**
 * Today's culled.json. Every product of the previous catalogue that has no page today is added under its previous
 * slug, with its set's slug and game line (today's set, else the previous catalogue's). An old string entry whose set
 * is known gains its line. A slug that has a page today leaves the list.
 */
export function updateCulled(args: {
  existing: CulledMap;
  prev: Pick<Catalog, "sets" | "products"> | null;
  /** Today's kept products (they have pages). */
  kept: readonly Pick<Product, "id" | "slug">[];
  /** Every set TCGCSV served today, kept or not. */
  setsToday: readonly SetInfo[];
}): CulledMap {
  const { existing, prev, kept, setsToday } = args;
  const out: CulledMap = { ...existing };
  const byId = new Map<number, SetInfo>();
  const bySlug = new Map<string, SetInfo>();
  for (const s of prev?.sets ?? []) { byId.set(s.id, s); bySlug.set(s.slug, s); }
  for (const s of setsToday) { byId.set(s.id, s); bySlug.set(s.slug, s); }
  const entry = (s: SetInfo): CulledEntry => (s.line ? { set: s.slug, line: s.line } : { set: s.slug });
  const keptIds = new Set(kept.map((p) => p.id));
  for (const p of prev?.products ?? []) {
    if (keptIds.has(p.id)) continue;
    const s = byId.get(p.setId);
    if (s) out[p.slug] = entry(s);
  }
  for (const [slug, e] of Object.entries(out)) {
    if (typeof e !== "string") continue;
    const s = bySlug.get(e);
    if (s?.line) out[slug] = { set: e, line: s.line };
  }
  for (const p of kept) delete out[p.slug];
  return Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])));
}

// ---------------------------------------------------------------------------------------------------------------
// A sister that is down

export interface SisterMemo {
  ok: boolean;
  offers: number;
  products: number;
  /** When the sister's own data was made: the last fresh copy, kept while it is down. */
  at: string | null;
  error?: string;
  /** The store keys its rows carried (so a later run knows whose rows to carry). */
  stores?: string[];
  /** Down only: rows carried from the previous import, and products kept that would otherwise be culled. */
  carried?: number;
  held?: number;
}

/**
 * For every sister that is down today: the previous import's rows of its stores, carried while its last fresh data
 * is under `maxAgeH` hours old, and the set of its store keys (to hold products from the cull).
 *
 * A row is carried only where no live sister has that store on that product today, and only for a key the previous
 * store directory names with the same shop (a key today's directory gives another shop is never reused). With no
 * store list from the previous run, the sister's stores are the previous rows' stores no live sister has today.
 */
export function carryDownSisters(args: {
  status: Record<string, SisterMemo>;
  prevStatus: Record<string, SisterMemo> | undefined;
  prevById: Readonly<Record<string, { offers: readonly Offer[] }>>;
  live: ReadonlyMap<number, readonly Offer[]>;
  liveStores: readonly StoreConfig[];
  prevStores: readonly Pick<StoreConfig, "key" | "name" | "base" | "market">[];
  now: Date;
  maxAgeH: number;
}): { offers: Map<number, Offer[]>; stores: StoreConfig[]; downStores: Set<string>; status: Record<string, SisterMemo> } {
  const { prevStatus = {}, prevById, live, liveStores, prevStores, now, maxAgeH } = args;
  const status: Record<string, SisterMemo> = { ...args.status };
  const offers = new Map<number, Offer[]>();
  const downStores = new Set<string>();
  const liveByKey = new Map(liveStores.map((s) => [s.key, s]));
  const prevByKey = new Map(prevStores.map((s) => [s.key, s]));
  const liveSources = new Set<string>();
  for (const list of live.values()) for (const o of list) liveSources.add(o.source);
  const carriedStores = new Map<string, StoreConfig>();
  const carryable = (key: string): boolean => {
    const was = prevByKey.get(key);
    if (!was) return false;
    const cur = liveByKey.get(key);
    return !cur || (cur.base === was.base && cur.market === was.market);
  };
  for (const [id, st] of Object.entries(args.status)) {
    if (st.ok) continue;
    const prev = prevStatus[id];
    let stores = prev?.stores ? new Set(prev.stores) : null;
    if (!stores) {
      stores = new Set<string>();
      for (const e of Object.values(prevById)) for (const o of e.offers) if (!NOT_STORES.has(o.source) && !liveSources.has(o.source)) stores.add(o.source);
    }
    for (const k of stores) downStores.add(k);
    const lastFresh = prev?.at ?? null;
    const fresh = lastFresh != null && now.getTime() - new Date(lastFresh).getTime() < maxAgeH * HOUR;
    let carried = 0;
    if (fresh) {
      for (const [pid, e] of Object.entries(prevById)) {
        const id = Number(pid);
        const have = new Set((live.get(id) ?? []).map((o) => o.source).concat((offers.get(id) ?? []).map((o) => o.source)));
        for (const o of e.offers) {
          if (!stores.has(o.source) || have.has(o.source) || !carryable(o.source)) continue;
          if (!offers.has(id)) offers.set(id, []);
          offers.get(id)!.push({ ...o });
          have.add(o.source);
          carried++;
          if (!liveByKey.has(o.source) && !carriedStores.has(o.source)) {
            const s = prevByKey.get(o.source)!;
            carriedStores.set(o.source, { key: s.key, name: s.name, base: s.base, market: s.market, collections: [], kind: "sealed" });
          }
        }
      }
    }
    status[id] = { ...st, at: lastFresh, stores: [...stores].sort(), carried };
  }
  return { offers, stores: [...carriedStores.values()], downStores, status };
}

/**
 * Products the last import kept that the focus would drop today while a store they had rows from is down with its
 * sister: they stay (no 301 only because a sister was down). Returns the held products, in `products` order.
 */
export function heldForDownSisters(args: {
  products: readonly Product[];
  keptIds: ReadonlySet<number>;
  previous: ReadonlySet<number>;
  prevById: Readonly<Record<string, { offers: readonly Offer[] }>>;
  downStores: ReadonlySet<string>;
}): Product[] {
  const { products, keptIds, previous, prevById, downStores } = args;
  if (!downStores.size) return [];
  return products.filter(
    (p) => p.kind === "sealed" && !keptIds.has(p.id) && previous.has(p.id) && (prevById[p.id]?.offers ?? []).some((o) => downStores.has(o.source)),
  );
}
