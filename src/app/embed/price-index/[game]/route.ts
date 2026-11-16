import { SITE } from "@/site.config";
import { SITE_URL } from "@/lib/site";
import { gameViews } from "@/lib/game-hubs";
import { lineBySlug } from "@/lib/lines";
import { changeOver, INDEX_MIN_PRODUCTS, loadIndex } from "@/lib/open-data";
import { indexWidgetHtml } from "@/lib/open-embed";

// The index widget (lib/open-embed.ts): "all" or a game's slug. One static copy per game, built with the deploy.
export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = () => [{ game: "all" }, ...gameViews().map((v) => ({ game: v.line.slug }))];

export function GET(_req: Request, { params }: { params: { game: string } }) {
  const f = loadIndex();
  const days = f?.days ?? [];
  const last = days[days.length - 1];
  const line = params.game === "all" ? null : lineBySlug(params.game);
  const pick = (d: (typeof days)[number]) => (line ? d.games[line.slug] : d.all);
  const p = last ? pick(last) : undefined;
  const ok = !!p && (line ? p.n >= INDEX_MIN_PRODUCTS : true);
  const html = indexWidgetHtml({
    site: SITE.name,
    siteUrl: SITE_URL,
    title: `${line ? line.short : "All games"} sealed price index`,
    level: ok ? p!.level : null,
    week: ok ? changeOver(days, pick, 7) : null,
    n: ok ? p!.n : 0,
    median: ok ? p!.median : null,
    date: last?.d ?? null,
  });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex", "Cache-Control": "public, s-maxage=86400", "Access-Control-Allow-Origin": "*" } });
}
