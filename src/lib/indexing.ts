// Which card pages ask to be indexed, and how long a price in JSON-LD is good for.
//
// The index gate (Grok growth report, owner, 2026-11-17; Google's scaled-content and soft-404 guidance). A sealed
// product page asks to be indexed, and goes in the sitemap, only when it has something of its own to say TODAY:
//   - two or more IN-STOCK, PRICED STORE offers (never eBay, Amazon or the TCGplayer reference row), or
//   - one such offer plus four or more price-history points in the last 30 days (a page with a track record), and
//   - the data behind it is under 14 days old (the import's own time, and each offer's store read time).
// Everything else stays reachable (noindex, follow: crawlers still walk its links and nothing 404s), and a page whose
// data went stale is noindex until the next good read. A product in an upcoming set is kept while it has any priced
// listing or reference (reveal-week searches), still subject to the freshness rule. Pack inserts never.
// Query-string variants never reach the index: robots.txt blocks `/*?` and every page names its clean canonical.
export const INDEX_MIN_OFFERS = 2;
export const INDEX_MIN_HISTORY = 4;
export const INDEX_HISTORY_DAYS = 30;
export const INDEX_MAX_AGE_DAYS = 14;

export interface IndexSignals {
  /** In-stock, priced store offers whose store was read within INDEX_MAX_AGE_DAYS. */
  storeOffers: number;
  /** Distinct history days in the last INDEX_HISTORY_DAYS. */
  historyPoints: number;
  /** Any priced listing or reference at all (for an upcoming set). */
  anyPrice: boolean;
  /** The catalogue's own import time is under INDEX_MAX_AGE_DAYS old. */
  fresh: boolean;
}

// Games a sister site still ranks for in Google (MTG Compare, DexCompare for both Pokémon lines, OP Compare, Lorcana Compare,
// Rift Compare): their product pages here are live and noindex, so two of our hosts never compete for one product
// (November 2026 core update, DECISIONS.md 2026-11-18). YGO, Gundam, Bandai and Cyberpunk Compare already lost Google.
export const SISTER_RANKED_LINES: ReadonlySet<string> = new Set(["mtg", "pkm", "pkj", "op", "lor", "rb"]);

export function cardIndexable(p: { kind: "card" | "sealed"; sealedType: string | null }, s: IndexSignals, set: { upcoming: boolean; line?: string } | null | undefined): boolean {
  if (set?.line && SISTER_RANKED_LINES.has(set.line)) return false;
  if (p.sealedType === "Insert") return false; // pack inserts, as before (DECISIONS.md, 2026-10-28)
  if (!s.fresh) return false;
  if (set?.upcoming) return s.anyPrice;
  return s.storeOffers >= INDEX_MIN_OFFERS || (s.storeOffers >= 1 && s.historyPoints >= INDEX_MIN_HISTORY);
}

/** Whether an ISO time is under INDEX_MAX_AGE_DAYS old at `now`. A missing time is not fresh. */
export function isFresh(at: string | null | undefined, now = Date.now()): boolean {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) && now - t < INDEX_MAX_AGE_DAYS * 86_400_000;
}

/** Store prices refresh on the daily import, so a price in JSON-LD is good until tomorrow (schema.org priceValidUntil, YYYY-MM-DD). */
export function priceValidUntil(now = Date.now()): string {
  return new Date(now + 86400e3).toISOString().slice(0, 10);
}

// SITEMAP CAP (Gemini SEO report, owner's yes 2026-11-17: cutting further is fine). Indexable stays the gate for the
// robots meta; the sitemap lists only the strongest of those, so a new domain's crawl budget goes to pages with the most
// stores and a price track record. The rest stay indexable and reachable by links, and Google finds them there.
// Grows by SITEMAP_STEP a week from SITEMAP_START_DAY up to SITEMAP_MAX (the weekly step stands in for "expand only when
// the last batch is indexed"; the weekly GSC script's index diet still trims what Google refuses).
export const SITEMAP_START = 1200;
export const SITEMAP_STEP = 300;
export const SITEMAP_MAX = 2900;
export const SITEMAP_START_DAY = Math.floor(Date.UTC(2026, 10, 17) / 86_400_000);

export function sitemapProductCap(now = Date.now()): number {
  const weeks = Math.max(0, Math.floor((Math.floor(now / 86_400_000) - SITEMAP_START_DAY) / 7));
  return Math.min(SITEMAP_MAX, SITEMAP_START + weeks * SITEMAP_STEP);
}

/** Highest first: most fresh in-stock stores, then longest 30-day history; stable on the slug. */
export function rankForSitemap<T extends { slug: string }>(rows: { p: T; s: IndexSignals }[], cap: number): T[] {
  return [...rows]
    .sort((a, b) => b.s.storeOffers - a.s.storeOffers || b.s.historyPoints - a.s.historyPoints || (a.p.slug < b.p.slug ? -1 : 1))
    .slice(0, cap)
    .map((r) => r.p);
}
