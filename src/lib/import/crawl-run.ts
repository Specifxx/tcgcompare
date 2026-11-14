// The network half of our own crawl (the rules are in lib/import/crawl.ts): the weekly probe of which collections hold
// a game, and the twice-daily read of those collections. Both go through lib/import/polite-http.ts and take their
// fetch, sleep and clock from the caller, so tests/crawl.test.ts runs them on fixtures.
import type { Market } from "@/lib/site-types";
import { CURRENCY } from "@/lib/site-types";
import { chooseHandles, lineOfCollection, MAX_HANDLES_PER_STORE, storeIdentity, toListing, type CrawlListing, type CrawlRun, type CrawlStore, type CrawlStoreRun, type ShopifyListing } from "./crawl";
import { eachStore, RequestBudget, StopStore, StoreSession, type PoliteOptions } from "./polite-http";
import type { GameLine } from "@/lib/site-types";

// Shopify Markets prices by the visitor's country: every request names the store's own (as lib/import/shopify.ts).
const ISO: Record<Market, string> = { US: "US", UK: "GB", CA: "CA", AU: "AU", SG: "SG", EU: "ES" };

export const PRODUCT_PAGES = 4;
export const COLLECTION_PAGES = 3;
const PAGE = 250;

export interface RunOptions extends Omit<PoliteOptions, "budget" | "perStoreCap"> {
  budget: number;
  perStoreCap: number;
  concurrency?: number;
  /** Stores read in this order: never tried first, then the longest ago (meta.json crawl.tried, else crawl.seen). */
  seen?: Readonly<Record<string, string>>;
  log?: (s: string) => void;
}

/** The currency the storefront charges, asked once per store (/meta.json, else /cart.js), or null. */
export async function shopCurrency(s: StoreSession, market: Market): Promise<string | null> {
  for (const p of ["/meta.json", "/cart.js"]) {
    const d = await s.getJson<{ currency?: string }>(`${p}?country=${ISO[market]}`);
    if (d && typeof d.currency === "string" && d.currency) return d.currency.toUpperCase();
  }
  return null;
}

interface StoreJob {
  host: string;
  key: string;
  name: string;
  base: string;
  market: Market;
  handles: { handle: string; line: string }[];
}

export function groupStores(entries: readonly CrawlStore[]): StoreJob[] {
  const by = new Map<string, StoreJob>();
  for (const e of entries) {
    const id = storeIdentity(e.base, e.market);
    if (!by.has(id)) by.set(id, { host: e.host, key: e.key, name: e.name, base: e.base.replace(/\/+$/, ""), market: e.market, handles: [] });
    const job = by.get(id)!;
    for (const h of e.handles) if (!job.handles.some((x) => x.handle === h && x.line === e.line)) job.handles.push({ handle: h, line: e.line });
  }
  return [...by.values()];
}

const hostOfBase = (base: string) => {
  try {
    return new URL(base).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return base;
  }
};

/**
 * Items grouped by the shop they visit (its host): a shop listed in two markets is ONE shop, read by one session
 * (one robots.txt, one queue, one request a second), never by two at once.
 */
export function byHost<T extends { base: string }>(items: readonly T[]): T[][] {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const h = hostOfBase(it.base);
    if (!m.has(h)) m.set(h, []);
    m.get(h)!.push(it);
  }
  return [...m.values()];
}

/** Reads every probed collection of every store, two shops at a time, within the budget. */
export async function runCrawl(entries: readonly CrawlStore[], o: RunOptions): Promise<CrawlRun> {
  const now = o.now ?? Date.now;
  const budget = new RequestBudget(o.budget);
  const seen = o.seen ?? {};
  const age = (j: StoreJob) => Date.parse(seen[storeIdentity(j.base, j.market)] ?? "") || 0;
  const jobs = groupStores(entries).sort((a, b) => age(a) - age(b) || a.key.localeCompare(b.key) || a.market.localeCompare(b.market));
  // Sorted jobs keep their order inside a host; hosts go by their least recently tried market.
  const hosts = byHost(jobs);
  const out: CrawlStoreRun[] = [];
  await eachStore(
    hosts,
    async (group) => {
      // The cap counts per shop: a shop in two markets has two markets' allowance, in one session.
      const s = new StoreSession(group[0].base, { ...o, budget, perStoreCap: o.perStoreCap * group.length });
      for (const j of group) {
        const before = s.requests;
        const run: CrawlStoreRun = { host: j.host, key: j.key, name: j.name, base: j.base, market: j.market, ok: false, requests: 0, listings: [] };
        out.push(run);
        // Collections read to the end, kept even when the store is stopped later in the run.
        const byId = new Map<number, { p: ShopifyListing; lines: Set<string> }>();
        const failed: string[] = [];
        let done = 0;
        try {
          const cur = await shopCurrency(s, j.market);
          if (!cur) run.reason = "currency-unknown";
          else if (cur !== CURRENCY[j.market]) run.reason = `currency-mismatch: charges ${cur}, listed as ${j.market}`;
          else {
            for (const { handle, line } of j.handles) {
              const got: ShopifyListing[] = [];
              let bad = false;
              for (let page = 1; page <= PRODUCT_PAGES; page++) {
                const f0 = s.failures;
                const d = await s.getJson<{ products?: ShopifyListing[] }>(`/collections/${encodeURIComponent(handle)}/products.json?limit=${PAGE}&page=${page}&country=${ISO[j.market]}`);
                if (s.failures > f0 || (d != null && !Array.isArray(d.products))) {
                  bad = true; // a 5xx, a timeout or unreadable JSON: this collection was not read
                  break;
                }
                const list = d ? d.products! : null;
                if (!list) break; // a 404 or a path robots.txt disallows: honestly nothing here
                got.push(...list);
                if (list.length < PAGE) break;
              }
              if (bad) {
                failed.push(handle);
                continue;
              }
              done++;
              for (const p of got) {
                if (!p || typeof p.id !== "number" || !Array.isArray(p.variants)) continue;
                if (!byId.has(p.id)) byId.set(p.id, { p, lines: new Set() });
                byId.get(p.id)!.lines.add(line);
              }
            }
            if (failed.length) run.reason = `errors: ${failed.length} of ${j.handles.length} collections failed (${failed.join(", ")})`;
            else run.ok = true;
          }
        } catch (e) {
          if (!(e instanceof StopStore)) throw e;
          run.reason = e.message;
        }
        run.listings = [...byId.values()].map(({ p, lines }) => toListing(p, j.base, [...lines].sort()));
        if (!run.ok && done > 0) run.partial = true;
        run.requests = s.requests - before;
        o.log?.(`[crawl] ${j.key} (${j.market}): ${run.ok ? `${run.listings.length} listings` : `not read to the end, ${run.reason}${run.partial ? `; ${done} collections kept, ${run.listings.length} listings` : ""}`}, ${run.requests} requests`);
      }
    },
    o.concurrency ?? 2,
  );
  out.sort((a, b) => a.key.localeCompare(b.key) || a.market.localeCompare(b.market));
  return { at: new Date(now()).toISOString(), budget: o.budget, requests: budget.used, stores: out };
}

export interface ProbeStore {
  key: string;
  name: string;
  base: string;
  market: Market;
}

export interface ProbeResult {
  entries: CrawlStore[];
  /** Stores probed to the end (entries replace their old ones), and those that blocked us (dropped). */
  probed: Set<string>;
  blocked: Set<string>;
  requests: number;
}

/** Which collections at each store hold a game we crawl (by its line's `crawl` words). A shop listed in two markets
 *  is asked once: its collections are the same in every market. */
export async function runProbe(stores: readonly ProbeStore[], lines: readonly Pick<GameLine, "id" | "crawl">[], o: RunOptions): Promise<ProbeResult> {
  const now = o.now ?? Date.now;
  const budget = new RequestBudget(o.budget);
  const crawlLines = lines.filter((l) => l.crawl);
  const entries: CrawlStore[] = [];
  const probed = new Set<string>();
  const blocked = new Set<string>();
  await eachStore(
    byHost(stores),
    async (group) => {
      const base = group[0].base.replace(/\/+$/, "");
      const s = new StoreSession(base, { ...o, budget, perStoreCap: o.perStoreCap });
      const label = group.map((st) => `${st.key} (${st.market})`).join(", ");
      try {
        const cs: { handle: string; title?: string; products_count?: number }[] = [];
        for (let page = 1; page <= COLLECTION_PAGES; page++) {
          const d = await s.getJson<{ collections?: { handle: string; title?: string; products_count?: number }[] }>(`/collections.json?limit=${PAGE}&page=${page}`);
          const list = Array.isArray(d?.collections) ? d!.collections : null;
          if (!list) break;
          cs.push(...list.filter((c) => c && typeof c.handle === "string"));
          if (list.length < PAGE) break;
        }
        const byLine = new Map<string, typeof cs>();
        for (const c of cs) {
          const line = lineOfCollection(c, crawlLines);
          if (!line) continue;
          if (!byLine.has(line)) byLine.set(line, []);
          byLine.get(line)!.push(c);
        }
        const host = hostOfBase(base);
        const chosen = capHandles([...byLine].sort((a, b) => a[0].localeCompare(b[0])).map(([line, list]) => ({ line, handles: chooseHandles(list) })));
        for (const st of group) {
          const b = st.base.replace(/\/+$/, "");
          for (const { line, handles } of chosen) if (handles.length) entries.push({ host, key: st.key, name: st.name, base: b, market: st.market, line, handles, probedAt: new Date(now()).toISOString() });
          probed.add(storeIdentity(b, st.market));
        }
        o.log?.(`[probe] ${label}: ${cs.length} collections, games ${[...byLine.keys()].join(", ") || "none"}`);
      } catch (e) {
        if (!(e instanceof StopStore)) throw e;
        if (e.reason === "blocked" || e.reason === "challenge") for (const st of group) blocked.add(storeIdentity(st.base, st.market));
        o.log?.(`[probe] ${label}: ${e.message}`);
      }
    },
    o.concurrency ?? 2,
  );
  entries.sort((a, b) => a.key.localeCompare(b.key) || a.market.localeCompare(b.market) || a.line.localeCompare(b.line));
  return { entries, probed, blocked, requests: budget.used };
}

/**
 * At most MAX_HANDLES_PER_STORE collections a store, across all its games, so that one market's full read
 * (robots.txt, the currency, PRODUCT_PAGES pages of each) fits under the crawl's per-store cap (CRAWL_STORE_CAP, 40):
 * a store whose read cannot finish would be read in part on every run. Games take turns, each its best first.
 */
export function capHandles(byLine: readonly { line: string; handles: string[] }[], max = MAX_HANDLES_PER_STORE): { line: string; handles: string[] }[] {
  const out = byLine.map((x) => ({ line: x.line, handles: [] as string[] }));
  let left = max;
  for (let round = 0; left > 0; round++) {
    let any = false;
    for (let i = 0; i < byLine.length && left > 0; i++) {
      const h = byLine[i].handles[round];
      if (h == null) continue;
      out[i].handles.push(h);
      left--;
      any = true;
    }
    if (!any) break;
  }
  return out.filter((x) => x.handles.length);
}

/** This week's probe over last week's list: a store probed again replaces its entries, one that blocked us leaves. */
export function mergeProbe(prev: readonly CrawlStore[], r: ProbeResult): CrawlStore[] {
  const keep = prev.filter((e) => {
    const id = storeIdentity(e.base, e.market);
    return !r.probed.has(id) && !r.blocked.has(id);
  });
  return [...keep, ...r.entries].sort((a, b) => a.key.localeCompare(b.key) || a.market.localeCompare(b.market) || a.line.localeCompare(b.line));
}

export type { CrawlListing };
