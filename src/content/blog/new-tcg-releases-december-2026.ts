import type { Post } from "./types";

// The release calendar beyond the big four (2026-11-20): sets out this week or before Christmas in games no sister site covers
// (Star Wars Unlimited, Dragon Ball Super, Digimon, Fusion World, Union Arena, Weiss Schwarz, Final Fantasy, Grand Archive).
// Release dates are TCGplayer's listing dates from the catalogue; every price is a live {{sealed:SETID}} table
// (lib/post-render.ts). No contents, pack counts or MSRPs are claimed: we have no source for them here.
export const newTcgReleasesDecember2026: Post = {
  slug: "new-tcg-releases-december-2026",
  title: "New TCG releases, late November to December 2026: box prices",
  description: "New booster boxes out before Christmas in Star Wars Unlimited, Dragon Ball, Digimon, Union Arena, Weiss Schwarz and more, with today's cheapest prices.",
  date: "2026-11-20",
  keywords: ["new tcg releases december 2026", "upcoming tcg releases", "digimon ignition of x booster box", "dragon ball chromatic ascension booster box", "star wars unlimited icons 2027", "reach the god fusion world", "persona 30th anniversary weiss schwarz"],
  html: `
<p>Most release calendars stop at Pokémon, Magic, One Piece and Yu-Gi-Oh!. This one covers the other games: the sets landing between this week and Christmas in Star Wars Unlimited, Dragon Ball, Digimon, Union Arena, Weiss Schwarz, Final Fantasy and Grand Archive. Each set has a live table: TCGplayer's market price where one exists, and the cheapest in-stock or pre-order price at the stores we compare. The tables update with every day's prices, so they are current whenever you read this.</p>
<p>Dates are the release dates TCGplayer lists for each set. A pre-order price is a store's promise to ship on release, so check the store's own date before you count on a box for Christmas.</p>

<h2>Out now or this week</h2>
<h3>Star Wars Unlimited: Icons 2027 Edition (20 November)</h3>
{{sealed:24888}}
<p>More Star Wars Unlimited sealed is on the <a href="/games/star-wars-unlimited">Star Wars Unlimited page</a>, and our <a href="/blog/star-wars-unlimited-carbonite-edition-price">Carbonite Edition price study</a> compares standard and premium boxes set by set.</p>

<h3>Final Fantasy TCG: Memories of Life (13 November)</h3>
{{sealed:24788}}

<h2>Before the end of November</h2>
<h3>Dragon Ball Super Masters: Chromatic Ascension (27 November)</h3>
{{sealed:24807}}
<p>It lands on Black Friday. Our <a href="/black-friday">Black Friday deals</a> page lists everything stores sell under TCGplayer's market price that week.</p>

<h2>Early December</h2>
<h3>Digimon Card Game: Starter Decks 25 and 26 (4 December)</h3>
{{sealed:24932}}
{{sealed:24929}}

<h2>11 December: four sets in one day</h2>
<h3>Digimon Card Game: Ignition of X</h3>
{{sealed:24865}}
<h3>Dragon Ball Super Fusion World: Reach the God</h3>
{{sealed:24783}}
<h3>Union Arena: My Hero Academia Special Booster</h3>
{{sealed:24849}}
<h3>Grand Archive: .asphodel/cantabile</h3>
{{sealed:24904}}

<h2>18 December</h2>
<h3>Weiss Schwarz: Persona 30th Anniversary</h3>
{{sealed:24872}}

<h2>How to pre-order without overpaying</h2>
<ol>
<li><b>Compare more than one store.</b> Pre-order prices for the same box often differ by a lot between stores in one country. Each set's page lists every store we found, cheapest first, in your currency, and <a href="/tools/is-this-a-good-price">Is this a good price?</a> checks any store's link against them.</li>
<li><b>Count the shipping.</b> Our prices are item prices before shipping.</li>
<li><b>Mind the date.</b> A box released on 11 or 18 December may not reach you before Christmas, especially from a store in another country.</li>
<li><b>A price far under every other store is a warning,</b> not a bargain, for a set that is not out yet. Pre-order from a store you trust.</li>
<li><b>Market prices start thin.</b> A TCGplayer market price for a set that has just released rests on few sales and moves quickly in its first weeks.</li>
</ol>
<p>Every upcoming release, in every game we cover, is on the <a href="/preorders">pre-orders page</a>. For what a box usually costs in each game, see <a href="/blog/how-much-does-a-booster-box-cost">How much does a booster box cost?</a></p>
`,
  faq: [
    { q: "What TCG sets release in December 2026?", a: "Among others: Digimon's Starter Decks 25 and 26 on 4 December; Digimon's Ignition of X, Fusion World's Reach the God, Union Arena's My Hero Academia Special Booster and Grand Archive's .asphodel/cantabile on 11 December; and Weiss Schwarz's Persona 30th Anniversary on 18 December, by TCGplayer's listed dates." },
    { q: "When does Dragon Ball Super Chromatic Ascension release?", a: "27 November 2026, by TCGplayer's listed date." },
    { q: "When does Digimon Ignition of X release?", a: "11 December 2026, by TCGplayer's listed date." },
    { q: "Do the prices include shipping?", a: "No. Every price is the store's item price before shipping, in the store's own currency." },
  ],
};
