import type { Metadata } from "next";
import { SITE } from "@/site.config";
import { canon } from "@/lib/site";
import { StaticPage } from "@/components/StaticPage";

export const revalidate = 86400;
export const metadata: Metadata = { title: "How our prices work", description: `Where ${SITE.name}'s ${SITE.gameShort} prices come from and how often they update.`, ...canon("/methodology") };

export default function Methodology() {
  return (
    <StaticPage title="How our prices work">
      <ul>
        <li><b>TCGplayer market price</b>: the headline price on every product. It is TCGplayer&apos;s market price (what copies actually sold for), refreshed daily. A product nobody has sold yet has no headline price: one seller&apos;s asking price is not a value, so it never ranks in the most valuable lists, trending or set values. Price history and the 7- and 30-day changes are built from it.</li>
        <li><b>Store prices</b> — read once a day from each store&apos;s public catalogue, in the store&apos;s own currency, for a new, sealed copy. A listing is shown only when we can match it to the exact product (set, product type and edition); when in doubt we leave it out. We compare sealed product only, no single cards.</li>
        <li><b>eBay</b> — the cheapest matching Buy It Now listing (ungraded, no lots or proxies). eBay limits how often we can search, so every search goes to sealed product: every booster box, pack, tin and deck in the US, UK, Canada and Australia: every product daily in the US, and every two to three days elsewhere.</li>
        <li><b>Currencies</b> — store prices are shown as the store charges them. Converted figures (marked ≈) use the day&apos;s European Central Bank reference rate.</li>
      </ul>
      <p>The store&apos;s checkout price is always final. Shipping is shown where the listing publishes it.</p>
      <h2>What we track, and what we don&apos;t</h2>
      <p>We track sealed product only: booster boxes, cases, packs, tins, bundles, collections and decks, new and in the original language of each market. We do not track single cards, graded or opened product, resealed product, repacks, break spots, lots or second-hand listings, and we never convert one currency into another to rank stores. A price is shown only when we can tie the listing to one exact product; we would rather miss a price than show the wrong one.</p>
      <p>A product page is offered to search engines only when two or more stores have it in stock at a price we read recently (or one store plus a month of price history). Other products stay reachable here, but we do not ask search engines to list them. Every page says when prices were last checked.</p>
      <h2>Who is behind it</h2>
      <p>{SITE.name} is edited by Bill, who owns the site, chooses which stores are listed and reviews how matching and ranking rules change. Questions and corrections go to <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> or <a href="/contact">the contact page</a>. This page was last reviewed on 17 November 2026.</p>
      <h2>How we make money</h2>
      <p>Some buy links are affiliate links (eBay Partner Network, TCGplayer, Amazon). If you buy through one the retailer may pay us a commission at no cost to you. Most of the stores we list pay us nothing, and we list every store we track whether it pays us or not. Commission never decides the order of the stores: they are ranked by price alone, and an affiliate row is always labelled and never called the cheapest. {SITE.name} is not affiliated with, endorsed by or sponsored by any game publisher.</p>
      <p>Tell others how we did: <a href="https://www.trustpilot.com/review/tcgprices.app" rel="noopener">Review us on Trustpilot</a>.</p>
    </StaticPage>
  );
}
