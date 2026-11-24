import type { Metadata } from "next";
import { AdBanners } from "@/components/AdBanners";
import { adSearch } from "@/lib/card-ads";
import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { SITE } from "@/site.config";
import { canon, abs } from "@/lib/site";
import { fitTitle } from "@/lib/seo-title";
import { lineBySlug } from "@/lib/lines";
import { GAME_TYPE_MIN, gameSealed, gameTypeHubs, gameView, hubItem } from "@/lib/game-hubs";
import { gameHubDescription, gameHubTitleLadder } from "@/lib/hub-snippet";
import { storeName } from "@/lib/share";
import { todayIso } from "@/lib/preorders";
import { productsInSet, refCents } from "@/lib/data";
import { money } from "@/lib/format";
import { TileGrid } from "@/components/ProductTile";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";

/** RiftCompare's giveaway closes 14 Dec 2026, 23:59 Sydney (its lib/giveaway.ts). */
const RB_GIVEAWAY_CLOSES = "2026-12-14T12:59:59Z";

export const dynamic = "force-dynamic"; // one CDN copy per URL (next.config.js CDN_PAGES), never ISR

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const line = lineBySlug(params.slug);
  if (!line) return {};
  const v = gameView(line);
  // Written from today's data (lib/hub-snippet.ts; page scorecard 2026-11-23): the kinds this game really has, then one real US
  // store price for its newest released booster box beside TCGplayer's market.
  const items = gameSealed(line).map(hubItem);
  const short = line.seo?.name ?? line.short;
  const title = fitTitle(gameHubTitleLadder(line.name, short, items.map((i) => i.sealedType)));
  return {
    title,
    description: gameHubDescription({ short, items, sets: v.sets.length, stores: SITE.stores.length, today: todayIso(), storeName }),
    ...canon(`/games/${line.slug}`),
    openGraph: { ...canon(`/games/${line.slug}`).openGraph, title: title.absolute },
  };
}

export default function GamePage({ params }: { params: { slug: string } }) {
  const line = lineBySlug(params.slug);
  if (!line) notFound();
  const v = gameView(line);
  // A game with no product today has no page (it comes back with its first product).
  if (!v.sealed) notFound();
  return (
    <div className="flex flex-col gap-8" style={{ ["--game" as string]: line.color }}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: `${line.name} sets`, numberOfItems: v.sets.length, itemListElement: v.sets.slice(0, 30).map((s, i) => ({ "@type": "ListItem", position: i + 1, name: s.name, url: abs(`/sets/${s.slug}`) })) }} />
      <div>
        <Breadcrumbs items={[{ name: "Games", href: "/games" }, { name: line.name }]} />
        <header className="game-hero">
          {line.logo && (
            <span className="game-logo mb-3" aria-hidden="true" style={{ backgroundImage: `url(${line.logo})` }} />
          )}
          <h1 className="font-display text-3xl font-black md:text-4xl">{line.name} prices</h1>
          <p className="mt-2 max-w-2xl text-muted">{line.blurb}</p>
          <p className="mt-2 text-sm text-muted">{v.sets.length} sets · {v.sealed} sealed products, compared across TCGplayer, eBay, Amazon and {SITE.stores.length} stores.</p>
          {v.newest && <p className="mt-3"><Link className="btn-primary" href={`/sets/${v.newest.slug}`}>Newest set: {v.newest.name} →</Link></p>}
        </header>
      </div>

      {/* RiftCompare's Riftbound giveaway, on the Riftbound page only and only until it closes (owner, 2026-11-22: "we need
          more people to sign up to our giveaway"). One natural contextual link to the Riftbound sister, per the network rules. */}
      {line.id === "rb" && Date.now() < Date.parse(RB_GIVEAWAY_CLOSES) && (
        <p className="-mt-4 rounded-xl border border-line p-3 text-sm">
          <b>Free Riftbound giveaway:</b> win a Miss Fortune, Captain alt art (worldwide, closes 14 Dec).{" "}
          <a className="font-semibold text-brand underline-offset-2 hover:underline" href="https://riftcompare.com/giveaway?utm_source=tcgprices&utm_medium=referral&utm_campaign=giveaway">Enter free on RiftCompare →</a>
        </p>
      )}

      <nav aria-label={`${line.name} product types`} className="-mt-4 flex flex-wrap gap-2">
        {gameTypeHubs(line).filter((h) => h.items.length >= GAME_TYPE_MIN).map((h) => (
          <Link key={h.slug} href={`/games/${line.slug}/${h.slug}`} className="chip hover:border-brand">{h.label} <span className="text-muted">· {h.items.length}</span></Link>
        ))}
      </nav>

      {v.boxes.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">{line.name} booster boxes</h2>
          <TileGrid items={v.boxes.slice(0, 6)} />
        </section>
      )}

      {v.decks.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">{line.name} starter decks</h2>
          <TileGrid items={v.decks.slice(0, 6)} />
        </section>
      )}


      <section>
        <h2 className="mb-3 text-xl font-bold">Every {line.name} set, newest first</h2>
        <div className="overflow-hidden rounded-xl border border-ink-700/60">
          <table className="w-full text-sm">
            <thead className="bg-ink-850 text-left text-xs uppercase text-muted">
              <tr><th className="px-3 py-2">Set</th><th className="px-3 py-2">Released</th><th className="px-3 py-2 text-right">Sealed</th><th className="px-3 py-2 text-right">Booster box</th></tr>
            </thead>
            <tbody>
              {v.sets.map((s) => {
                const sealed = productsInSet(s.id).filter((p) => p.kind === "sealed" && p.sealedType !== "Insert");
                const box = sealed.find((p) => p.sealedType === "Booster Box");
                const value = box ? refCents(box.id) : null;
                return (
                  <tr key={s.id} className="border-t border-ink-800">
                    <td className="px-3 py-2"><Link className="link" href={`/sets/${s.slug}`}>{s.name}</Link>{s.upcoming && <span className="tag ml-2">Upcoming</span>}</td>
                    <td className="px-3 py-2 text-muted">{s.releasedOn}</td>
                    <td className="px-3 py-2 text-right">{sealed.length}</td>
                    <td className="px-3 py-2 text-right font-semibold">{value ? money(value) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* The ad banners sit below the page's own content, never under the hero (2026-11-19, core-update quality pass). */}
      <AdBanners {...adSearch(null, { line: line.id })} page="game" />
    </div>
  );
}
