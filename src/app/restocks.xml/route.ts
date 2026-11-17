import { SITE } from "@/site.config";
import { productById } from "@/lib/data";
import { readRestocks } from "@/lib/restocks";
import { SITE_URL } from "@/lib/site";
import { escapeHtml } from "@/lib/html";
import { CURRENCY } from "@/lib/site-types";
import { money } from "@/lib/format";
import { shortName } from "@/lib/names";

export const revalidate = 86400;

// RSS of /restocks: the newest 50 back-in-stock events. Display only (lib/restocks.ts): no price claim beyond the store's own price.
export function GET() {
  const file = readRestocks();
  const stores = new Map(SITE.stores.map((s) => [s.key, s]));
  const items = (file?.events ?? [])
    .map((e) => ({ e, p: productById(e.p), s: stores.get(e.s) }))
    .filter((r) => r.p && r.s)
    .slice(0, 50)
    .map(({ e, p, s }) => {
      const title = `${shortName(p!.name)} back in stock at ${s!.name} (${money(e.c, CURRENCY[s!.market])})`;
      const link = `${SITE_URL}/card/${p!.slug}`;
      return `<item><title>${escapeHtml(title)}</title><link>${link}</link><guid isPermaLink="false">${escapeHtml(`${e.p}|${e.s}|${e.r}|${e.t}`)}</guid><pubDate>${new Date(e.t).toUTCString()}</pubDate><description>${escapeHtml(`Sold out at ${s!.name} at the last check, in stock now. Compare every store on the product page.`)}</description></item>`;
    })
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeHtml(SITE.name)}: back in stock</title><link>${SITE_URL}/restocks</link><description>Sealed trading card product back in stock at independent stores.</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=86400" } });
}
