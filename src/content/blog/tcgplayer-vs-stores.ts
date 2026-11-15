import type { Post } from "./types";

// A per-game version of the question /price-report answers in total. The table is a token (lib/game-study.ts), computed
// from the same files as every page: US stores in dollars against TCGplayer's US market price, never converted.
export const tcgplayerVsStores: Post = {
  slug: "is-tcgplayer-cheapest-for-sealed-product",
  title: "Is TCGplayer the Cheapest Place to Buy Sealed Product?",
  description: "How often an independent US store sells a sealed product below TCGplayer's market price, game by game, from today's prices across every store we read.",
  date: "2026-11-15",
  keywords: ["is tcgplayer cheaper than local game store", "tcgplayer vs local game store", "cheapest place to buy sealed pokemon", "cheapest place to buy booster boxes", "tcgplayer market price", "where to buy sealed trading cards"],
  html: `
<p>TCGplayer is where most people look first, and its market price is the price sellers measure themselves against. That does not make it the cheapest place to buy. We compared TCGplayer's market price with the cheapest in-stock US store for every released sealed product of $5 or more. In {{fact:beatBestGame}}, a store beat TCGplayer on {{fact:beatBestPct}} of products. In {{fact:beatWorstGame}} it was only {{fact:beatWorstPct}}. Which game you collect changes the answer.</p>

<h2>How often a US store beats TCGplayer, by game</h2>
<p>For each game the table counts released sealed products worth $5 or more that have both a TCGplayer market price and an in-stock US store listing priced in dollars. It then shows how many a store sells for less, and the typical saving when it does. Pre-orders are left out. Games with fewer than 30 comparable products are left out rather than judged from a handful.</p>
{{study:beat}}
<p>The comparison is item price against item price. It does not include delivery, tax or marketplace fees, which differ by seller, so a lower sticker price is not always a lower total. Every product page shows each store's price so you can work out your own total.</p>

<h2>What the table says</h2>
<p>Three things stand out. First, no game is always cheaper at stores, and none is always cheaper on TCGplayer: even where stores win most often, a large share of products are still cheapest at TCGplayer's own price. Second, when a store does win, the saving is usually a few dollars in percentage terms rather than a bargain, which is why a quick check matters more than a long hunt. Third, the games with the most stores selling them are not automatically the games where stores win most often, because a crowded market keeps every price close together.</p>

<h2>Why a store beats the market price</h2>
<p>TCGplayer's market price follows what boxes have recently sold for across its marketplace. A store prices on its own cost and stock, so a shop that bought a case at the release price may sell for less than today's market, while a shop that restocked late may sell for more. Stores also run sales. That is why the same product can sit above the market price at one store and below it at another on the same day.</p>

<h2>How to use this</h2>
<ul>
<li><strong>Look at the store row before you check out.</strong> On a product page the TCGplayer row is just another row; a store above or below it is information, not a verdict.</li>
<li><strong>Add delivery before you decide.</strong> A cheaper store that charges delivery can cost more than a TCGplayer seller with free delivery.</li>
<li><strong>Set a price alert.</strong> If no store is below market today, an alert tells you when one drops.</li>
</ul>
<p>The all-games figure is on our <a href="/price-report">monthly price report</a>. To compare any single product, paste a store's link into <a href="/tools/is-this-a-good-price">Is this a good price?</a> or browse <a href="/tools/deal-finder">every in-stock product selling below market</a>. For what a typical box costs in each game, see <a href="/blog/how-much-does-a-booster-box-cost">How much does a booster box cost?</a></p>
`,
  faq: [
    { q: "Is TCGplayer cheaper than a local game store?", a: "Sometimes. Across the games we compare, a US store sells below TCGplayer's market price on roughly a third to three quarters of released sealed products depending on the game. Compare the stores on a product page before you buy." },
    { q: "What is TCGplayer's market price?", a: "It is TCGplayer's measure of what a product has recently sold for. It is a benchmark rather than a price anyone must charge, so stores can sell above or below it." },
    { q: "Do these comparisons include shipping?", a: "No. They compare item prices only, so add delivery and tax for your own location before deciding which seller is cheapest in total." },
  ],
};
