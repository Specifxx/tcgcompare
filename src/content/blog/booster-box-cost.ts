import type { Post } from "./types";

// One question the day's prices answer: what a booster box costs in each game. The table and the figures are tokens
// (lib/game-study.ts), so every number is today's TCGplayer US market price and the page stays true without an edit.
export const boosterBoxCost: Post = {
  slug: "how-much-does-a-booster-box-cost",
  title: "How Much Does a Booster Box Cost? Every Game Compared",
  description: "The median price of a booster box in every trading card game we track, from the cheapest to the dearest, using TCGplayer's market price on released sets.",
  date: "2026-11-15",
  keywords: ["how much does a booster box cost", "booster box price", "booster box prices", "how much is a booster box", "cheapest trading card game booster box", "most expensive booster box"],
  html: `
<p>A booster box is the cheapest sealed way to open a lot of packs at once, but the price you pay depends far more on the game than on the box. Across the {{fact:boxCount}} released booster boxes we price in {{fact:boxGames}} trading card games, the typical box runs from about {{fact:cheapestMedian}} in {{fact:cheapestGame}} to about {{fact:dearestMedian}} in {{fact:dearestGame}}. This guide shows every game side by side and explains what the gap means before you spend.</p>

<h2>The median booster box price by game</h2>
<p>The table uses TCGplayer's <em>market price</em>, the average of recent completed sales, for every booster box in a set that is already out. A pre-order is left out because its price is a guess until stock lands. We show the median rather than the average because a few collector-grade boxes would drag an average well above what most people actually pay. Games with fewer than five priced boxes are left off rather than judged from a handful. Prices are US dollars and are never converted.</p>
{{study:boxes}}
<p>Click a game to see its boxes, or open any product for the stores selling it today. The table refreshes with the daily price import, so it will not say the same thing next month.</p>

<h2>Why the median hides a wide spread</h2>
<p>Read the cheapest and dearest columns before you trust any single figure. In the biggest games a "booster box" is not one product: Magic sells play, set and collector boxes at very different prices, and a game's older sets can be worth many times their original cost once they go out of print. A game's median tells you where a typical box sits, not what the box you are looking at should cost. For that, compare the one you want against its own TCGplayer market price, which every product page shows beside the stores.</p>

<h2>A box is not a price per pack</h2>
<p>Packs per box differ between games, and sometimes between products in the same game, so a cheap box is not automatically cheap per pack. If you are comparing games on value, check the pack count on the product before comparing totals. We do not publish a per-pack figure on this page because we would only be guessing at counts we have not verified for every box.</p>

<h2>How to pay less for the same box</h2>
<ul>
<li><strong>Check TCGplayer's market price first.</strong> It is the benchmark most sellers price against. A store above it needs a reason such as local stock, free delivery or a rare reprint.</li>
<li><strong>Compare stores in your own region.</strong> Delivery and import fees can erase a lower sticker price, so the cheapest row for a buyer in Sydney is not the cheapest for one in Chicago. Each product page shows stores for your market.</li>
<li><strong>Look at cases for a game you buy often.</strong> Cases usually cost more in total but can lower the price per box. The <a href="/games">game hubs</a> list a game's cases beside its boxes.</li>
<li><strong>Time your purchase.</strong> Sealed prices tend to be firmest just before a set rotates out of print and softest right after a big print run lands. Our <a href="/black-friday">Black Friday</a> page tracks the sale weeks.</li>
</ul>

<h2>Where to go next</h2>
<p>Browse every <a href="/sealed/booster-box">booster box we track</a>, search a specific set in <a href="/sets">sets</a>, or paste a store's link into <a href="/tools/is-this-a-good-price">Is this a good price?</a> to see how it compares with every store we read. To see how often stores beat TCGplayer in each game, read <a href="/blog/is-tcgplayer-cheapest-for-sealed-product">Is TCGplayer the cheapest place to buy sealed product?</a></p>
`,
  faq: [
    { q: "How much does a booster box cost?", a: "It depends on the game. On today's TCGplayer market prices the median booster box is about {{fact:cheapestMedian}} in the cheapest game we track and about {{fact:dearestMedian}} in the dearest. See the table above for every game." },
    { q: "Which trading card game has the cheapest booster boxes?", a: "{{fact:cheapestGame}} has the lowest median booster box price of the games we track ({{fact:cheapestMedian}}), and {{fact:dearestGame}} has the highest ({{fact:dearestMedian}})." },
    { q: "Is TCGplayer's market price the real price?", a: "It is the average of recent completed sales, so it tracks what boxes have actually sold for. It is a benchmark, not a guarantee: a store can sell the same box above or below it." },
  ],
};
