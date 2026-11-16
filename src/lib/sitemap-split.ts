// The one sitemap (app/sitemap.ts) cut by kind of page, so Search Console reports indexing per kind (sealed products,
// set pages, guides, game hubs, everything else) instead of one total. Same URLs as the main sitemap, nothing added.
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/site";

export const SITEMAP_TYPES = ["products", "sets", "games", "guides", "sealed-hubs", "pages"] as const;
export type SitemapType = (typeof SITEMAP_TYPES)[number];

export function typeOfPath(pathname: string): SitemapType {
  if (pathname.startsWith("/card/")) return "products";
  if (pathname.startsWith("/sets/")) return "sets";
  if (pathname === "/games" || pathname.startsWith("/games/")) return "games";
  if (pathname.startsWith("/blog/")) return "guides";
  if (pathname.startsWith("/sealed/")) return "sealed-hubs";
  return "pages";
}

export function urlsOfType(t: SitemapType) {
  return sitemap().filter((e) => typeOfPath(new URL(e.url).pathname) === t);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const day = (d: Date | string | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);

export function urlsetXml(t: SitemapType): string {
  const rows = urlsOfType(t).map((e) => `<url><loc>${esc(e.url)}</loc>${day(e.lastModified) ? `<lastmod>${day(e.lastModified)}</lastmod>` : ""}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.join("")}</urlset>`;
}

export function indexXml(): string {
  const rows = SITEMAP_TYPES.filter((t) => urlsOfType(t).length > 0).map((t) => `<sitemap><loc>${SITE_URL}/sitemaps/${t}.xml</loc></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.join("")}</sitemapindex>`;
}
