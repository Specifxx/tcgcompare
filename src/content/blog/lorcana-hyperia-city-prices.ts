import type { Post } from "./types";

// New-release price guide from the day's data: Disney Lorcana, Hyperia City (released 16 Oct 2026). Numbers are tokens.
export const lorcanaHyperiaCityPrices: Post = {
  slug: "lorcana-hyperia-city-sealed-prices",
  title: "Lorcana Hyperia City Sealed Prices: Box, Trove, Starter Set",
  description: "What every Disney Lorcana Hyperia City sealed product costs today: booster box, Illumineer's Trove, 2-Player Starter Set, prerelease box, gift box and cases.",
  date: "2026-11-17",
  keywords: ["lorcana hyperia city booster box price", "hyperia city illumineer's trove price", "lorcana hyperia city starter set", "is hyperia city worth buying", "disney lorcana hyperia city sealed", "lorcana hyperia city gift box"],
  image: { src: "/blog/lorcana-hyperia-city-sealed-prices.jpg", alt: "Bar chart of Lorcana Hyperia City sealed prices: booster pack, starter set, Illumineer's Trove and booster box" },
  html: `
<p>Hyperia City was released on 16 October 2026. The booster box is {{price:706239}} on TCGplayer's market price, the Illumineer's Trove is {{price:706243}}, the 2-Player Starter Set is {{price:717854}} and a booster pack is {{price:706241}}. This guide lists every Hyperia City sealed product with today's price and the cheapest store we read, and how to choose between the box, the Trove and the starter set.</p>

{{figure:706239}}

<h2>Every Hyperia City sealed product</h2>
<p>Prices come from the same daily import as every product page: TCGplayer's market price (recent completed sales, US dollars) and the cheapest in-stock US store price we can match to that exact product. We do not show eBay or Amazon prices on this table.</p>
{{sealed:24740}}

<h2>Box, Trove or Starter Set?</h2>
<ul>
<li><strong>Booster Box ({{price:706239}}).</strong> The route for opening many packs, and the product with the most stores competing on it, so it is the one to compare store by store.</li>
<li><strong>Illumineer's Trove ({{price:706243}}).</strong> The collector-friendly product, priced at about {{ratio:706243:706239}} the box. Look at what is in the Trove on the product page before comparing it with the box: it is a different product, not a smaller box.</li>
<li><strong>2-Player Starter Set ({{price:717854}}).</strong> The cheapest way to start playing with a friend, and widely stocked. If you are new to Lorcana, this is the entry price.</li>
</ul>
<p>We do not state pack counts here; they differ by product and we only print what we can verify from the listings.</p>

<h2>The Beast Gift Box and the Prerelease Box</h2>
<p>The Hyperia City Gift Box - Beast is {{price:719729}} and the Prerelease Box is {{price:706245}}. The gift box is a collection product with far fewer stores carrying it than the booster box; the prerelease box was made for the launch events, so its price reflects a one-off product rather than a repeatable one.</p>

{{figure:706243}}

<h2>Cases</h2>
<p>A Booster Box Case is {{price:706240}}, an Illumineer's Trove Case is {{price:706244}} and a Prerelease Box Case is {{price:706246}}. Cases are bought at volume or to resell; few stores stock them, so compare the store rows before paying a premium.</p>

<h2>How to buy Hyperia City well</h2>
<ul>
<li>Compare store prices on the box: with many stores in stock, the gap between the cheapest and TCGplayer's market price is where the saving is.</li>
<li>Buying the Trove and the box together? Check each product's store list separately, since stores price them independently.</li>
<li>For how a Lorcana box compares with other games, see <a href="/blog/how-much-does-a-booster-box-cost">How much does a booster box cost?</a>; for how often stores undercut TCGplayer, <a href="/blog/is-tcgplayer-cheapest-for-sealed-product">Is TCGplayer the cheapest place for sealed product?</a> A <a href="/tools/deal-finder">Deal Finder</a> check flags a box selling below market.</li>
</ul>
<p>Every <a href="/games/disney-lorcana">Lorcana sealed product</a> is on its game hub, and the <a href="/sets/hyperia-city">Hyperia City set page</a> lists the whole set.</p>
`,
  faq: [
    { q: "How much is a Hyperia City booster box?", a: "TCGplayer's market price today is {{price:706239}}. The table above shows the cheapest store in stock." },
    { q: "How much is the Hyperia City Illumineer's Trove?", a: "{{price:706243}} on TCGplayer's market price today." },
    { q: "When was Hyperia City released?", a: "Disney Lorcana: Hyperia City was released on 16 October 2026." },
  ],
};
