import type { Metadata } from "next";
import { AdBanners } from "@/components/AdBanners";
import Link from "@/components/Link";
import { notFound, permanentRedirect } from "next/navigation";
import { gameHubOfSet } from "@/lib/data";
import { SITE } from "@/site.config";
import { canon } from "@/lib/site";
import { setBySlug, summaryOf } from "@/lib/data";
import { preorderSetList, sealedInSet } from "@/lib/hubs";
import { isPreorder, preorderPath } from "@/lib/preorders";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { shortName } from "@/lib/names";
import { TileGrid } from "@/components/ProductTile";
import { JsonLd } from "@/components/JsonLd";
import { abs } from "@/lib/site";
import { fitTitle } from "@/lib/seo-title";
import { headlineWord, seoSet, setPhrase, setTitleLadder } from "@/lib/game-seo";
import { setFacts } from "@/lib/set-facts";
import { lineOfSet } from "@/lib/lines";
import { storeName } from "@/lib/share";
import { refCents } from "@/lib/data";
import { todayIso } from "@/lib/preorders";
import { postsAbout } from "@/lib/posts";
import { imageAt } from "@/lib/image";
import { SealedQuickBuy } from "@/components/SealedQuickBuy";
import { InlineAds } from "@/components/InlineAds";
import { adSearch, cardAds } from "@/lib/card-ads";
import { sealedSets } from "@/lib/hubs";
import { Fold, Folds } from "@/components/Fold";
import { packOfBox } from "@/lib/packs";
import { ShareButton } from "@/components/ShareButton";

export const dynamic = "force-dynamic"; // one CDN copy per URL (next.config.js CDN_PAGES), never ISR

// Sealed only (owner, 2026-11-06): a set page is the set's booster boxes, packs, tins and decks at every store. A set
// with no sealed product (promo and tournament card groups) has no page any more: it 301s to /sealed.

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const s = setBySlug(params.slug);
  if (!s) return {};
  const sealed = sealedInSet(s.id);
  const count = sealed.length;
  if (!count) return {};
  // In the game's own words (lib/game-seo.ts, DECISIONS.md 2026-11-18): "One Piece The Dominance of God (OP18) Booster
  // Box & Sealed Prices", never "TCG The Dominance of God".
  const types = sealed.map((p) => p.sealedType);
  const title = fitTitle(setTitleLadder(s, types));
  const word = headlineWord(types, lineOfSet(s)).toLowerCase().replace("etb", "ETB");
  return {
    title,
    description: `${setPhrase(s)} ${word}, pack and sealed prices at every store we track: ${count} sealed product${count === 1 ? "" : "s"}, the cheapest in-stock price in the US, UK, Canada and Australia, beside TCGplayer, eBay and Amazon. Updated daily.`,
    ...canon(`/sets/${s.slug}`),
    openGraph: { ...canon(`/sets/${s.slug}`).openGraph, title: title.absolute },
  };
}

export default function SetPage({ params }: { params: { slug: string } }) {
  const s = setBySlug(params.slug);
  if (!s) notFound();
  const sealed = sealedInSet(s.id);
  if (!sealed.length) permanentRedirect(gameHubOfSet(s.slug));
  const line = lineOfSet(s);
  // Neighbours and "other sets" stay inside the set's own game (Cardmarket's game > set > product tree): a Pokémon
  // set page linked Magic and Digimon sets before (DECISIONS.md 2026-11-18).
  const listed = sealedSets().filter((x) => !line || x.line === s.line);
  const seo = seoSet(s);
  const facts = setFacts({
    phrase: setPhrase(s),
    releasedOn: s.releasedOn ?? null,
    upcoming: !!s.upcoming,
    today: todayIso(),
    products: sealed.map((p) => { const sm = summaryOf(p.id); return { name: shortName(p.name), sealedType: p.sealedType, tcgCents: refCents(p.id), best: sm.best, inStockSources: sm.inStockSources }; }),
    storeName,
  });
  const i = listed.findIndex((x) => x.id === s.id);
  const newer = i > 0 ? listed[i - 1] : null;
  const older = i >= 0 && i < listed.length - 1 ? listed[i + 1] : null;
  const others = listed.filter((x) => x.id !== s.id).slice(0, 12);
  const guides = postsAbout([s.name, s.code]).slice(0, 4);
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${s.name} sealed products`,
          numberOfItems: sealed.length,
          itemListElement: sealed.slice(0, 30).map((p, i) => ({ "@type": "ListItem", position: i + 1, name: shortName(p.name), url: abs(`/card/${p.slug}`) })),
        }}
      />
      {/* The minimal look (2026-11-13): the headline, one line and the way to the set's pre-order page, then the products: the buy
          block first (the page's earner), the grid under it. The set's guides are folded under the grid. */}
      <div>
        <Breadcrumbs items={[line ? { name: line.short, href: `/games/${line.slug}` } : { name: "Sets", href: "/sets" }, { name: s.name }]} />
        <header>
          <p className="eyebrow">{s.upcoming ? "Upcoming" : "Released"} {s.releasedOn}{seo.code ? ` · ${seo.code}` : ""}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-5xl">{seo.game ? `${seo.game} ` : ""}{seo.name} booster box &amp; sealed prices</h1>
          <p className="mt-3 text-sm text-muted">
            {sealed.length} sealed product{sealed.length === 1 ? "" : "s"}, compared across every store we track, TCGplayer, eBay and Amazon.
          </p>
          <ShareButton path={`/sets/${s.slug}`} name={`${s.name} sealed prices`} medium="set" text={`${s.name}: every booster box and sealed price, compared on ${SITE.name}`} className="mt-3" />
          {preorderSetList().some((x) => x.id === s.id) && (
            <p className="mt-3 text-sm"><Link className="link font-semibold" href={preorderPath(s)}>{isPreorder(s) ? `${s.name} pre-order prices at every store →` : `${s.name} booster box prices at every store →`}</Link></p>
          )}
        </header>
        <AdBanners {...adSearch(s.name, s)} page="set" className="mt-6" />
      </div>
      <SealedQuickBuy
        title={`Buy ${s.name} booster boxes and sealed`}
        items={sealed.slice(0, 6).map((p) => {
          const pk = packOfBox(p, sealed);
          return { id: p.id, slug: p.slug, name: shortName(p.name), image: imageAt(p.image, "200w"), best: summaryOf(p.id).best, stores: summaryOf(p.id).listedSources, pack: pk ? { slug: pk.slug, best: summaryOf(pk.id).best } : null };
        })}
      />
      {facts.length > 0 && (
        <section aria-label={`About ${s.name}`} className="max-w-3xl text-sm leading-relaxed text-muted">
          <p>{facts.join(" ")}</p>
          <p className="mt-2">Prices checked daily. <Link className="link" href="/how-we-pick-stores">How we pick and vet stores</Link> · <Link className="link" href="/methodology">How prices are compared</Link></p>
        </section>
      )}
      <section>
        <h2 className="mb-6 font-display text-2xl font-bold tracking-tight sm:text-3xl">Every {s.name} sealed product</h2>
        <TileGrid items={sealed} />
      </section>
      <InlineAds ads={cardAds({ setId: s.id, fill: true, limit: 10 })} search={adSearch(s.name, s)} page="set" />
      {guides.length > 0 && (
        <Folds label={`More about ${s.name}`} className="">
          <Fold id="guides-h" title={`${s.name} guides`}>
            <ul className="list-disc pl-5 text-sm">{guides.map((g) => <li key={g.slug}><Link className="link" href={`/blog/${g.slug}`}>{g.title}</Link></li>)}</ul>
          </Fold>
        </Folds>
      )}
      <nav className="flex flex-wrap justify-between gap-3 text-sm" aria-label="Neighbouring sets">
        {older ? <Link className="link" href={`/sets/${older.slug}`}>← {older.name}</Link> : <span />}
        {newer && <Link className="link" href={`/sets/${newer.slug}`}>{newer.name} →</Link>}
      </nav>
      {others.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold tracking-tight">Other {line?.short ?? SITE.gameShort} sets</h2>
          <div className="flex flex-wrap gap-2">{others.map((x) => <Link key={x.id} href={`/sets/${x.slug}`} className="chip">{x.name}</Link>)}</div>
        </section>
      )}
    </div>
  );
}
