import type { Metadata } from "next";
import { SITE } from "@/site.config";
import { canon } from "@/lib/site";
import { byValue, products } from "@/lib/data";
import { rankProducts } from "@/lib/home-demand";
import { InlineAds } from "@/components/InlineAds";
import { adSearch, cardAds } from "@/lib/card-ads";
import { SEALED_ORDER as ORDER, SEALED_PLURAL as PLURAL, sealedHref } from "@/lib/hubs";
import Link from "@/components/Link";
import { TileGrid } from "@/components/ProductTile";
import { SealedSearch } from "@/components/SealedSearch";
import { fitTitle } from "@/lib/seo-title";
import { gameViews, hubItem } from "@/lib/game-hubs";
import { sealedIndexDescription, sealedIndexTitleLadder } from "@/lib/hub-snippet";
import { storeName } from "@/lib/share";
import { todayIso } from "@/lib/preorders";

export const revalidate = 86400; // data only changes with a release (DECISIONS.md, "Vercel cost")
// Written from today's data (lib/hub-snippet.ts; page scorecard 2026-11-23: position 9.4, no clicks on the old template).
export function generateMetadata(): Metadata {
  const items = products().filter((p) => p.kind === "sealed").map(hubItem);
  const title = fitTitle(sealedIndexTitleLadder(gameViews().length, items.map((i) => i.sealedType)));
  return {
    title,
    description: sealedIndexDescription({ items, games: gameViews().length, stores: SITE.stores.length, today: todayIso(), storeName }),
    ...canon("/sealed"),
    openGraph: { ...canon("/sealed").openGraph, title: title.absolute },
  };
}


// The minimal look (2026-11-13): the headline, one line, the product types as a row of chips (the page's filters: each goes to its
// own page), then the products, the newest sets first within each type.
export default function Sealed() {
  const sealed = products().filter((p) => p.kind === "sealed");
  const groups = ORDER.map((t) => ({ t, items: byValue(sealed.filter((p) => p.sealedType === t)) })).filter((g) => g.items.length);
  const types = groups.filter((g) => sealedHref(g.t));
  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">{SITE.gameShort} booster box and sealed prices</h1>
        <p className="mt-3 text-sm text-muted">The most popular products of each type, from every game. Open any product to compare every store, or a type for all of it. Upcoming sets are on the <Link href="/preorders" className="underline">pre-orders</Link> page.</p>
        {types.length > 1 && (
          <nav aria-label="Product types" className="mt-5">
            {/* One row that scrolls sideways at every width: a wrapping row changes its line count when the web font arrives. */}
            <ul className="scroller -mx-4 scroll-px-4 gap-2 px-4 sm:mx-0 sm:px-0">
              {types.map((g) => (
                <li key={g.t}>
                  <Link href={sealedHref(g.t)!} className="chip min-h-10 whitespace-nowrap">
                    {PLURAL[g.t] ?? g.t} <span className="tabular text-xs text-faint">{g.items.length}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="mt-5">
          <SealedSearch placeholder={`Search sealed: a set, a code or “booster box”`} />
        </div>
      </header>
      {groups.map((g) => {
        const href = sealedHref(g.t);
        return (
          <section key={g.t} className="home-shelf">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{PLURAL[g.t] ?? g.t}</h2>
              {href && (
                <Link href={href} className="shrink-0 text-sm font-semibold text-muted transition-colors hover:text-ink">
                  All {g.items.length} →
                </Link>
              )}
            </div>
            <TileGrid items={rankProducts(g.items).slice(0, 10)} />
          </section>
        );
      })}
      <InlineAds ads={cardAds({ kind: "sealed", limit: 10 })} search={adSearch()} page="sealed" />
    </div>
  );
}
