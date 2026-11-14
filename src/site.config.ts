// The ONE site-specific configuration file. This site compares SEALED product for every trading card game with a
// real market on one site (owner, 2026-11-14): each game is a TCGplayer category (SITE.lines), and the catalogue is
// cut to the products people are buying (catalogFocus, lib/import/focus.ts). Names, colours, data sources and copy
// live here or in src/content/. Keep engine code free of game names.
//
// The name is one decision in one place: `name`, `shortName`, `wordmark` and `domain` below. Nothing else in the
// code spells the brand.
import type { GameLine, SiteConfig } from "@/lib/site-types";
import { STORES } from "@/content/stores";

// Every game here is a TCGplayer product line (TCGCSV category id). The order is TCGplayer's own best-seller order
// for Q3 2026 (seller.tcgplayer.com/blog/best-selling-trading-card-games-q3-2026) for the first ten; the rest have
// no published rank and follow in no claimed order. A game stays on the site only while the focus keeps products
// for it (MIN_GAME_PRODUCTS in lib/game-hubs.ts): no sales, no page.
const g = (
  id: string,
  tcgcsvCategoryId: number,
  name: string,
  short: string,
  slug: string,
  tcgplayerSlug: string,
  ebayQuery: string,
  color: string,
  blurb: string,
): GameLine => ({ id, tcgcsvCategoryId, name, short, slug, tcgplayerSlug, ebayQuery, color, blurb });

const LINES: GameLine[] = [
  g("mtg", 1, "Magic: The Gathering", "Magic", "magic-the-gathering", "magic", "magic the gathering", "#b8742a", "Play Booster and Collector Booster boxes, bundles, Commander decks and Secret Lair-era sealed product."),
  g("pkm", 3, "Pokémon", "Pokémon", "pokemon", "pokemon", "pokemon", "#d9a514", "Booster boxes, Elite Trainer Boxes, booster bundles, tins and premium collections from every current set."),
  g("op", 68, "One Piece Card Game", "One Piece", "one-piece", "one-piece-card-game", "one piece card game", "#c2453c", "OP booster boxes, extra boosters, premium boosters and starter decks."),
  g("ygo", 2, "Yu-Gi-Oh!", "Yu-Gi-Oh!", "yugioh", "yugioh", "yugioh", "#7a5cc2", "Booster boxes, tins, structure decks and collector sets from the current Yu-Gi-Oh! TCG release schedule."),
  g("rb", 89, "Riftbound", "Riftbound", "riftbound", "all", "riftbound", "#2f8fb3", "The League of Legends trading card game: booster displays, champion decks and box sets."),
  g("lor", 71, "Disney Lorcana", "Lorcana", "disney-lorcana", "lorcana-tcg", "disney lorcana", "#6a57b8", "Booster boxes, Illumineer's Troves, starter decks and gift sets."),
  g("gun", 86, "Gundam Card Game", "Gundam", "gundam-card-game", "gundam-card-game", "gundam card game", "#3f6fb5", "Bandai's Gundam Card Game: booster boxes and starter decks."),
  g("pkj", 85, "Pokémon Japan", "Pokémon JP", "pokemon-japan", "pokemon-japan", "pokemon japanese", "#c9652b", "Japanese-language Pokémon booster boxes and special sets."),
  g("ua", 81, "Union Arena", "Union Arena", "union-arena", "union-arena", "union arena", "#c2557f", "Bandai's anime crossover card game: one booster box and starter deck per series."),
  g("fw", 80, "Dragon Ball Super Fusion World", "Fusion World", "dragon-ball-super-fusion-world", "dragon-ball-super-fusion-world", "dragon ball super fusion world", "#d07a2c", "FB booster boxes, FS starter decks and Manga Boosters."),
  g("dg", 63, "Digimon Card Game", "Digimon", "digimon-card-game", "digimon-card-game", "digimon card game", "#3d86c9", "BT and EX booster boxes, starter decks and premium sets."),
  g("swu", 79, "Star Wars: Unlimited", "Star Wars", "star-wars-unlimited", "star-wars-unlimited", "star wars unlimited", "#55606e", "Booster boxes, two-player starters and Spotlight decks."),
  g("fab", 62, "Flesh and Blood", "Flesh and Blood", "flesh-and-blood", "flesh-and-blood-tcg", "flesh and blood tcg", "#a8323a", "Booster boxes, Blitz decks and Armory decks."),
  g("ws", 20, "Weiß Schwarz", "Weiß Schwarz", "weiss-schwarz", "weiss-schwarz", "weiss schwarz", "#4a4f8f", "English booster boxes and trial decks, one anime series per set."),
  g("cfv", 16, "Cardfight!! Vanguard", "Vanguard", "cardfight-vanguard", "cardfight-vanguard", "cardfight vanguard", "#b33a5b", "Booster boxes, special series and start decks."),
  g("sor", 77, "Sorcery: Contested Realm", "Sorcery", "sorcery-contested-realm", "all", "sorcery contested realm", "#7d6a45", "Booster boxes and preconstructed decks."),
  g("ga", 74, "Grand Archive", "Grand Archive", "grand-archive", "grand-archive", "grand archive tcg", "#3e8f8a", "Booster boxes and starter decks."),
  g("holo", 87, "hololive OFFICIAL CARD GAME", "hololive", "hololive", "all", "hololive official card game", "#3ba3c9", "English booster boxes and start decks."),
  g("gz", 88, "Godzilla Card Game", "Godzilla", "godzilla-card-game", "all", "godzilla card game", "#4f7d55", "Booster boxes and starter decks."),
  g("cp", 92, "Cyberpunk TCG", "Cyberpunk", "cyberpunk-tcg", "cyberpunk-tcg", "cyberpunk tcg", "#c9b020", "Booster boxes and starter sets."),
  g("ff", 24, "Final Fantasy TCG", "Final Fantasy", "final-fantasy-tcg", "final-fantasy-tcg", "final fantasy tcg", "#5a78a8", "Opus booster boxes and starter sets."),
  g("dbs", 27, "Dragon Ball Super Masters", "DBS Masters", "dragon-ball-super-masters", "dragon-ball-super-ccg", "dragon ball super card game", "#c98a2c", "The original Dragon Ball Super Card Game: booster boxes and premium packs."),
  g("sve", 73, "Shadowverse: Evolve", "Shadowverse", "shadowverse-evolve", "all", "shadowverse evolve", "#5b6bb5", "Booster boxes and starter decks."),
  g("uvs", 25, "UniVersus", "UniVersus", "universus", "all", "universus ccg", "#8a5aa8", "Booster boxes and challenger decks."),
  g("nar", 93, "Naruto Card Game", "Naruto", "naruto-card-game", "all", "naruto card game", "#d1802a", "Booster boxes and starter decks."),
  g("ele", 83, "Elestrals", "Elestrals", "elestrals", "all", "elestrals", "#4f9a6b", "Booster boxes and starter decks."),
  g("cr", 90, "CookieRun: Braverse", "CookieRun", "cookierun-braverse", "all", "cookierun braverse", "#c9744a", "Booster boxes and starter decks."),
  g("pal", 91, "Palworld Card Game", "Palworld", "palworld", "all", "palworld card game", "#4a9fb0", "Booster boxes and starter decks."),
  g("wx", 67, "WIXOSS", "WIXOSS", "wixoss", "all", "wixoss", "#9a5a9a", "English booster boxes and starter decks."),
  g("bss", 72, "Battle Spirits Saga", "Battle Spirits", "battle-spirits-saga", "all", "battle spirits saga", "#b0553c", "Booster boxes and starter decks."),
  g("ac", 78, "Alpha Clash", "Alpha Clash", "alpha-clash", "all", "alpha clash tcg", "#5a8a4a", "Booster boxes and starter decks."),
];

export const SITE: SiteConfig = {
  // The affiliate sub-id prefix (eBay customid, Impact subId1): `tcgprices-us-card_pinned-1234`.
  key: "tcgprices",
  name: "TCG Prices",
  shortName: "TCG Prices",
  wordmark: ["TCG", "PRICES"],
  game: "trading card game",
  gameShort: "TCG",
  domain: "tcgprices.app",
  apexHost: true,
  tagline: "Compare booster box prices for every trading card game",
  description:
    "Free sealed price comparison for every trading card game people buy: Pokémon, Magic, One Piece, Yu-Gi-Oh!, Lorcana, Riftbound, Star Wars: Unlimited, Flesh and Blood and more. Booster boxes, trainer boxes, bundles and decks across TCGplayer, eBay, Amazon and card stores, updated daily.",
  keywords: [
    "booster box prices",
    "tcg price comparison",
    "sealed tcg prices",
    "pokemon booster box price",
    "magic booster box price",
    "one piece booster box price",
    "cheapest booster box",
    "trading card game sealed product",
  ],
  adminEmails: [],
  supportEmail: "compareempire@gmail.com",
  ownerEmail: "compareempire@gmail.com",

  // Not yet registered with RiftCompare's shared alert service: the form stays off until it is.
  priceAlerts: false,
  // Defaults only: every game has its own category, slug and eBay words (lines).
  tcgcsvCategoryId: 3,
  tcgplayerSlug: "all",
  lines: LINES,
  ebay: {
    query: "",
    singlesCategoryId: "183454",
    sealedCategoryId: "183456",
    minPriceUsd: 10,
    // No eBay API on this site (owner, 2026-11-14: the keysets are nearly used up). eBay is a tagged search link on
    // every product; the import's eBay pass is a no-op without EBAY_CLIENT_ID. Never give this site a keyset
    // without the owner.
    dailyBudget: 0,
    runHourUtc: 16,
  },

  numberStyle: "code",
  sealedOnly: true,
  // What keeps a page (lib/import/focus.ts): a TCGplayer market price of US$5 or more and a set released in the last
  // 36 months (boxes, cases, trainer boxes, bundles, tins, collections, decks) or 18 months (loose packs and the
  // rest); or two of our sister sites' stores in one market with it in stock today, whatever its age.
  catalogFocus: {
    headlineTypes: ["Booster Box", "Case", "Elite Trainer Box", "Bundle", "Tin", "Collection", "Commander Deck", "Structure Deck", "Starter Deck", "Deck Display", "Illumineer's Trove", "Special Edition"],
    headlineMaxAgeMonths: 36,
    otherMaxAgeMonths: 18,
    minCents: 500,
    minStores: 2,
    groupMaxAgeMonths: 60,
  },
  rarityOrder: [],
  chaseRarities: [],
  featureMinCents: 4000,

  theme: {
    brand: "#4f46e5",
    brandLight: "#818cf8",
    brandDark: "#3730a3",
    accent: "#4f46e5",
    pageDark: "#0b0c10",
    inkDark: ["#08090c", "#0f1116", "#151820", "#1d212b", "#2c3240", "#434a5c"],
    wordmarkGradient: "linear-gradient(90deg, #818cf8 0%, #4f46e5 100%)",
    displayFont: "Plus Jakarta Sans",
    defaultMode: "light",
    pageLight: "#fbfbfd",
  },
  halloween: { headline: "Spooky season pulls", blurb: "Find the cheapest booster boxes before the next drop." },
  christmas: { headline: "Gift a box", blurb: "booster boxes, trainer boxes and decks to gift, cheapest store first" },

  stores: STORES,
  // The dedicated sites go deeper on one game each (single cards, alerts, history); this one is every game's sealed.
  sisterSites: [
    { name: "DexCompare", url: "https://dexcompare.app", game: "Pokémon", anchor: "Pokémon sealed prices", search: "https://dexcompare.app/us/sealed?q={q}" },
    { name: "MTG Compare", url: "https://mtgcompare.app", game: "Magic", anchor: "Magic: The Gathering sealed prices", search: "https://mtgcompare.app/us/sealed?q={q}" },
    { name: "OP Compare", url: "https://opcompare.app", game: "One Piece", anchor: "One Piece card prices", search: "https://opcompare.app/browse?q={q}" },
    { name: "YGO Compare", url: "https://ygocompare.com", game: "Yu-Gi-Oh!", anchor: "Yu-Gi-Oh! sealed prices", search: "https://ygocompare.com/sealed?q={q}" },
    { name: "Rift Compare", url: "https://riftcompare.com", game: "Riftbound", anchor: "Riftbound card prices", search: "https://riftcompare.com/browse?q={q}" },
    { name: "Lorcana Compare", url: "https://lorcanacompare.com", game: "Disney Lorcana", anchor: "Disney Lorcana card prices", search: "https://lorcanacompare.com/cards?q={q}" },
    { name: "Gundam Compare", url: "https://gundamcompare.com", game: "Gundam", anchor: "Gundam Card Game prices", search: "https://gundamcompare.com/cards?q={q}" },
    { name: "BandaiCompare", url: "https://bandaicompare.com", game: "Union Arena, Fusion World & Digimon", anchor: "Union Arena, Fusion World and Digimon prices" },
    { name: "Cyberpunk Compare", url: "https://cyberpunkcompare.com", game: "Cyberpunk TCG", anchor: "Cyberpunk TCG prices", search: "https://cyberpunkcompare.com/cards?q={q}" },
    { name: "WargameCompare", url: "https://wargamecompare.com", game: "Wargames", anchor: "Miniature wargame prices" },
    { name: "FigureCompare", url: "https://figurecompare.com", game: "Anime figures", anchor: "Anime figure prices" },
    { name: "SportsCardCompare", url: "https://sportscardcompare.com", game: "Sports cards", anchor: "Sealed sports card box prices" },
  ],
  family: { id: "sealed" },
  social: {},
};
