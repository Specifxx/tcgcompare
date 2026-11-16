import { indexXml } from "@/lib/sitemap-split";

// Index of the per-kind sitemaps; /sitemap.xml stays the one full list. Held six hours by the CDN like every page.
export function GET() {
  return new Response(indexXml(), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
}
