import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { SITE } from "@/site.config";
import { abs, canon } from "@/lib/site";
import { lineBySlug } from "@/lib/lines";
import { GAME_TYPE_MIN, gameTypeHub, gameTypeHubs, hubItem } from "@/lib/game-hubs";
import { typeHubDescription, typeHubTitleLadder } from "@/lib/hub-snippet";
import { fitTitle } from "@/lib/seo-title";
import { storeName } from "@/lib/share";
import { todayIso } from "@/lib/preorders";
import { setById } from "@/lib/data";
import { FilterGrid } from "@/components/FilterGrid";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { typeAnswer } from "@/lib/game-answers";

export const dynamic = "force-dynamic"; // one CDN copy per URL (next.config.js CDN_PAGES), never ISR

// One game's booster boxes, starter decks and so on (owner, 2026-11-09): the page a Fusion World player opens instead of /sealed/booster-box,
// which holds every game. Only a type the game has products in exists; under GAME_TYPE_MIN products it is noindex and out of the sitemap.
export function generateMetadata({ params }: { params: { slug: string; type: string } }): Metadata {
  const line = lineBySlug(params.slug);
  const h = line ? gameTypeHub(line, params.type) : null;
  if (!line || !h) return {};
  return {
    // Written from today's data (lib/hub-snippet.ts; page scorecard 2026-11-23): one real US store price for the newest product.
    title: fitTitle(typeHubTitleLadder(line.name, line.seo?.name ?? line.short, h.type, h.label, h.items.length)),
    description: typeHubDescription({ short: line.seo?.name ?? line.short, label: h.label, items: h.items.map(hubItem), stores: SITE.stores.length, today: todayIso(), storeName }),
    ...canon(`/games/${line.slug}/${h.slug}`),
    ...(h.items.length >= GAME_TYPE_MIN ? {} : { robots: { index: false, follow: true } }),
  };
}

export default function GameTypeHub({ params }: { params: { slug: string; type: string } }) {
  const line = lineBySlug(params.slug);
  const h = line ? gameTypeHub(line, params.type) : null;
  if (!line || !h) notFound();
  // One real-data answer for "how much is a <game> <type>" (lib/game-answers.ts, DECISIONS.md 2026-11-28).
  const proper = /[A-Z].*'/.test(h.type); // "Illumineer's Trove" keeps its capitals
  const qa = typeAnswer({ short: line.seo?.name ?? line.short, items: h.items.map(hubItem), today: todayIso(), storeName }, { type: h.type, one: proper ? h.type : h.type.toLowerCase(), many: proper ? h.label : h.label.toLowerCase() });
  const items = h.items.slice().sort((a, b) => (setById(b.setId)?.releasedOn ?? "").localeCompare(setById(a.setId)?.releasedOn ?? ""));
  return (
    <div className="flex flex-col gap-6" style={{ ["--game" as string]: line.color }}>
      <Breadcrumbs items={[{ name: "Games", href: "/games" }, { name: line.name, href: `/games/${line.slug}` }, { name: h.label }]} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: `${line.name} ${h.label.toLowerCase()}`, numberOfItems: items.length, itemListElement: items.slice(0, 30).map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: abs(`/card/${p.slug}`) })) }} />
      <header>
        <h1 className="font-display text-3xl font-black">{line.name} {h.label.toLowerCase()}</h1>
        <p className="mt-2 text-sm text-muted">{h.items.length} products, most popular first. <Link className="link" href="/methodology">How it works</Link></p>
      </header>
      <FilterGrid items={items} noun={h.label.toLowerCase()} />
      {qa && (
        <section aria-labelledby="quick-answer" className="max-w-3xl">
          <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: qa.q, acceptedAnswer: { "@type": "Answer", text: qa.a } }] }} />
          <h2 id="quick-answer" className="mb-2 text-lg font-bold">{qa.q}</h2>
          <p className="text-muted">{qa.a}</p>
        </section>
      )}
      <section>
        <h2 className="mb-3 text-lg font-bold">Other {line.name} sealed products</h2>
        <div className="flex flex-wrap gap-2">
          {gameTypeHubs(line).filter((x) => x.slug !== h.slug).map((x) => <Link key={x.slug} href={`/games/${line.slug}/${x.slug}`} className="chip">{x.label}</Link>)}
          <Link href={`/games/${line.slug}`} className="chip">All {line.name} sets</Link>
        </div>
      </section>
    </div>
  );
}
