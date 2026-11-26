import { boardRows } from "@/lib/drop-board-data";
import type { MetadataRoute } from "next";
import { editions } from "@/lib/spread-store";
import { SPREAD_PATH } from "@/lib/spread";
import { historyOf, indexSignals, meta, products, setById } from "@/lib/data";
import { productLastmod } from "@/lib/sitemap-lastmod";
import { posts } from "@/lib/posts";
import { preorderSetList, sealedHubs, sealedSets } from "@/lib/hubs";
import { preorderPath } from "@/lib/preorders";
import { SITE_URL } from "@/lib/site";
import { creatorsOn } from "@/lib/creators";
import { cardIndexable, rankForSitemap, sitemapProductCap } from "@/lib/indexing";
import { GAME_TYPE_MIN, gameTypeHubs, gameViews } from "@/lib/game-hubs";
import { withoutOffSeasonSales } from "@/lib/sale-seasons";

export const revalidate = 86400;

// Sealed only (owner, 2026-11-06): the sitemap lists the strong pages and nothing else. The home page, the sealed
// hubs, every set that has sealed product, the pre-order pages, the guides and the few pages people search for, and
// each sealed product page that asks to be indexed (a reference price or a listing, or an upcoming set; never a pack
// insert: lib/indexing.ts). No card URL, no card hub and no retired tool: those 301 (next.config.js,
// lib/card-redirects.ts).
// Pages whose words do not change with the day's prices carry no lastmod: dating them "today" on every build is the
// re-dating to look fresh that Google's guidance calls search-engine-first (search-engine-first audit, 2026-11-19).
const PROSE_PAGES = new Set(["/about", "/methodology", "/list-your-store", "/how-we-pick-stores", "/creators", "/embed", "/tools/selling-fees"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const at = meta()?.updatedAt ? new Date(meta()!.updatedAt) : new Date();
  const fixed = ["", "/sealed", "/sets", "/preorders", "/tools/deal-finder", ...(boardRows().length ? ["/drops"] : []), "/tools/is-this-a-good-price", "/price-report", "/black-friday", "/cyber-monday", ...withoutOffSeasonSales(["/boxing-day", "/january-sales"], new Date().toISOString().slice(0, 10)), "/daily", ...(posts().length ? ["/blog"] : []), "/stores", "/about", "/methodology", "/data", ...(editions().length ? [SPREAD_PATH, ...editions().map((e) => `${SPREAD_PATH}/${e.id}`)] : []), "/list-your-store", ...(creatorsOn() ? ["/creators"] : [])];
  return [
    ...fixed.map((p) => ({ url: `${SITE_URL}${p}`, ...(PROSE_PAGES.has(p) ? {} : { lastModified: at }), changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.8 })),
    // Every game with a product today, and each of its product types with enough products to be a page worth finding.
    ...(gameViews().length ? ["/games", ...gameViews().map((v) => `/games/${v.line.slug}`)] : []).map((p) => ({ url: `${SITE_URL}${p}`, lastModified: at, changeFrequency: "daily" as const, priority: 0.9 })),
    ...gameViews().flatMap((v) => gameTypeHubs(v.line).filter((h) => h.items.length >= GAME_TYPE_MIN).map((h) => ({ url: `${SITE_URL}/games/${v.line.slug}/${h.slug}`, lastModified: at, changeFrequency: "daily" as const, priority: 0.8 }))),
    ...sealedHubs().map((h) => ({ url: `${SITE_URL}/sealed/${h.slug}`, lastModified: at, changeFrequency: "daily" as const, priority: 0.8 })),
    ...preorderSetList().map((s) => ({ url: `${SITE_URL}${preorderPath(s)}`, lastModified: at, changeFrequency: "daily" as const, priority: 0.8 })),
    ...sealedSets().map((s) => ({ url: `${SITE_URL}/sets/${s.slug}`, lastModified: at, priority: 0.7 })),
    ...posts().map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: new Date(p.updated ?? p.date), priority: 0.6 })),
    ...rankForSitemap(
      products()
        .filter((p) => p.kind === "sealed")
        .map((p) => ({ p, s: indexSignals(p) }))
        .filter(({ p, s }) => cardIndexable(p, s, setById(p.setId))),
      sitemapProductCap(),
    ).map((p) => {
      // The day this product's reference price last moved, never "today" for every URL (lib/sitemap-lastmod.ts); no history, no lastmod.
      const lm = productLastmod(historyOf(p), at);
      return { url: `${SITE_URL}/card/${p.slug}`, ...(lm ? { lastModified: lm } : {}), priority: 0.6 };
    }),
  ];
}
