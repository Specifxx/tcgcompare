import type { Post } from "./types";

// New-release price guide from the day's data: Star Trek (Magic: The Gathering, released 13 Nov 2026). Numbers are tokens.
export const magicStarTrekPrices: Post = {
  slug: "magic-star-trek-sealed-prices",
  title: "Star Trek Magic Sealed Prices: Collector vs Play Boosters",
  description: "What every Magic Star Trek sealed product costs today: Play and Collector displays and boosters, Beam Me Up bundle, Draft Night, scene boxes and cases.",
  date: "2026-11-17",
  keywords: ["star trek magic the gathering booster box price", "star trek collector booster display price", "mtg star trek play booster box", "star trek mtg beam me up bundle", "is star trek mtg worth buying", "star trek mtg sealed"],
  image: { src: "/blog/magic-star-trek-sealed-prices.jpg", alt: "Bar chart of Magic Star Trek sealed prices: Play pack, Collector pack, Play display, Beam Me Up bundle and Collector display" },
  html: `
<p>Star Trek came out on 13 November 2026 and its sealed prices split into two very different markets. A Play Booster display is {{price:706138}} on TCGplayer's market price; a Collector Booster display is {{price:706142}}, {{ratio:706142:706138}} as much. At pack level the gap is wider still: a Play Booster is {{price:706136}} and a Collector Booster is {{price:706141}}, {{ratio:706141:706136}}. This guide lists every Star Trek sealed product with today's price and the cheapest store we read, and what the gap means for how you should buy.</p>

{{figure:706142}}

<h2>Every Star Trek sealed product</h2>
<p>Prices come from the same daily import as every product page: TCGplayer's market price (recent completed sales, US dollars) and the cheapest in-stock US store price we can match to that exact product. We do not show eBay or Amazon prices on this table.</p>
{{sealed:24766}}

<h2>Play or Collector: where the price comes from</h2>
<p>Collector Boosters are a premium product with a premium price, and the data shows how much of the cost is the product type rather than the set. The Play Booster display is the one most players buy to open and play, and it is stocked widely; the Collector display is the one chasing the rarest versions of cards, and it costs several times more per pack. We cannot tell from prices alone what the extra money returns in cards, and we do not claim a figure: whether a Collector Booster is worth it depends on what you pull and what you value, not on a number we can verify. What we can say is that if you want to play the set, the Play display is the product priced for it, and if you want the premium printings, the Collector product is where they come from.</p>

<h2>Bundles, Draft Night and scene boxes</h2>
<ul>
<li><strong>Bundle ({{price:706150}}).</strong> The entry product for a pack-and-extras purchase, and one of the most widely stocked Star Trek products.</li>
<li><strong>Beam Me Up Bundle ({{price:706154}}).</strong> A premium bundle at {{ratio:706154:706150}} the price of the standard one.</li>
<li><strong>Draft Night ({{price:706162}}).</strong> A draft-ready product aimed at playing the set with friends.</li>
<li><strong>Scene Boxes ({{price:706157}} and {{price:706158}}).</strong> The two Scene Boxes, Enterprise-Q and Divergent Timelines, sit at the low end of the price range and are the cheapest way into the set's collection products.</li>
<li><strong>Prerelease Pack ({{price:706227}}).</strong> Built for the prerelease event; it is a pack-opening product rather than a long-term hold.</li>
</ul>

{{figure:706138}}

<h2>Cases</h2>
<p>A Play Booster Display Case is {{price:706140}} and a Collector Booster Display Case is {{price:706144}}. Cases are the volume and resale route; very few stores stock the Collector case, and prices at that level move on individual sales more than on a stable market, so compare the store rows before you buy.</p>

<h2>How to buy Star Trek well</h2>
<ul>
<li>Decide Play or Collector first; the price gap is bigger than any store-to-store gap.</li>
<li>On a new set, wait for prices to settle if you can: set a check with <a href="/tools/deal-finder">Deal Finder</a> instead of paying release-week prices.</li>
<li>For how a Magic display compares with other games, see <a href="/blog/how-much-does-a-booster-box-cost">How much does a booster box cost?</a>; for how often stores undercut TCGplayer, <a href="/blog/is-tcgplayer-cheapest-for-sealed-product">Is TCGplayer the cheapest place for sealed product?</a></li>
</ul>
<p>Every <a href="/games/magic-the-gathering">Magic sealed product</a> is on its game hub, and the <a href="/sets/star-trek">Star Trek set page</a> lists the whole set.</p>
`,
  faq: [
    { q: "How much is a Star Trek Magic booster box?", a: "A Play Booster display is {{price:706138}} and a Collector Booster display is {{price:706142}} on TCGplayer's market price today." },
    { q: "Is a Star Trek Collector Booster worth it?", a: "A Collector Booster is {{price:706141}} against {{price:706136}} for a Play Booster. Whether that is worth it depends on what you pull and value, which prices cannot tell us." },
    { q: "When was Star Trek released?", a: "The Magic: The Gathering Star Trek set was released on 13 November 2026." },
  ],
};
