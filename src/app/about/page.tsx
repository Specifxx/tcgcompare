import type { Metadata } from "next";
import { SITE } from "@/site.config";
import { canon } from "@/lib/site";
import { StaticPage } from "@/components/StaticPage";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: `About ${SITE.name}: who runs it and how`,
  description: `${SITE.name} is run by Bill and George. How we compare sealed trading card game prices across stores, how the site earns and what it costs to run each month.`,
  ...canon("/about"),
};

export default function About() {
  return (
    <StaticPage title={`About ${SITE.name}: who runs it and how`}>
      <p>{SITE.name} is a free price comparison site for {SITE.game}. Every day it collects the price of sealed booster boxes, packs, decks and collections for every trading card game with a real market from TCGplayer, eBay, Amazon and {SITE.stores.length} online game stores in the US, UK, Canada and Australia, and puts them side by side, cheapest first.</p>
      <h2>The people</h2>
      <p>{SITE.name} is the work of Bill and George, the two co-founders, and nobody else owns a part of it. We also run a handful of single-game price sites, and {SITE.name} is where all of those games, and the ones no other site of ours covers, meet on one page.</p>
      <p>A program reads every price, from each store&rsquo;s own catalogue and TCGplayer, and a listing is only taken when it can be tied to one exact product; stores that look too cheap to be real are left out. AI tools help us build the site and draft guides, and a person reads every guide before it goes live.</p>
      {SITE.disclaimer && <p>{SITE.disclaimer}</p>}
      <h2>How we make money</h2>
      <p>Some buy links are affiliate links (eBay Partner Network, TCGplayer, Amazon): if you buy, the store may pay us a small commission at no cost to you. Every store we track is listed, whether it pays us or not, and the stores come first, ranked by price only: a store that pays us nothing ranks exactly where its price puts it. Amazon, eBay and TCGplayer, our affiliate partners, sit in their own labelled block below the stores. No row is marked as the cheapest.</p>
      <h2>What it costs</h2>
      <p>Hosting, the twice-daily price runs, domains and tools are shared across our sites and cost about A$790 a month in all (our own books, 30 days to 15 November 2026). The affiliate commission above pays that bill. No store pays to be listed or to rank.</p>
      <h2>Contact</h2>
      <p>Spotted a wrong price, or run a store that sells {SITE.gameShort}? <a href="/contact">Get in touch</a> or email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.</p>
      <p>Used {SITE.name}? <a href="https://www.trustpilot.com/review/tcgprices.app" rel="noopener">Review us on Trustpilot</a>. Every review, good or bad, stays up.</p>
    </StaticPage>
  );
}
