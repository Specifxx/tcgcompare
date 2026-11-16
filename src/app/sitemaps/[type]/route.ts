import { SITEMAP_TYPES, urlsetXml, type SitemapType } from "@/lib/sitemap-split";

export function generateStaticParams() {
  return [];
}

export function GET(_req: Request, { params }: { params: { type: string } }) {
  const t = params.type.replace(/\.xml$/, "");
  if (!(SITEMAP_TYPES as readonly string[]).includes(t)) return new Response("Not found", { status: 404 });
  return new Response(urlsetXml(t as SitemapType), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
}
