import type { Metadata } from "next";
import { DiscordCta } from "@/components/DiscordCta";
import { ExtensionCta } from "@/components/ExtensionCta";
import Link from "@/components/Link";
import { Fragment } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { retiredCardTarget } from "@/lib/card-redirects";
import { culledEntry, culledRedirect } from "@/lib/culled";
import { gameHubOfLine, gameHubOfSet, storeLowsOf, historyThrough } from "@/lib/data";
import { SITE } from "@/site.config";
import { byValue, historyOf, indexSignals, looseSingleSetId, meta, priceOf, productBySlug, productsInSet, refCents, setById, setBySlug } from "@/lib/data";
import { imageAt } from "@/lib/image";
import { money, pct } from "@/lib/format";
import { buyerRead } from "@/lib/buyer-read";
import { sourceNameServer } from "@/lib/sources";
import { MARKETS, MARKET_LABEL, type Market, type Offer } from "@/lib/site-types";
import { shortName } from "@/lib/names";
import { ebayQueryOf, lineOfSet, tcgplayerSlugOf } from "@/lib/lines";
import { ebayQueryFor, jsonLdOffers } from "@/lib/product-page";
import { PriceTable } from "@/components/PriceTable";
import { VaultOwn } from "@/components/vault/VaultOwn";
import { PriceAlert } from "@/components/PriceAlert";
import { WatchPrice } from "@/components/WatchPrice";
import { SeenPrice } from "@/components/SinceLastVisit";
import { lowestByMarket } from "@/lib/alert-feed";
import { CheckedAgo } from "@/components/CardBuy";
import { PriceHistory } from "@/components/PriceHistory";
import { TileGrid } from "@/components/ProductTile";
import { JsonLd } from "@/components/JsonLd";
import { AdSlot } from "@/components/AdSlot";
import { InlineAds } from "@/components/InlineAds";
import { adSearch, cardAds } from "@/lib/card-ads";
import { amazonSearchUrls, goHref } from "@/lib/affiliate";
import { TcgplayerCyberBanner } from "@/components/TcgplayerCyberBanner";
import { cyberBannerState } from "@/lib/tcgplayer-cyber";
import { amazonCarries, amazonCells } from "@/lib/amazon-live";
import { abs } from "@/lib/site";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ShareButton } from "@/components/ShareButton";
import { DropShare } from "@/components/DropShare";
import { ToolInterest } from "@/components/ToolInterest";
import { attrHref, rarityHref, sealedHref } from "@/lib/hubs";
import { packOfBox } from "@/lib/packs";

import { cardTitleCandidates, fitTitle } from "@/lib/seo-title";
import { namesGame, productTitleLadder, setPhrase } from "@/lib/game-seo";
import { cardIndexable, priceValidUntil } from "@/lib/indexing";
import { gtinLabel, gtinLd } from "@/lib/gtin";
import { storeCheckedMap } from "@/lib/store-checked";
import { JumpLinks } from "@/components/JumpLinks";

export const dynamic = "force-dynamic"; // one CDN copy per URL (next.config.js CDN_PAGES), never ISR

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = productBySlug(params.slug);
  if (!p) return {};
  const set = setById(p.setId);
  const ref = refCents(p.id);
  const name = shortName(p.name);
  // Sealed: the game's own words lead ("One Piece The Dominance of God Booster Box (OP18) Price", lib/game-seo.ts,
  // DECISIONS.md 2026-11-18); a card keeps "<card> <number> Price — <game> <set>". Stepped down to fit 60 characters.
  const title = fitTitle(p.kind === "sealed" ? productTitleLadder(name, set ?? null) : cardTitleCandidates(name, p.number, set?.name ?? null, false)).absolute;
  const stores = new Set(priceOf(p.id).offers.map((o) => o.source)).size;
  const game = set ? lineOfSet(set) : null;
  const lead = set && game && !namesGame(name, game) ? `${game.seo?.name ?? game.short} ${name}` : name;
  const description = `${lead} (${set ? setPhrase(set) : SITE.gameShort}${p.rarity ? `, ${p.rarity}` : ""}) ${ref ? `is worth about ${money(ref)} today` : "has no TCGplayer market price yet"}. Compare ${stores} live prices from TCGplayer, eBay and ${game ? `${game.short} ` : ""}stores, with price history.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/card/${p.slug}` },
    // Pack inserts (worth cents, DECISIONS.md 2026-10-28) and cards with no
    // price and no listing at all (lib/indexing.ts) stay out of the index.
    ...(cardIndexable(p, indexSignals(p), set) ? {} : { robots: { index: false, follow: true } }),
    // The image is ./opengraph-image.tsx: the card and its real price gap (lib/share.ts).
    openGraph: { type: "website", siteName: SITE.name, url: `/card/${p.slug}`, title, description },
    twitter: { card: "summary_large_image" },
  };
}

export default function CardPage({ params }: { params: { slug: string } }) {
  const p = productBySlug(params.slug);
  if (!p) {
    // A single card from before the site went sealed-only: a permanent redirect to its set (lib/card-redirects.ts).
    const to = retiredCardTarget(params.slug, (s) => (setBySlug(s)?.productCount ?? 0) > 0);
    if (to) permanentRedirect(to);
    // A product the sealed focus dropped (lib/import/focus.ts): its set, or its game when the set is empty too.
    const culled = culledEntry(params.slug);
    if (culled) permanentRedirect(culledRedirect(culled, (s) => (setBySlug(s)?.productCount ?? 0) > 0, gameHubOfLine, gameHubOfSet));
    // A single that TCGplayer filed as sealed (lib/data.ts isLooseSingle): its set, or the sealed hub.
    const loose = looseSingleSetId(params.slug);
    if (loose != null) {
      const set = setById(loose);
      permanentRedirect(set && set.productCount > 0 ? `/sets/${set.slug}` : gameHubOfSet(set?.slug ?? ""));
    }
    notFound();
  }
  const set = setById(p.setId);
  const e = priceOf(p.id);
  const ref = refCents(p.id);
  const m = meta();
  const series = historyOf(p);
  const name = shortName(p.name);
  // The game's own words lead the eBay search unless the product's name already says the whole phrase (lib/product-page.ts).
  const ebayQuery = ebayQueryFor(name, ebayQueryOf(set));
  const pack = p.kind === "sealed" ? packOfBox(p, productsInSet(p.setId)) : null;
  const packCents = pack ? refCents(pack.id) : null;
  const related = byValue(productsInSet(p.setId).filter((x) => x.id !== p.id && x.kind === p.kind)).slice(0, 6);
  const inStock = e.offers.filter((o) => o.inStock);
  // In-stock US-dollar offers, never eBay or Amazon: no structured data carries an eBay price (2026-11-14).
  const usOffers = jsonLdOffers(e.offers);
  const read = buyerRead({
    name,
    sealedType: p.kind === "sealed" ? p.sealedType : null,
    refCents: ref,
    tcgLowCents: Object.values(e.tcg).map((t) => t.low).filter((c): c is number => c != null).sort((x, y) => x - y)[0] ?? null,
    history: series,
    today: historyThrough(),
    offers: e.offers,
    storeName: (o) => sourceNameServer(o as Offer),
    set: set ? { name: set.name, releasedOn: set.releasedOn, upcoming: set.upcoming } : null,
    siblings: p.kind === "sealed" ? productsInSet(p.setId).filter((x) => x.id !== p.id && x.kind === "sealed").map((x) => ({ name: shortName(x.name), sealedType: x.sealedType, refCents: refCents(x.id) })) : [],
    money,
    marketOrder: MARKETS,
    ebayPrices: false, // no eBay price on this site, ever (src/lib/no-ebay-prices.ts)
    marketName: (mk) => (mk === "US" || mk === "UK" ? `the ${MARKET_LABEL[mk as Market]}` : MARKET_LABEL[mk as Market] ?? String(mk)),
  });
  // Sealed only: the markets' tagged searches, upgraded to the item's own page and this build's price where the API found them.
  // When each store's price was read (owner's UX review, P0 2): the row says "Checked 3 hours ago".
  const checked = storeCheckedMap(m, SITE.stores, e.offers.map((o) => o.source));
  const amazon = p.kind === "sealed" && amazonCarries(p) ? amazonCells(p.id, amazonSearchUrls(`${SITE.game} ${name}`)) : null;
  return (
    <article className="flex flex-col gap-8">
      {/* Product markup only when a real in-stock US offer backs it (2026-11-04,
          DECISIONS.md): Google treats a Product with none of offers, review or
          aggregateRating as an error, so a card with only a reference price
          emits no Product rather than an invalid one. */}
      {usOffers.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            image: p.image ? imageAt(p.image, "in_1000x1000") : undefined,
            sku: String(p.id),
            productID: `tcgplayer:${p.id}`,
            ...gtinLd(p.upc),
            brand: { "@type": "Brand", name: (set ? lineOfSet(set)?.name : null) ?? SITE.game },
            category: p.kind === "card" ? "Trading card" : "Sealed trading card product",
            url: abs(`/card/${p.slug}`),
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "USD",
              lowPrice: (Math.min(...usOffers.map((o) => o.cents)) / 100).toFixed(2),
              highPrice: (Math.max(...usOffers.map((o) => o.cents)) / 100).toFixed(2),
              offerCount: usOffers.length,
              availability: "https://schema.org/InStock",
              priceValidUntil: priceValidUntil(),
            },
          }}
        />
      )}
      {/* Game, then set, then product (Cardmarket's hierarchy, DECISIONS.md 2026-11-18): each crumb is a real hub. */}
      <Breadcrumbs items={[(set && lineOfSet(set)) ? { name: lineOfSet(set)!.short, href: `/games/${lineOfSet(set)!.slug}` } : { name: "Sealed", href: "/sealed" }, ...(set ? [{ name: set.name, href: `/sets/${set.slug}` }] : []), { name }]} />
      {/* Sticky jump links (owner's UX review, P1 13: the page was ~9,500px tall). */}
      <JumpLinks links={[{ id: "prices", label: "Prices" }, { id: "history", label: "History" }, { id: "facts", label: "Facts" }, { id: "faq", label: "Is it worth it?" }]} />
      {/* Phones: the two columns are `contents`, so their parts interleave by `order`: the name and price, the prices, the price
          history, the price alert, the facts, the read (Fiverr usability review, 2026-11-25: "the price history should really be
          above" the email form). From md the columns are boxes again and the orders reset. */}
      <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr] md:gap-8">
        <div className="contents md:order-1 md:flex md:flex-col md:gap-4">
          {p.image && <img src={imageAt(p.image, "400w")!} alt={`${name} ${SITE.gameShort} card`} className="hidden w-full rounded-xl md:block" width={400} height={560} />}
          {/* Price history beside the best price (P1 13): the left column on a desktop, right under the prices on a phone. */}
          <section id="history" className="card-surface order-3 scroll-mt-28 p-4 md:order-none">
            <h2 className="mb-2 text-lg font-bold">Price history</h2>
            <PriceHistory tcg={series} lows={storeLowsOf(p)} fx={m?.fx} through={historyThrough()} days={365} />
          </section>
          <h2 id="facts" className="sr-only order-5 scroll-mt-28 md:order-none">Product facts</h2>
          <dl className="card-surface order-5 grid md:order-none grid-cols-2 gap-x-3 gap-y-1.5 p-4 text-sm">
            {set && (<><dt className="text-muted">Set</dt><dd><Link className="link" href={`/sets/${set.slug}`}>{set.name}</Link></dd></>)}
            {p.number && (<><dt className="text-muted">Number</dt><dd>{p.number}</dd></>)}
            {p.rarity && (<><dt className="text-muted">Rarity</dt><dd>{rarityHref(p.rarity) ? <Link className="link" href={rarityHref(p.rarity)!}>{p.rarity}</Link> : p.rarity}</dd></>)}
            {p.upc && (<><dt className="text-muted">{gtinLabel(p.upc)} barcode</dt><dd className="tabular-nums">{p.upc}</dd></>)}
            <dt className="text-muted">TCGplayer ID</dt><dd className="tabular-nums">{p.id}</dd>
            {p.sealedType && (<><dt className="text-muted">Type</dt><dd>{sealedHref(p.sealedType) ? <Link className="link" href={sealedHref(p.sealedType)!}>{p.sealedType}</Link> : p.sealedType}</dd></>)}
            {Object.entries(p.attrs).slice(0, 8).map(([k, v]) => { const hubs = attrHref(k, v); return (<Fragment key={k}><dt className="text-muted">{k.replace(/([a-z])([A-Z])/g, "$1 $2")}</dt><dd>{hubs ? hubs.map((l, i) => <Fragment key={l.label}>{i > 0 ? ", " : ""}{l.href ? <Link className="link" href={l.href}>{l.label}</Link> : l.label}</Fragment>) : v}</dd></Fragment>); })}
          </dl>
        </div>
        <div className="contents md:order-2 md:flex md:min-w-0 md:flex-col md:gap-6">
          <header className="order-1 min-w-0 md:order-none">
            <div className="flex items-start gap-3">
              {p.image && <img src={imageAt(p.image, "200w")!} alt={name} className="w-20 shrink-0 rounded-md md:hidden" width={80} height={112} />}
              <h1 className="min-w-0 flex-1 font-display text-2xl font-bold tracking-tight md:text-3xl">{name} {p.number && <span className="text-muted">{p.number}</span>} price</h1>
              <ShareButton path={`/card/${p.slug}`} name={`${name}${p.number ? ` ${p.number}` : ""}`} medium={p.kind === "sealed" ? "sealed" : "card"} offers={e.offers} compact className="mt-1" />
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <p><span className="tabular font-display text-3xl font-bold text-ink">{money(ref)}</span> <span className="text-sm text-muted">TCGplayer market</span></p>
              <p className="text-sm">7d <span className={(e.change7d ?? 0) >= 0 ? "text-up" : "text-down"}>{pct(e.change7d)}</span> · 30d <span className={(e.change30d ?? 0) >= 0 ? "text-up" : "text-down"}>{pct(e.change30d)}</span></p>
              <p className="text-sm text-muted">{inStock.length} in-stock listing{inStock.length === 1 ? "" : "s"} worldwide</p>
            </div>
            {pack && packCents != null && (
              <p className="mt-2 text-sm text-muted">Single pack: <b className="tabular text-ink">{money(packCents)}</b> TCGplayer market · <Link className="link" href={`/card/${pack.slug}`}>compare single pack prices</Link></p>
            )}
            {/* One short row of actions (Fiverr usability review, 2026-11-25: "a lot of the buttons have a lot of text"). */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <VaultOwn id={p.id} name={`${name}${p.number ? ` ${p.number}` : ""}`} href={`/card/${p.slug}`} image={p.image ? imageAt(p.image, "200w") : null} prices={lowestByMarket(e.offers)} hint={false} />
              <DropShare path={`/card/${p.slug}`} name={`${name}${p.number ? ` ${p.number}` : ""}`} offers={e.offers} short />
              {/* The watch A/B's button (frozen until 2 Dec) sits in the same row; opened, its form takes the full width. */}
              {SITE.priceAlerts && (
                <div className="[&>button]:mt-0 has-[form]:basis-full">
                  <WatchPrice site={SITE.key} productId={p.id} prices={lowestByMarket(e.offers)} />
                </div>
              )}
            </div>
            {Object.keys(e.tcg).length > 1 && (
              <p className="mt-2 flex flex-wrap gap-2 text-xs">
                {Object.entries(e.tcg).map(([k, v]) => (
                  <span key={k} className="tag">{k}: {money(v.market ?? v.mid ?? v.low)}</span>
                ))}
              </p>
            )}
            {SITE.priceAlerts && <SeenPrice productId={p.id} prices={lowestByMarket(e.offers)} />}
          </header>
          <section id="prices" className="order-2 min-w-0 scroll-mt-28 md:order-none">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
              <h2 className="text-lg font-bold">Compare prices</h2>
              <CheckedAgo at={m?.updatedAt} />
            </div>
            <PriceTable ebayQuery={ebayQuery} tcgUrl={p.tcgUrl || undefined} offers={e.offers} fx={m?.fx ?? { USD: 1 }} productId={p.id} page="card" amazon={amazon} image={p.image ? imageAt(p.image, "200w") : null} product={`${name}${p.number ? ` ${p.number}` : ""}`} marketplacesBelow checked={checked} />
            {/* Fiverr usability review, 2026-11-25: "is this looking at all the pricing, or only the sites you get a commission from?" */}
            <p className="mt-2 text-xs text-muted">
              Every store we track is listed, whether it pays us or not, in price order. <Link className="link" href="/methodology">How we compare</Link>
            </p>
          </section>
          {/* The alert and the promos: after the price history on a phone, under the prices on a desktop. */}
          <div className="order-4 min-w-0 md:order-none">
            {SITE.priceAlerts && <PriceAlert site={SITE.key} productId={p.id} prices={lowestByMarket(e.offers)} />}
            {/* TCGplayer's Cyber Weekend banner (lib/tcgplayer-cyber.ts): under the price table, 22 Nov to 1 Dec, labelled Ad. */}
            <TcgplayerCyberBanner
              href={goHref(
                { url: `https://www.tcgplayer.com/search/${tcgplayerSlugOf(set)}/product?productLineName=${tcgplayerSlugOf(set)}&q=${encodeURIComponent(name)}&ProductTypeName=Sealed+Products`, source: "tcgplayer", market: "US" },
                p.id,
                "cyber_banner",
              )}
              at={Date.now()}
              className="mt-4"
            />
            <DiscordCta href={SITE.discordInvite} className="mt-4" />
            {/* Page budget rule 4 (one promo per page; Noor, 22 Nov): the extension card waits until the Cyber banner has gone. */}
            {cyberBannerState(Date.now()) === "off" && <ExtensionCta className="mt-4" from="card" />}
          </div>
          <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_CARD} className="order-6 md:order-none" />
          <section id="faq" className="prose-site order-6 max-w-none scroll-mt-28 text-sm md:order-none">
            <h2>Is {name} worth it?</h2>
            {/* Written from this product's own prices, stock and history (lib/buyer-read.ts, 2026-11-23 SEO quality pass). */}
            {read.map((t, k) => <p key={k}>{t}</p>)}
            <p className="text-muted">Prices from {SITE.stores.length} stores and TCGplayer are checked twice a day.</p>
          </section>
          {/* Which RiftCompare tool to build here next: a one-tap demand test, low on the page, never by a price (2026-11-18). */}
          <ToolInterest page="card" className="order-6 md:order-none" />
        </div>
      </div>
      {related.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">More from {set?.name}</h2>
          <TileGrid items={related} />
        </section>
      )}
      {/* The page's one ad block (owner, 2026-11-13): native and horizontal, below the price table and everything else; never beside a buy button. */}
      <InlineAds ads={cardAds({ setId: p.setId, kind: p.kind, exclude: p.id, fill: true, limit: 10 })} search={adSearch(set?.name, set)} page="card" />
    </article>
  );
}
