# Decisions

The engine's earlier history is YGO Compare's (`Specifxx/ygocompare`, DECISIONS.md) and BandaiCompare's.

## 2026-11-14: One sealed site for every card game

Owner: a consolidated sealed price site for every TCG with a real market ("any TCG with a market size of over $1M
USD"), like tcgcompare.com but more usable; TCGplayer commission is the main earner. Built on YGO Compare's sealed
engine with BandaiCompare's `SITE.lines`.

- **Name.** The owner first said tcgcompare.app. TCGCompare Ltd (UK) filed the trade mark "TCGCompare"
  (UK00004402394, 15 June 2026) and runs tcgcompare.com, so that name was dropped. The owner then proposed
  tcgprices.app: descriptive, no mark found (web search only, not a register search). The domain is NOT bought and its
  availability is unconfirmed; `SITE.domain` is one value to change.
- **Catalogue.** 31 TCGplayer categories through TCGCSV; sealed only; the focus rule in `lib/import/focus.ts`. First
  import: 3,691 products across 30 games.
- **Store rows without a second crawl.** The sister sites already publish their store offers; this site reads them
  by TCGplayer product id (`lib/import/sisters.ts`). Engine sisters key prices by that id; DexCompare and MTG Compare
  products map through TCGplayer's own photo URL (76,306 of 85,955 and 51,897 of 55,437 offers). First import: 1,167
  stores, store rows on 2,174 products. OP Compare and RiftCompare are not read yet (no TCGplayer id in their public
  data).
- **No eBay API.** The keysets are nearly spent (owner). eBay is a tagged search row, first on every product; "we
  obviously want to make eBay money" (owner).
- **Store vetting.** Owner: with more stores there must be "a system in place to remove scam sites or sites that seem
  suspicious", naming a myshopify.com shop. `lib/import/vet.ts`: blocklist, no own domain, shelf priced under 70% of
  market; one price under half of market is dropped (was a quarter). On the first data the median real store sits at
  1.13 to 1.42 times market in every region, so 0.7 refuses nobody honest: 2 of 1,063 priced stores fail it, and 11
  trade from a free platform address.
- **Twice a day.** Owner: no eBay quota to wait for, so update more often. The build cap is one per 12 hours, so the
  import runs at 21:37 and 09:47 UTC.
- **Removed from the copy.** The forum, creators, Gunpla kits, the Yu-Gi-Oh! guides and the retired-card redirects:
  none belongs to a new all-games site, and an empty forum is a thin page.
- **Ops monitor schedule off** until the domain serves the site.
- **Review gate.** 31 January 2027: under 50 visitors a day or nothing earned, freeze it.

## 2026-11-14: The 2050 layer, dark by default, and the site's own mark

Owner: "make the site as aesthetic as possible, with scrolling animations and everything super duper cool - like what
you'd expect of a year 2050 website". The minimal layout stays exactly as it was (same blocks, same order, no product in
the hero); the look on top of it changes (`globals.css`, "The 2050 layer"):

- Dark is the default (`SITE.theme.defaultMode`), a deeper ground, three lights (cyan, electric blue, violet) as a fixed
  sky, and a floor of lines running to the horizon under the hero.
- Motion: the headline's sheen, a ring of light around the search, every game drifting past in one line
  (`GameMarquee.tsx`), cards that arrive as they scroll in, the hero sinking back as the page moves on, a progress
  line along the top, price rows arriving one after another, and cross-fades between pages (`@view-transition`).
- One script, `components/Neo.tsx` (20 lines): it tells a tile where the pointer is so its spotlight can follow.
- Rules kept: CSS only otherwise; nothing shifts layout; anything hidden until scrolled sits inside
  `@supports (animation-timeline: view())`, so a crawler or an older browser gets the finished page; all of it is off
  under `prefers-reduced-motion`; the loud button stays at 5.3:1 or better.
- The icon, favicon and share image are this site's own (a box drawn in the three lights); they were YGO Compare's.
- Tested against a production build: 342 page loads across every page type on desktop and phone, all 200, one h1 each,
  no script error, no sideways scroll.

## 2026-11-14: OP Compare's stores join, from its snapshot branch

OP Compare keeps no public data on `main`: its `snapshot` branch is the only copy, and its sealed product id is
TCGplayer's product id. `sisters.ts` gained a third kind, "snapshot": `sealed.json.gz` names the sealed ids, each id's
offers are read from `o/<id / 1024>.json.gz`, and only `store:` rows with no condition, a price, the market's own
currency and an `updatedAt` inside 72 hours are taken (a card of the same range is never read). The store list is
`src/lib/stores.ts` on OP Compare's `main`, checked out beside it. On the 14 November snapshot: 5,258 store rows on
187 One Piece products from 291 stores. Riftbound still waits: Rift Compare's public data carries no TCGplayer id.

## 2026-11-14: The product page's prices in markup and prose are one market's, never eBay

The Product JSON-LD counted every in-stock US-dollar offer, eBay's reused listings included (69 products had an eBay
`lowPrice`), and the "Is it worth it?" sentence named the first in-stock offer, which is ordered by raw cents across
currencies (a pound price called the cheapest on 626 products, eBay on 104). Both now go through
`src/lib/product-page.ts`: the AggregateOffer leaves out eBay and Amazon (`jsonLdOffers`), and the sentence names the
US market's cheapest in-stock store or TCGplayer price in dollars (`usCheapestQuoted`), said as "US price", and is left
out when there is none. The eBay search now adds the game's words unless the name holds the whole phrase as words
(`ebayQueryFor`): "Starter" no longer stands for "Star Wars Unlimited", and the Japanese Pokemon line keeps "japanese".
`tests/product-page.test.ts`.

## 2026-11-14: A search page, and the pages the YGO / Bandai copy left behind

- **`/search?q=`** is where Enter goes when no suggestion is picked; it went to `/cards?q=`, a 404 here (YGO Compare
  301'd `/cards` to `/sealed`, which ignores the words). The page is one static, noindex shell like `/cart`: the browser
  reads `q` (`SearchResults.tsx`, `useSearchParams` under Suspense) and asks `/api/search` for 60 hits, already
  CDN-cached per lower-cased query, so a search costs no page render and no new function. Never in the sitemap.
- **`/games/:slug/:type`** has its own CDN rule: `/games/:slug` matches one segment only, so the type hubs were
  rendered fresh on every visit. `tests/vercel-cost.test.ts` lists it.
- **`/sets`** leaves out a game with no sets (Naruto today), whose heading linked a 404 game hub.
- **The cart's `utm_source`** is `SITE.domain`; it said `ygocompare.com`.
- **`/games` and home descriptions** name the games with product today, biggest first, and stay generic about product
  types (`lib/site-copy.ts`): `SITE.game` is one phrase here, so "compares: trading card game." read wrongly.

## 2026-11-14: A page that existed never 404s, and a sister that is down does not empty its stores

`lib/import/continuity.ts`, called by `scripts/import-all.ts`; pinned by `tests/continuity.test.ts`.

- **Culled for any reason.** culled.json used to be built only from the products TCGCSV returned today, so a product
  whose group was no longer read (the 60-month `groupMaxAgeMonths` window) simply vanished and its page 404'd. It is
  now built from the previous catalogue: every product that had a page and has none today, whatever the reason (the
  focus, the group's age, TCGCSV no longer listing it), with its set found in today's sets or the previous catalogue's.
  On 14 November's data, 609 live products (Secret Lair Drop Series, Pokemon Miscellaneous, Challenger Decks…) sat in
  groups TCGCSV dates 2021-11-19, which would have fallen out of the window on 19 November.
- **Groups that still hold pages are read whatever their age.** The safest rule is data-driven: any group the previous
  catalogue still has a product in is read, so a page is only ever lost through the focus, never through a date. The
  catch-all groups (`SITE.catalogFocus.evergreenGroups`: 2576, 2632, 2203, 2374) are read always, even while empty,
  because their publishedOn is the group's, not their products'. A group with no page left and no catch-all status
  still ages out, which keeps the daily request count bounded.
- **culled.json entries carry the game.** An entry is now `{ set, line }`; the old string form (set slug only) is still
  read, and gains its line when the import knows the set. A culled product whose set has no page goes to its game's hub
  (`/games/<slug>`), then to the set's hub as before. Battle Academy 2024 went to /sealed; it now goes to Pokemon.
- **A sister that is down** (missing checkout, unreadable, stale): the previous import's rows of its stores are carried
  for at most 72 hours after its data was last fresh (the same 72 hours a live sister row is held to), only where no
  live sister has that store on that product, and only under a key the previous store directory gave the same shop.
  They pass the same vetting and price band as live rows. Past 72 hours nothing is carried, but a product the last
  import kept is never culled only because a store it had rows from is down with its sister: it is held. Each sister's
  meta.json entry now lists its store keys (`stores`); a down one keeps `at` (its last fresh data) and says how many rows
  were `carried` and products `held`. The hold has no end date on purpose: a sister down for days is an ops problem,
  not a reason to 301 hundreds of pages and bring them back the day it returns.

## 2026-11-14: Rift Compare's stores join, and every sealed sister's stores are judged one by one

- **Per-store freshness.** The 72-hour rule was checked only on a sealed sister's (DexCompare, MTG Compare) export
  time, so a shop the sister had not managed to read for days still came through as in stock and counted toward the
  focus rule and the vetting medians. Their own sites show such a row as "unknown"; now `readSealed` skips any offer
  whose store's `meta.json` `seen` time (the export time when a store has none) is over 72 hours old, as the snapshot
  reader already did per row. On the 14 November data: MTG Compare loses 194 rows (124 in stock) from 6 stores,
  DexCompare 103 (32 in stock) from 7.
- **Rift Compare (Riftbound), a fourth kind "rift".** Its public data is on `main`: `data/public/sealed-listings.json`
  groups every store row under its own sealed classifier's `groupKey` (set|type), and each group's `retailer:
  "tcgplayer"` row links `tcgplayer.com/product/<id>`. That id prices the group's store rows only when the group names
  one id and no other group names it; the join is Rift Compare's own matching, never a title of ours. eBay (`ebay`,
  `ebay_<market>`), TCGplayer, Amazon and Cardmarket rows are left behind. Freshness is per store and market, from
  `meta.seen.SealedListing["<retailer>|<country>"]`: a pair with no stamp or one over 72 hours old is skipped (one AU
  shop, last read 27 October, was still published as in stock). The row carries its store (key, name, url host,
  country), so no store list is read. The workflows check out only those two files (never `data/public/listings/`,
  about 84 MB). On the 13 November export: 2,677 store rows (1,093 in stock) on 71 products, 66 of them in this
  catalogue (2,667 rows), from 223 store-market pairs. A Riftbound group with no TCGplayer row (163 of them, such as
  `REC|Booster Box`) gets nothing until Rift Compare publishes one.

## 2026-11-14: The 2050 layer's light theme and reduced motion, fixed

- The hero's coloured word kept the dark theme's lights in the light theme, where the cyan read 1.98:1 on the near-white
  page. The light theme draws it with the same three lights a shade deeper (sky-700, indigo-700, violet-600): every point
  of the sweep 5.2:1 or better on `--bg` and `--surface` (`tests/contrast.test.ts` samples the gradient).
- `@view-transition` now sits inside `prefers-reduced-motion: no-preference`: the page cross-fade is motion too.
- The marquee's chips carry their own space (`margin-right`) instead of the track's flex gap, so the -50% loop is exactly
  one copy and no longer jumps 5px at each wrap.
- Under reduced motion the row stands still, so it becomes a sideways scroller with no edge fade, and the hidden second
  copy is not drawn: every game reachable by touch and mouse, each once. `tests/minimal-look.test.ts` pins all three.

## 2026-11-14: The Amazon matcher reads one game at a time

The Amazon pipeline came from YGO Compare unchanged, with a matcher built for one game. Run over the real catalogue
with simulated Amazon titles ("<game> <set> <product>"), it matched 1,408 of the 2,182 products it would search and
accepted 11 titles as another searched product, 4 of them in another game ("Union Arena SOLO LEVELING - Booster Box
(First Edition)" as Lorcana's The First Chapter box, a Pokémon Classic Collection pack as Digimon's, six One Piece
Double Pack Sets as the plain booster pack). `lib/import/amazon-match.ts` now holds an Amazon title to more than the
store matcher:

- The title must name the product's game and no other. Each line in `site.config.ts` carries its `amazon` words
  (`any` phrases, `not` phrases for games that share a word: Magic's FINAL FANTASY products, Fusion World against the
  older Dragon Ball Super game, the Shadowverse Vanguard collab, Weiß Schwarz's hololive sets).
- It is read against that game's products only, with the "ME06: " release code taken off set names
  (`IndexOptions.stripSetCodes`, off for the store import; the code still counts as a code of the set). A third of set
  names carry one, and no title spells it.
- A title naming a kind the product's name lacks (Double Pack, release event, Welcome, sleeved, blister, empty box,
  mystery, repack…) is refused, and those products are out before `matchSealed` chooses.
- Pokémon Japan is not searched: its titles say Japanese and the store matcher refuses every foreign title, so a
  search could only ever spend budget. An English title never reaches a Japanese product, nor the reverse.
- Searches say the game's name and the set without its code, not "trading card game".

Same simulation after: 1,930 of 1,938 searched products match themselves, none matches another product. Still open:
the page's Amazon search link and `amazonCarries` (US file and a one-game type list), and the credentials, which the
owner has not set.

## 2026-11-14: Our own crawl, for the 18 games no sister covers

19 of the 30 games with pages had no store row at all: 853 products, 23% of the catalogue, because no sister site
prices them (Riftbound has since come from Rift Compare). The owner asked for many more stores, with scam vetting.
Every one of the 1,163 stores in `data/public/stores.json` is already read by some sister for another game, so this
site now reads those same stores for the uncovered games itself (Star Wars: Unlimited, Flesh and Blood, Weiß Schwarz,
Vanguard, Sorcery, Grand Archive, hololive, Godzilla, Final Fantasy, DBS Masters, Shadowverse, UniVersus, Elestrals,
CookieRun, Palworld, WIXOSS, Battle Spirits, Alpha Clash; Naruto has no product yet and is left out).

- **The key is the TCGplayer id in the listing, never the title.** `matchSealed` measured against the sisters' own
  id-matched titles was wrong about 3% of the time (Collector's Booster Display read as the Set Booster Display), too
  many to be a primary key. TCGplayer-synced shops carry TCGplayer's id in the listing: in the handle it agreed with
  the sisters' truth 99.1% of the time, in the copied photo filename 98.6%. So a listing is taken only when exactly one
  catalogue id appears across handle, SKUs and photos and nothing contradicts it: another catalogue id or TCGplayer
  photo id, another game, a different product type in the title (a shifted handle: the pack's title on the box's id),
  a foreign, unfit or multiple listing, or the one-game matcher naming another product. The matcher only refuses.
  SKUs count only when the whole SKU is the id (optionally `TCG-` before, a condition after): a store's own codes and
  barcodes are not ids.
- **A probe first, weekly.** The stores' collection handles in the sister lists are all for the sisters' games, so
  `crawl-probe.yml` reads each store's `/collections.json` once a week and keeps at most four collections per game whose
  name fits that game's words and no other's. The import never reads a store the probe has not listed.
- **A stricter client than the sisters'.** `http.ts` retries 429s and sends a browser User-Agent; the crawl's own
  `polite-http.ts` does neither: robots.txt first (with `*` and `$`), our own User-Agent and `From`, a second between
  requests, two stores at a time, and a 401/403/429 or challenge stops the store for the run. The dormant store pass in
  `import-all.ts` (8 workers, retries, no robots check, one index for all games) is not reused.
- **Network apart from matching.** The crawl is its own workflow step before the import (never fatal; 45 minutes and
  6,000 requests at most, stores least recently read first) and writes only listings with the ids they carry
  (`data/crawl/listings.json`, git-ignored). The import decides with the whole catalogue, so the "no other game's id"
  rule sees every game, and its offers meet the same vetting, offer floor and 4x band as a sister's. A store not read
  in a run keeps its rows 72 hours after its last good read, the sisters' freshness rule.

The yield cannot be known from local data (0.8 to 4% of listings carry an id on Magic and Pokémon stores); the first
probe and `meta.json` `crawl.refused` will tell. Until the probe has run, `data/crawl/stores.json` is empty and the
crawl is a no-op.


## 2026-11-14: the crawl, tightened after review

- **A shop is its host.** A store listed in two markets (danireon, hobbiesville, themythicstore, npcollectibles,
  chonkycollectibles) was two sessions run side by side: two robots.txt reads and two requests in flight. The crawl and
  the probe now group by host: one session, one robots.txt, one queue a second apart, the markets read in turn; the cap
  is the per-store cap times the shop's markets, counted in that one session. The probe asks such a shop once.
- **A stopped store keeps what it finished.** A cap, budget or deadline stop used to throw every page away, and the
  store, never read to the end, went first again next run. Collections read to the end are now kept (`partial`); the
  store's other rows are carried under the 72-hour rule; the order is "least recently tried" (`crawl.tried`), not
  "least recently read". The probe keeps at most eight collections a store in all, so a full read (8 × 4 pages,
  robots.txt, the currency) fits the 40-request cap.
- **A failed page is not an empty one.** A 5xx, timeout or unreadable JSON on a collection page made the store "read"
  with that collection's rows missing, so one flaky run removed them at once. Now it is `errors` (not ok): the store is
  not marked seen, finished collections are taken and the rest carried. A 404 or a robots-disallowed path is still an
  honest nothing.
- **Raw store titles need more refusals than sister data.** Opened, open box, pre-owned, resealed, empty, break spots,
  repacks and missing packs are unfit; "(6 Boxes)", "Display of 6" and "Half" are another quantity unless the product's
  own name says so; a lone variant naming another kind of product ("Booster Pack" on a box id) or a quantity ("x6") is
  refused. A pack count ("(24 packs)") is NOT refused: most real box listings state theirs and the catalogue claims none.
- **A number is not proof by itself.** A handle or SKU id with no TCGplayer photo of it now needs the matcher to land
  on that product or the title to name its set (else `unconfirmed`): shops number their own SKUs with 5–6 digits. And any
  second TCGplayer-shaped id in a handle or SKU, in the catalogue or not, refuses the listing (`id-conflict`), as a
  second photo id already did. A store whose own numeric SKUs sit beside a TCGplayer handle id loses those listings:
  a missing price over a wrong one.

## 2026-11-14: The price rows' cart button says "Add to cart"

The owner, opening the price rows: "there needs to be an add to cart button ... right now, it just sends it to the site". The
cart button was already on every store row, but as a bare grey cart icon on a computer (lost on the tinted best-price row) and
as small coloured text on a phone, so it read as decoration. `CartAddButton` now carries its words by default ("Add to cart",
"In cart" once added; "Add" beside the icon below 640px where a row has no room), with a firmer neutral border, and the phone's
text button (`inline`) is drawn as a bordered button (`cart.css`). Neutral, never a new colour: the buy button stays the one
filled action and the calm three-colour rule holds. Nothing else moved: which rows can be added (open store rows, eBay and
Amazon with a live price; never a marketplace or a search row), the line's buy link and its affiliate tag, the row order, the
buy button and every placement are unchanged. A caller can still ask for the bare icon (`label={false}`).

## 2026-11-14: Go-live on tcgprices.app

The owner bought tcgprices.app on Vercel (team Specifix's projects, auto-renew off) and it was added to the `tcgprices`
project as the production domain, apex only: no redirect to www, because `SITE.domain` and every canonical are the apex.
Vercel Web Analytics is on (the plan's included tier). The ops monitor's three-hourly schedule is turned on with it.

## 2026-11-14: No eBay price anywhere, eBay is never the cheapest

A product page showed an "eBay AU" row marked BEST PRICE at A$639.95 (Magnificent Maestros display) and the "Cheapest
in Australia" box named eBay. The import was reusing a sister site's own eBay listing as an offer (and would have used
our own eBay state), so 2,646 eBay prices sat on 450 products and the homepage held 12 eBay picks. That breaks two rules
at once: this site has no eBay prices (eBay is the first pinned row, a tagged search, no price claimed), and eBay or
Amazon is never "the cheapest" on any Compare site.

- The import adds no eBay offer at all; `ebay-picks.json` is written empty and never read.
- Read side, so the published data is clean before the next import: `decodeEntry` and `summaryOf` drop eBay offers,
  `summarize` leaves eBay and Amazon out of each market's cheapest and the store counts.
- `priceRows().cheapest` skips eBay and Amazon (`neverCheapest`), and a paid alternative is never cheaper than it.
- The ops monitor's "No eBay prices" check (`src/lib/no-ebay-prices.ts`) is red when an eBay offer or pick reaches
  `data/public`; `tests/no-ebay-prices.test.ts` pins every layer.

## 2026-11-14: No row is highlighted as the cheapest; eBay and TCGplayer always pinned; ad banners under the hero

Owner: "don't highlight the cheapest price. Also here tcgplayer is the best price - we shouldnt make it any different",
"even for listings without ebay price - we should include an ebay price row at the top anyway saying check on ebay. Same
for tcgplayer", "Need some ad banners for amazon / tcgplayer / ebay … directly under the hero if possible". His
screenshot: a quick view in AU tinting Collectible Madness at A$239 as BEST PRICE with "Buy now" while TCGplayer was
US$99.

- `PriceTable` has no best tint, no "Best price" badge, no "Buy now" and no "+% vs cheapest": rows are sorted by price
  and every row looks alike (TCGplayer keeps its blue button). The phone top-buy block and sticky bar, which named one
  store "Cheapest", are gone from the product page.
- eBay's pinned row is always there (a tagged search when there is no eBay price, which on this site is always), and
  TCGplayer's too: a "Check TCGplayer" row linking the product's TCGplayer page when there is no TCGplayer price in the
  market. The quick view gets both (`/api/quick` returns `ebayQuery` and `tcgUrl`).
- `AdBanners`: three calm text banners (eBay, TCGplayer, Amazon where its store has our tag), labelled Ad, directly
  under the hero or page header on home, game, set, sealed and product pages, tagged `<page>-banner-<source>`. Browser
  only with its height reserved (h-14), so the server HTML still carries no ad and nothing shifts.

## 2026-11-14: Real game logos and real fantasy art, public domain only

Owner: "I think we can use real game logos here" (the hero's game tiles) and "tcgprices animation can use real images e.g.
dragons or fantasy, or swordmans … rather than just have a geometric thing".

- Only files Wikimedia Commons marks public domain or CC0 are used (`scripts/commons-fetch.mjs`, run by
  `commons-fetch.yml` on a `[commons-fetch]` push, wrote candidates for review; none is served from there). Card art,
  key art and anything non-free are never used.
- Logos: ten games have a wordmark that is public domain on Commons (too simple for copyright; still a trademark, shown
  only to name the game): `GameLine.logo`, `public/games/<id>.webp`, sources in `public/games/SOURCES.md`. Drawn as the
  background of a fixed-size light plate (never an `<img>`, so the hero still has no photo and nothing shifts) on the
  hero's game tiles, the game list and each game hub. Games without one keep the icon; "All games" keeps its icon.
  `SITE.disclaimer` names the marks as their owners'.
- Art: three public-domain paintings (Hendrich's Sigurd and Fafnir, Uccello's Saint George and the Dragon, Arbo's
  Valkyrie; `public/art/SOURCES.md`) fade into one another behind the hero words, dimmed, edge-masked, slow drift, 800 px
  files on phones, still under reduced motion. CSS backgrounds of a box already there, so no layout shift.

## 2026-11-15: Our own store list, cart in the quick views, single pack prices (owner)

Owner: "this site's going to contain the most stores out of all of our sites", and Reddit users on the Star Wars
Unlimited post asked for single pack prices.

- `data/crawl/own-stores.json` (`scripts/own-stores-merge.py` merges researched candidates into it) lists Shopify
  shops no sister lists. The weekly probe reads them in their own pass for EVERY game (`GameLine.ownCrawl` holds the words
  for the sisters' games; the entries carry `own: true`), the twice-daily crawl reads the collections it found, and a
  listing is still taken only by the TCGplayer product id it carries. A shop a sister lists is skipped by the probe and
  guarded in the import (`mergeOwnCrawl`): its rows would double. A candidate with no TCG collection simply gets no
  entry. Same politeness rules as before; the crawl budget is 12,000 requests and 90 minutes a run, stores tried longest
  ago first, so what one run cannot reach the next does. Candidates come from research (never a paid API); vetting
  (`vet.ts`) judges them like any store.
- `PriceTable` rows in the quick view (`compact`) and the set page's quick buy carry the labelled "Add to cart" button
  too, as on the sister sites.
- A booster box's single pack (`lib/packs.ts`, same set and same edition by name only; a promo pack pairs with nothing)
  shows beside the box on the set page's quick buy and under the price on the box's page. The focus keeps a kept box's
  pack when TCGplayer prices it or a store lists it. No pack count is claimed.

## 2026-11-15: Own-store lists by research batch (own-stores-<region>.json)

Owner: "the most stores of any site". `scripts/crawl-probe.ts` now reads `data/crawl/own-stores.json` and every
`data/crawl/own-stores-<name>.json`, so parallel research batches add their own file instead of editing one list; the
same host and market (or key) in two files is read once, the first file wins. First batch: 24 AU and 60 EU Shopify
shops (`docs/store-research/2026-11-15-au-eu.md`), each answering `/meta.json` in its market's currency. The weekly
probe still decides which of their collections are read, and vetting still judges each store on every import.

First measured result of the own store list (2026-11-15 import): 187 candidate shops listed, 92 held a game's collections,
the crawl read 928 of 941 stores (6,372 requests), took 1,790 of 183,120 listings (was 1,428), and the store directory went
from 1,167 to 1,186 stores. Most shops carry no TCGplayer product id in their handle, SKU or photo, so the id-only rule
refuses their listings (`no-id`); a shop is counted only once one of its listings is taken. Taking those listings by title
for the own list would raise the count a lot but breaks "never take a crawl listing by its title": the owner's call.

## 2026-11-15: Own-list shops may be taken by title, strictly (owner chose "Yes, with strict guards")

The id-only rule left 165 of 187 new shops with nothing taken. For the shops of `data/crawl/own-stores.json` ONLY
(`CrawlStoreRun.own`), a listing that carries no TCGplayer-shaped id at all is taken by `pickByTitle`
(`lib/import/crawl.ts`): in stock; none of pickId's refusals (opened, resealed, foreign, break, repack, quantity); the
one-game matcher lands on exactly one product across the listing's games; the title names a product type and it is the
product's own; one box is one box (`isMulti`); and the price is 60-160% of the product's TCGplayer market price, so a
product with no market price is never taken. Sister shops and every shop with an id keep the id-only rule.
`meta.json` `crawl.titled` counts the listings taken this way. If it ever shows a wrong match, tighten the band or end
the exception here; never loosen it.

## 2026-11-15: Guides are data studies, written once and kept true by tokens (owner: "unique, insightful, real search terms")

The blog was empty. A guide here answers one question only this site's data can answer, and its numbers are tokens
(`{{study:boxes}}`, `{{study:beat}}`, `{{fact:KEY}}`, `lib/game-study.ts`, `lib/post-render.ts`) over the committed files, so
it is true after every daily import without an edit. First two: how much a booster box costs per game (TCGplayer US
market price, released sets, median, 5+ boxes a game) and how often a US store undercuts TCGplayer per game (30+
products; item price only, USD against USD). Rules: never a per-pack figure (pack counts are not verified), never a
claim a table cannot back, never repeat `/price-report` (the all-games figure; the guide is the per-game cut and links
to it). Titles, descriptions and keywords hold no token (only the body and FAQ answers are rendered).
Search evidence: tcgprices.app had no Search Console impressions on 15 Nov, so the topics come from the sister sites' real
queries ("how many packs in a booster box", "cheapest booster box", "where to buy sealed"); a topic is not written
without one. `tests/guides-data.test.ts` pins that no token reaches a reader.

## 2026-11-16: The logo is a fanned stack of three cards

Owner chose it from six drawn options (the isometric box it replaces looked like every other price site's cube): the card stack
with a diagonal shine and an inner frame, no symbol on it (the arrow variant was rejected). `public/icon.svg` and
`src/app/icon.svg` are the same file (a dark rounded tile, so the tab icon reads on a light browser); `apple-icon.png`,
`favicon.ico` and the logo tile in both share images were redrawn from it. Never put an arrow or a price symbol on the mark.

## 2026-11-16: Black Friday and Cyber Monday pages as deal cards, grouped by game

The two pages were one long table per section. They are now a hero (both real dates with "in N days", counted in the browser
so a CDN-held page is never a day out; four real figures: US deals today, biggest saving, games with deals, stores), a
jump-chip row, "Biggest savings under TCGplayer" (the top six by saving), one section per game ordered by that game's best
deal value, then each other market's store deals. Every deal is a card (`DealCards.tsx`): photo, game, name, the store's price
large, TCGplayer's market (or the middle of the market's stores) beside it, the saving badge, "View deal" and a labelled
"Add to cart" (full words even on phones: the card has room). Rules kept: stores only (never eBay or Amazon), no "was" price,
no deadline or urgency copy (the day counts are the event's own date, not a sale end), no pop-up. The one new claim, "market
down N% in 30 days", appears only when the product's own 30-day change from our price history is -5% or worse.
URLs, titles, descriptions, h1 and the FAQ are unchanged. Port to the sister sites by hand (same pure helpers `groupBy`,
`daysUntil`, `daysLabel` in `lib/black-friday.ts`, tested).
## 2026-11-16: The deal agent starts as a deterministic judge on a flag, with its own store-price history (owner: "an AI deal agent for wishlists")

The idea: a visitor lists what they want and is told when a price is genuinely low, with reasons, never a store's own "was"
price. Prototype only, behind `NEXT_PUBLIC_DEAL_AGENT=1` (off: `/deal-agent` and `/deal-signals.json` are 404s, nothing links
to them, no spend).

- **The verdict is code, not a model** (`lib/deal-agent.ts`). Every reason it gives is a number we hold. A model may later word
  the reasons or draft a message; it never decides a verdict, and no model call exists in this change (US$0). Any later call goes
  through the AI pilot's US$5 ceiling (`AI_PILOT_MAX_USD`) and never raises it without the owner and a logged receipt.
- **We had no store-price history.** `data/history` is TCGplayer's reference price only, so "is this store's price its lowest?"
  could not be answered. The import now also records the cheapest in-stock STORE price per product and market
  (`data/store-lows/<setId>.json`, change-only points, 0 = out of stock; never eBay, Amazon, TCGplayer or a pre-order; never
  converted). Verdicts need 14 days of it; until then the best verdict is "good" and the page says how few days it has.
- **The rule was fitted on real history, not guessed.** `scripts/deal-agent-backtest.ts` on 55 days of RiftCompare's sealed
  history (350 series, 7,717 judged days): a price at its 60-day low and 8%+ under its median was followed by a lower price
  within 14 days 42% of the time (the same as any day, 42.6%). Split by a feature: a first-day dip 57% against 38% when it had
  held a day, a shallow dip 56% against 34% at 15%+. So "genuinely low" needs the 60-day low, 15%+ under the median and a
  second day: 29.6% later lower (16.5% by 10% or more), against 47.1% for the naive "dropped since yesterday" rule, and 33% /
  27% in the earlier and later half of the run. The rule was tuned on the same run, so the split is a sanity check, not proof;
  rerun it on this site's own data when it has 29 days (about 14 December).
- Guards: one store is no verdict; under 40% of the stores' median (3+ stores), under half of TCGplayer, or under 60% of its own
  usual price is "can't tell", never a deal (a wrong listing is likelier).
- Not done: a button on product pages, emails, any link to Bargle (its CLAUDE.md says never link it from the Compare sites; the
  owner decides if that changes).
## 2026-11-16: Open price data (/data): a stores-only CSV, the Sealed Price Index and an embeddable widget

Owner go ("make TCG Prices the flagship", 11-16): a free, dated, credited dataset, built to earn links and press. Pieces:
`/data` (the page, with `Dataset` JSON-LD), `/data/sealed-prices.csv`, `/data/price-index.json` and `/embed/price-index/<game|all>`
(`lib/open-data.ts`, `lib/open-embed.ts`, `scripts/open-index.ts`, `tests/open-data.test.ts`). All static files built with the
deploy (no function, no new cache); licence CC BY 4.0 with a visible credit link.
- **Stores only.** One row per sealed product and market: the cheapest in-stock, non-pre-order STORE price, in the store's own
  currency, plus how many stores have it. No TCGplayer, eBay or Amazon price or photo (their terms are theirs; the older
  `/prices.json` does count TCGplayer and now says so), no store name or link (the file must not become a map of the stores),
  no Fetch TCG feed content. TCGplayer's product id is the join key. The page's one TCGplayer figure is the existing derived
  "stores undercut market" stat (`storesVsTcgplayer`).
- **The index is chained, never back-filled.** `refresh-prices.yml` runs `scripts/open-index.ts` before the data commit
  (continue-on-error): it writes the day's US basket to `data/open/baskets/` (last 8 kept) and chains `data/open/index.json`:
  level = yesterday's level × the median ratio over products priced on both days, 100 on 2026-11-16, equal weight, so a new
  product does not move it. Fewer than 8 common products keeps the level. A failed day is a gap. A game's own line shows only with
  10+ products. The 7-day change and chart appear as days accrue; nothing is estimated.
- Outreach and press: point at `/data` and the widget. Never claim a figure the file does not hold.

## 2026-11-16: Collection tracker v2 (history, add by search, backup) and the Pro design (owner: TCG Prices is the flagship)

My collection (`/collection`, `lib/vault.ts`) already valued a browser-kept list from `/prices.json`. v2 adds what Collectr
leads with, with no account and no new service: a value-history chart backfilled from the committed price history
(`/api/history/<productId>`, CDN-held 24 hours, `lib/vault-history.ts`: TCGplayer market price in US$, what today's items
would have been worth each day, starting on the first day every item has a price so the total never jumps), add-by-search
on the page itself, and a save/load backup file for moving the list between devices (items and quantities only). The chart
is labelled as TCGplayer US$ because it is a different number from the headline total (cheapest in-stock store price in
the visitor's market); never present them as one. The chart reads the 60 most valuable items. Nothing is stored about
anyone and no page reads a cookie.

**Pro is designed, not built, and payments stay off (owner's call on price and billing).** It follows the Dex Premium
pattern (`strategy/premium-rework-2026-11-16.html`): sign-in by emailed link and the Rift-signed token, plans in Rift's Stripe,
so this site still holds no address and no mail key. Free keeps everything above, 60 days of history, the cheapest price,
every store row and the price-drop alerts through the shared service. Pro adds 365 days of history, CSV export (formula-safe),
no inline ad strips or phone dock (price tables, order and paid rows stay), and a synced list across devices. Never gated:
the cheapest price, store rows, alerts already free. No Pro button or "coming soon" shows until the token path exists.

## 2026-11-16: As many stores and listings as possible: title matching for every crawled shop, wider band, no domain rule (owner)

Owner: "as many stores as possible, we don't need to be that strict, at least 10,000 to 20,000 listings for each TCG, don't be too
strict on recognizing which stores are legit". Measured first (2026-11-16 data, store offers without TCGplayer): Pokémon 41,675,
MTG 39,120, Lorcana 8,862, Pokémon Japan 5,772, One Piece 5,042, Yu-Gi-Oh! 4,261, Riftbound 2,543, every other game under 2,000
(Flesh and Blood 548 on 93 products); 1,319 stores. The last crawl refused 127,224 listings as `no-id` and 55,235 as `unconfirmed`.
So 10-20k a game is out of reach for the small games whatever the filter: it is products × stores, and Flesh and Blood has 93
sealed products. The lever is the `no-id` pile.

Changed: (1) `pickByTitle` now runs for EVERY crawled shop, not only `own-stores.json` (all its other guards stay: in stock,
one product across games, its own product type, quantity one, jumbo agrees, handle agrees). (2) Its price band is 40-250% of
TCGplayer's market, was 60-160%; the single-offer floor (50%) and the 4× band downstream still apply. (3) The `no-domain` vetting
rule is retired: a shop on `*.myshopify.com` is no longer refused; the blocklist (chromavaults.myshopify.com stays) and
`too-cheap` still are. (4) New hard floor: a placeholder price (99999, 999900, 999999 cents and the like) is refused
(`refused.placeholder`). Kept: blocklist, HBT Collectibles ban, never an eBay price, no wrong-product guess beyond the above.
Re-measure listings per game after the next import; if wrong matches show up, tighten the band first, not the guards.

## 2026-11-16: AI places id-less store listings (owner: as many listings as possible, light filtering)

The crawl takes a listing only by the TCGplayer id it carries (own-list shops aside), so of ~200,000 listings read a day about
4,000 were taken. The owner's call for TCG Prices (2026-11-16): reach 10,000 to 20,000 listings per game, "don't be too strict on
the errors". A pilot measured Sonnet 5.5 against listings whose id is known: 187 right, 1 wrong of 188 answers (99.5%); Haiku was
silent on most. The shadow pass (`scripts/ai-shadow-match.ts`, `ai-shadow-match.yml`, dispatched by hand) asks Sonnet about each
in-stock, sealed-looking id-less listing (a shortlist of 25 catalogue products, "null if unsure"), runs deterministic guards on the
answer (product type, multi-pack, foreign/unfit, print and edition words must agree) and caches the decision by store host + title
in `cache.json` on the never-deployed `ai-shadow` branch, so later runs pay only for new or changed titles. First pass: 20,531
id-less listings, 14,582 asked at US$0.0017 each, 4,854 placed, 3,839 of those through the guards.

- **Live, with light checks** (`pickByAi`, `lib/import/crawl.ts`): `refresh-prices.yml` copies the cache next to the crawl and the
  import runs with `AI_SHADOW_LIVE=1` (repository variable `AI_SHADOW_LIVE`, default 1). A decision is taken when the listing is
  in stock with no id, passes the existing unfit / foreign / opened / quantity refusals, the product is sealed (not an insert) and
  of a game the listing was crawled for, the guard passed (or its only complaint is a title naming no product type), and the price
  sits in a WIDE band of 40-250% of TCGplayer's market price (the by-title rule for own shops keeps 60-160%). A product with no
  market price is refused. Vetting and the 4x band downstream still apply.
- **Roll back** by setting the repository variable `AI_SHADOW_LIVE` to 0: the next import takes no AI placement and the rows
  disappear. `meta.json` `crawl.aiTaken` counts how many were taken. The by-id rule is unchanged for every other path.
- **Never** an AI answer without a recorded decision, never a call to the model from the import (the import reads a file), never
  an AI placement into a sister's data or the price-history of a product it has no market price for. The pass runs on free
  Anthropic credit only (US$100 Max grant to 17 Dec); when it is gone the cache keeps serving and only new titles stop being decided.

## 2026-11-16: One game per guide, one finding per guide (owner: a continuous programme, insightful, long, thumbnails, product images)

Single-game guides (Star Wars Unlimited Carbonite vs standard, Flesh and Blood price vs stock) each test ONE claim the
data can settle, never a restated list (`/games/<slug>` owns the list). New tokens: `{{study:setboxes:<game>}}`,
`{{study:variant:<game>:<Word>}}`, `{{figure:<product id>}}` (the stores' and TCGplayer's own photo, hotlinked, with its
live price) and game-keyed facts (`{{fact:carbMedian:swu}}`). Thumbnails come from the shared generator
(`/mnt/project-files/seo/blog-generator/thumb-render.mjs`, real numbers on the chart, dated). Prose names no card text, pack
count or print run it cannot source; an inference is labelled as one. `tests/guides-data.test.ts` pins that each thumbnail exists.

## 2026-11-16: Seasons get an event layer (data-event), Black Friday week first (UI/UX squad, owner: a better shared seasonal theme system)

The season (`data-season`, Christmas 1 Nov to 26 Dec) stays the base; a short EVENT stacks on it as `data-event` on `<html>`, so
the Christmas gift guide stays through Black Friday. First event: `blackfriday`, the day after US Thanksgiving minus 7 days to
plus 3 (20 to 30 November 2026; `blackFridayWindow` in `lib/season.ts`, embedded for 2026 to 2032 as YYYYMMDD so the boot script
does no date maths). Its only visual effect is the 3px top hairline turning ONE amber (`--event-amber`) instead of cranberry and
pine: calm three-colour rule, no new colour, no motion, no markup, no layout shift. `?event=blackfriday` previews, `?event=off`
hides. The next events (Boxing Day sales, Lunar New Year) are one more entry in the same list. Ported to the sibling repos by
the same squad; each repo's own `season.ts` stays its own copy, kept equal by hand.
## 2026-11-16: Store prices on cheap products get a high band too (Data Quality)

The store price band (under `OFFER_FLOOR` of TCGplayer's market, over four times it) only ran from a market of US$3 up, so a Japanese Ninja Spinner pack at a US$2.19 market kept bescards' US$109.99 (a box's price), humbletcg's US$33 and gdgames' US$49.95. `storePriceTrusted` (lib/import/sanity.ts) now also drops, under US$3, a price over five times the market and over US$15; the low side stays off there (a cent-level low is normal). Both the sister pass and the own-store pass use it. 25 offers on the 16 Nov data. Not done: the wrong-set handle check (spankyscardshop ST09 pointing at a starter-deck-08 handle), a matcher change that needs its own title tests.

## 2026-11-16: Index audit, and the sitemap cut by kind of page

Search Console (bill.jyang101) on the first audit, two days after launch: the one sitemap (`/sitemap.xml`, 5,034 URLs) was read on 16 Nov with no errors; Google had crawled four URLs (the home page and three game hubs, 14 to 15 Nov), judged all four "Crawled - currently not indexed", and indexed none. No technical cause was found: robots.txt allows everything but `/api/`, `/go` and query strings; pages are server-rendered with full link lists. It is a domain two days old with no inbound links, so the levers are links, internal links and patience, not a fix to the markup.

What changed: `/sitemap-index.xml` lists `/sitemaps/<kind>.xml` (products, sets, games, guides, sealed-hubs, pages), the same URLs as the main sitemap cut by kind (`lib/sitemap-split.ts`, `tests/sitemap-split.test.ts`), so Search Console reports indexing per kind. `/sitemap.xml` stays the full list; robots.txt names both. Nothing is added to the sitemap, no URL changes, six-hour CDN cache like every page. Priority pages are requested one at a time, at most five a day, never in bulk.

## 2026-11-17: the AI placement runs after the title rule refuses, not only when it says nothing

Loosening `pickByTitle` to every crawled shop (2026-11-16) made it answer "unconfirmed" for most id-less listings, and
`takeCrawl` only offered the AI placement to a listing the title rule left as "no-id", so the AI took 0 where it had taken
3,133 the day before. `takeCrawl` now asks `pickByAi` whenever the title rule did not take the listing; the title rule's
refusal is still what is reported if the AI refuses too. Roll-back is unchanged (`AI_SHADOW_LIVE=0`). Also logged:
`meta.json` `crawl.refusedDetail` and `crawl.takenByLine` (diagnostic), and a sizing of the sealed focus in the trial
import (`FOCUS_SIZING=1`, `data/crawl/focus-sizing.json`; nothing changes).

## 2026-11-17 — Urgent release for the header-menu click fix

The dropdown items could not be clicked in Safari and Firefox on macOS (the menu closed on mousedown, before the click) and the owner asked for an urgent deploy. The fix was merged earlier on 2026-11-16 without a marker and the manual release was skipped by the 12-hour gap, so this entry lands with `[deploy] [urgent]` in its merge subject (owner: "deploy urgently"). One build.

## 2026-11-17: a culled product comes back when one store has it in stock

Owner's tap on a decision card (as many stores and listings as possible). Sizing from the trial import: widening the whole
sealed focus would add about 4,100 products, but only about 660 have any store offer (2,444 offers), so `minStores` goes
from 2 to 1 (a store has it IN STOCK, any age) and products with no store stay out. A product with no TCGplayer price and
fewer than two offers is noindex and out of the sitemap (`cardIndexable`), so one-store pages are not thin search pages.
Never widen the age or price floors for a product with no store.

## 2026-11-17: sitemap lastmod is the day a product's price moved, not the import time (site loop)

Every `/card/` URL carried the import's own timestamp as lastmod, so all ~3,800 changed every day and Google, which had
read the sitemap with no errors but indexed almost nothing, has no reason to trust the field. `productLastmod`
(`lib/sitemap-lastmod.ts`) now gives a product page the day of its newest TCGplayer reference-price point in `data/history`,
capped at the import time; a product with no history has no lastmod. Pages other than products keep the import time
(their lists do change daily). Same fix FigureCompare shipped on 2026-11-14.

## 2026-11-17: TCGplayer Cyber Weekend note on the deal pages

TCGplayer's Impact email (17 Nov) announced Cyber Weekend 2026: 9AM New York time 28 Nov to 11PM 1 Dec, 10% store credit on all
products (subscribers 13%+). The deal pages carry one text line under the hero from 20 Nov, "on now" from the start, gone after
the end (`lib/cyber-weekend.ts`, read in the browser so a CDN-held page switches off on time). Text only: no banner, no link of its
own, no pop-up, never in a price row or a ranking. Update the two instants next year.

## 2026-11-17: New-release price guides, one per newest set of a game

Bill asked for insightful posts on the newer releases of every game. TCG Prices holds sealed product only, so each new-release guide is a price guide for the whole set's sealed range, built from tokens so the numbers stay today's: `{{price:<id>}}` for a product, `{{ratio:<a>:<b>}}` (new, `lib/post-render.ts`) for one product's price as a multiple of another's, and the existing `{{sealed:<setId>}}` table of every product in the set with the cheapest in-stock store. First three: Pokémon Delta Reign, Magic Star Trek, Lorcana Hyperia City. Rules kept: no pack count or card text is stated (only what the listings carry), no estimate of what a box returns, no eBay or Amazon price. Single-card chase and signature guides belong to the sites that hold singles (Rift for Riftbound), not here.

## 2026-11-17: URL freeze, and two sides of the network, one footer link

Owner, from the Grok growth report (items 5 and 9): stop the sitewide cross-links between the sites, and freeze URLs.
The network now has two sides (`TCG_SIDE`, `sameSide`, `isTcgSide` in `src/lib/family-network.ts`, the same file in every repo): the
card-game and wargame sites on one, perfume, K-beauty, car parts, cameras, figures, sports cards and tech on the other. `clusterSisters`
and `footerSisters` return same-side sites only, so deal and pre-order tiles, the data jobs' copied feeds and the `/our-sites` (or
`/network`) list never cross. The footer keeps its single link to `/our-sites`; the "Every Compare Empire site" link to
compareempire.com is gone from the card sites. SportsCardCompare is on the other side from the card sites (its search results no
longer offer their searches). Where this repo had a repeated block of sister links (a blog "Also from us" aside, "Compare other TCGs"
on every card page, non-card sisters in `SITE.sisterSites`) it is removed. A contextual link from a guide to another game stays.
DexCompare's links read dexcompare.io (the old host is still accepted in a feed until Dex republishes). Not changed: price alerts,
`alert-feed.json`, the family feeds and the sister data reads: they are data, not links. Also a "URL freeze" rule in CLAUDE.md:
no mass path change without a redirect map, agents never flip hosts, no pop-unders or surprise navigation (this repo had none).

## 2026-11-17: Grok growth report: the index gate, a click log, IndexNow on change only, weekly Search Console tracking

Owner adopted the report's recommendations that fit the standing rules. What changed here:

- **Index gate** (`lib/indexing.ts`, `indexSignals` in `lib/data.ts`): a sealed product page asks to be indexed, and is in the
  sitemap, only with 2 or more in-stock priced STORE offers (never eBay, Amazon or the TCGplayer row) from stores read in the last
  14 days, or 1 such offer plus 4 or more history days in the last 30, and only while the catalogue's own import is under 14 days
  old. Everything else is `noindex, follow`, still reachable, nothing 404s or redirects that did not before. Upcoming-set products
  keep the reveal-week exception (any priced listing or reference) but also need fresh data. Today 2,903 of 4,503 product URLs
  qualify (was 4,503, the old rule indexed a TCGplayer reference alone). That is far above the report's "about 300": every
  qualifying page has two real stores, and the history clause is dormant until the history is 4 days deep (it is 3 at most). Query
  variants were already blocked by robots.txt (`/*?`) and canonicalise to the clean URL. `data/gsc/restore.json` (written by the
  weekly Search Console job) can put back a noindexed page that had demand.
- **IndexNow** (`scripts/indexnow-submit.ts`) now sends only never-sent qualifying product, set and guide URLs, and products
  whose cheapest in-stock USD store price moved 5% or more since last sent; no hubs, nothing every refresh, at most 1,000 a run.
  The record is `data/state/indexnow.json`, committed by `refresh-prices.yml` in a separate commit with no deploy marker.
- **Click log**: `/go` links carry the row's position (`r`) and its percent gap to the cheapest in-stock store (`g`); the browser's
  `buy_click` event gains `paid`, `position`, `price_gap_pct`, and `/go` writes `buy_click_geo` (country from
  `x-vercel-ip-country`, paid or store, position, gap) to Vercel Analytics and one runtime-log line. No database, no new egress.
  There is no landed cost on this site (postage is shown, never added), so the rank is the item-price gap. `scripts/paid-click-share.ts`
  sums paid share by AU, US, UK, CA, EU and the rest from an exported log.
- **Weekly Search Console tracking** (`scripts/gsc-weekly.ts`, `gsc-weekly.yml`, ops check "Search Console weekly"): appends one row a
  week to `data/gsc/weekly.jsonl`. It needs Bill's sign-in (a service account added to the property: `GSC_SERVICE_ACCOUNT_JSON`
  secret, `GSC_PROPERTY` variable); until then it is a no-op and the check is amber. Ops check "Index gate" is red if no product qualifies.
- **Inline price alert**: the product page's target-price form is open by default (`defaultOpen`), still inline, no pop-up.
- **Methodology** names its editor (Bill, first name only: the owner can add a surname), what is and is not tracked, and the
  affiliate disclosure; the footer already carried the plain "not affiliated" line. "Prices checked" already shows on product pages.
- **Cyber Weekend per-game hubs: not built.** The 30-day median they need does not exist yet: `data/history` holds at most 3 days
  per product (the site is 3 days old). `/black-friday` and `/cyber-monday` already list the real deals per game (under TCGplayer's
  market price, in stock). Revisit when 30 days of history exist.

## 2026-11-17: TCGplayer data notice in the footer

Grok growth report (2026-11-17), item 8 ("plain not-affiliated footer lines"), and the image-licence report (`/mnt/project-files/seo/grok-2026-11-17/image-licence-report.md`, item 11): TCGplayer's API terms ask for the notice "This product uses TCGplayer data but is not endorsed or certified by TCGplayer.", and no footer carried it. It is now one plain line in the footer, beside the existing not-affiliated lines (which are unchanged). Nothing else changed: no price, link, order or cache rule.

## 2026-11-17: /go treats a request that did not come from our own page as a bot

Impact showed 700 to 800 TCGplayer clicks a day across the TCG sites; Vercel's browser-side buy clicks showed about 165 a day. `lib/bot-click.ts` already sent a crawler on untagged
by User-Agent, Accept-Language and Sec-Fetch-Mode; DexCompare found on 15 November that a crawler with a whole browser's headers passes those (2,835 go_clicks on a day with 632
visitors). The same rule is now here: a Sec-Fetch-Site other than same-origin or same-site (a /go URL opened directly is "none", one followed from elsewhere "cross-site") is a bot;
an absent header is left alone. A bot is still sent on, untagged, and nothing is logged. A bot clicking in a real browser on our page still passes; that needs a Vercel Firewall rate limit.
## 2026-11-17: Back in stock page (restock tracker, first test)

Bill picked a restock feed from the new-opportunities list. `scripts/restocks.ts` (a step of `refresh-prices.yml`, after the import, never
fatal) compares each price shard with the last commit and records every independent store's offer that was sold out (flag 0) and is in stock
(flag exactly 1, never a pre-order) now, in `data/public/restocks.json` (7 days, 800 events, one per product + store + variant per day).
`/restocks` lists them (revalidate 86400, not in the sitemap yet, linked from the nav's "Deals & stock"). Real check before building: the
committed files of 16 Nov 02:29 UTC and 17 Nov 05:17 UTC show 292 restocks on 203 products among 123,649 store offers (304 went the other
way). Display only: never a sort, deal, alert or price claim, TCGplayer/eBay/Amazon rows never count, and the stock can change between checks
(the page says so). The first file was seeded once from that same comparison (`RESTOCKS_BASE`/`RESTOCKS_AT`, backfill only). Ops check "Restock
tracker" (amber when missing or over 30 h old). Next: look at `/restocks` visits and return visits after a week before putting it in the
sitemap, adding an RSS feed or a Discord post; sealed price trend ("Sealed Intel") is the second test.

**Addendum, same day:** `/restocks.xml` (RSS of the newest 50, revalidate 86400) and `scripts/restocks-discord.ts` (a workflow step, a no-op until
the `DISCORD_RESTOCKS_WEBHOOK` secret exists; at most 10 lines a run, no mentions) carry the same events. The sealed price trend idea ("Sealed
Intel") is parked on this site: `data/history` holds the TCGplayer market series, only since 15 Nov, so a trend is honest from about 1 Dec
(14 days). Rift's sealed history is the cheapest in-stock store price per group and moves with stock (Origins box US$60 to US$218 in 30 days),
so it is not used for a trend.
## 2026-11-17: Quick view: price history at the very bottom, at most 10 rows (owner)

Owner, 2026-11-17: the price-history chart at the top of the quick view is "not even that valuable". It now sits at the very bottom of the panel, below the rows and the ad pair, and the quick view lists at most 10 rows (`maxRows`): the pinned eBay and TCGplayer rows first, then the cheapest others, with "N more listings on the full page" (the page and "See price history and details" still show everything). The Cheapest price box and the Add to cart buttons are unchanged. Paid rows, their order and wording are untouched in every A/B arm (Dex and MTG tests, 20 Nov to 3 Dec).

## 2026-11-17: The sitemap lists the strongest 1,200 products, growing 300 a week (Gemini SEO report; owner's yes)

A Gemini report suggested a 150–250 URL sitemap for the new domain, widened as Google indexes it. The owner said cutting further is fine. `app/sitemap.ts` now lists every indexable
sealed product ranked by fresh in-stock store count, then 30-day history points (`rankForSitemap`, `lib/indexing.ts`), capped at `sitemapProductCap()`: 1,200 from 17 Nov, +300 a week, at most 2,900 (the
previous size). Pages outside the cap stay indexable (the gate is unchanged) and are found by links; IndexNow and the weekly GSC index diet are unchanged. A weekly step stands in for "expand once
80% of the last batch is indexed"; if Search Console shows under half of the first 1,200 indexed by 1 Dec, hold the cap. `tests/sitemap-cap.test.ts`.

## 2026-11-17 AI assistants: count their visits, and say how to cite us

Crawl access, llms.txt, JSON-LD and the open CSV/index were already in place; what was missing was any way to see whether AI answers send visitors. `AiReferralTracker` (client, once per session) reads `document.referrer` and `utm_source` (ChatGPT adds `utm_source=chatgpt.com`) through `lib/ai-referral.ts`, sends the Vercel Web Analytics event `ai_referral` (assistant, landing path) and tags later `buy_click` events with `ai_source`. Read it in Vercel → Analytics → Events, filtered by `assistant`. Nothing is stored beyond sessionStorage. llms.txt gains a "Citing these prices" block: dated prices, the CSV/index URLs, the licence and a suggested credit line. No spend, no new route, no change to ranking or links.

## 2026-11-17: Fiverr first-time-shopper review of DexCompare, applied here (owner)

The owner bought a professional first-time-shopper QA review of DexCompare and asked for every finding that generalises to reach every site.
Applied here (the full reasoning is in DexCompare's DECISIONS.md, same date):

- **Cart hand-off:** the cart drawer opens with "You pay each store on its own site. We never take payment." (normal-size text, first thing in the
  drawer); "Total before postage" became "Estimated total (before postage)"; the add button's tooltip says you pay at the store. The label stays
  "Add to cart" (owner, 2026-11-14: a literal "Add to cart" on every row).
- **The quick view sets the tab title and description while it is open** and restores them on close (the tab used to keep the list's title).
- **A total beside the shipping figure** on a row that charges postage ("+ $X shipping · ≈ $Y total").
- Already true here, no change: an eBay or Amazon row is never "the cheapest" or "Best price" (`neverCheapest`), so the table never contradicts its own headline.

## 2026-11-18: The return nudge, a targeted prompt for a visitor who has clicked a store (owner)

Earnings fell and the owner asked for "targeted ads … in very subtle ways". The leak: about 70% of buy clicks go to stores that pay nothing, and
Amazon clicks fell to near zero on 13 Nov. The one targeted placement shipped (the owner asked for it explicitly; it applies the rule "no pop-ups
for new visitors" by needing a store click first): after a click on a STORE row, when the visitor comes back to the tab (away 4 s or more, within
30 minutes), a small dismissible card says "Back from <store>?" with the same product's eBay and TCGplayer links already on the page, labelled Ad,
rel sponsored, `from=<placement>_nudge`. Once a session, 20 s or ✕ or Esc, never Amazon, never a price or "best", yields to the rating card.
**Measured, not assumed:** half the visitors are the control arm (localStorage `rn-arm`). `nudge_eligible` fires for both arms; `nudge_shown` and
`nudge_click` for "on"; every `buy_click` carries `nudge_arm`. Lift = paid (eBay or TCGplayer) buy clicks per `nudge_eligible`, on against off, plus
the placement's own clicks (`from` ends `_nudge`). Rollback: remove `<ReturnNudge />` from the root layout. `lib/return-nudge.ts`,
`components/ReturnNudge.tsx`, `tests/return-nudge.test.ts`.

## A phone bottom nav, opt-in first, built to avoid what killed Rift's — 2026-11-18

Owner liked Catchback's bottom bar. Rift deleted its own on 2026-09-18 (TCGEmpire DECISIONS.md) after three fixes for one fault: it
computed where the browser's address bar was (`100lvh - 100dvh`, then a `visualViewport` "lift") and floated under pinch-zoom and on a
Z Fold. This bar does NO position arithmetic: `fixed inset-x-0 bottom-0` (the placement the ad dock has used since 2026-11-06) plus
`env(safe-area-inset-bottom)`, moved by `transform` only. `tests/bottom-nav.test.ts` fails on lvh/dvh/svh or a `visualViewport` height.

- Tabs: Home, Search, Deals, Cart (opens the cart drawer), Menu (opens the existing menu). Browser only, below 768px, nothing in the
  server HTML. Hides on scroll down (10 px of real movement), shows on scroll up and at the top; hidden while zoomed, while a text
  field has focus, while any open dialog / the menu / the cart drawer is up, on a buy-bar page, and whenever an Add to cart button is
  in the strip it would cover. The ad dock yields to it (`html[data-bottomnav]`), so one bar at a time.
- `SITE.bottomNav`: "optin" (only `?bn=1`, kept in localStorage; `?bn=0` clears), "on", or "off" (rollback; ignores `?bn=1`).
  Shipped "optin": the owner tries it on his own phone before anyone else sees it.
- Found on the way: the closed cart drawer is always in the DOM as `aria-modal="true"` (inert and aria-hidden while closed), and
  `AdDock`'s "a dialog is open" check matches it, so the dock may never show on this site. Not changed here; see the thread.
## 2026-11-18: cart checkout opens every store or none (owner)

Checkout (`openAll`, `src/lib/cart-checkout.ts`) opens one blank tab per store inside the click, and only when every one opens does it send each to its store's own tagged link. If the browser refuses any, it closes the ones that opened, visits nothing, and the drawer shows the allow-pop-ups steps and a "Try again" button. Before, the first store opened and the rest were refused, which left the visitor with one tab. Chrome 157 on dexcompare.io and on url-opener.com (the owner's model, which does the same close-and-ask) both give one tab until pop-ups are allowed for the site; with them allowed, all open. No browser API grants that permission from a click, so the steps stay.

## The bottom nav, made smoother — 2026-11-18

Owner tried `?bn=1` on his phone: good, "a bit of lag". Changes: no backdrop blur (it repaints every scroll frame on a phone; the bar is
opaque); the bar always slides on `transform` and hides AFTER the slide (it used to pop out); the scroll handler reads `scrollY` only, no
React state and no layout reads (an open dialog and an Add to cart button in the bar's strip are cached, refreshed by a
MutationObserver and an IntersectionObserver); it shows on the first 4 px upward flick (hides after 10 px down); tabs have instant
`:active` feedback and `router.prefetch` on touch-down. Measured at 4x CPU throttle on an iPhone-sized viewport: frames over 33 ms
58 with the bar vs 68 without. Owner: happy to have it on every site.
## 2026-11-18: Search and sort the movers by % gain or loss (visitor feedback, RiftCompare)

A RiftCompare visitor asked to "search and sort index by % of gain or loss (better than just toggling the gainers or losers button)". `/movers`
now opens with one list (`MoversTable.tsx`) of every product in its four lists, merged per product with both its 7-day and 30-day change: a
search box, a "Sort by" menu (biggest % move either way, biggest gain, biggest loss, price, name), a 7/30-day switch and a Risers/Fallers
toggle. It reads the rows the page already ranks (`movers()`), so no new data or fetch; every % is the product's own TCGplayer market change.
The four lists stay below it. It hides itself until there are two movers.
## 2026-11-18: Gap crawl, Bandai's games at the stores BandaiCompare does not list

Site loop, per-game coverage report (`scripts/coverage-report.ts`, 17 Nov import): Union Arena had 94 of 151 products with
no in-stock store, Fusion World 50 of 84, Digimon 32 of 112. Their store rows came only from BandaiCompare (318 store
entries, about 190 kept products after its cull) and from the 9 / 24 / 68 own-list shops whose collections name them; the
crawl took 6 Union Arena and 19 Fusion World listings on 17 Nov. The rest of the 1,355-store directory (Dex, MTG, YGO and
the other sisters' shops) was never read for those games, though many sell them.

- `GameLine.gapCrawl` (`ua`, `fw`, `dg` in `site.config.ts`): the weekly probe reads those games' `ownCrawl` words at a
  directory store ONLY when BandaiCompare's own store list (from `SISTER_DIR`) does not name its host. A sister list not
  checked out means the game is read nowhere. The crawl words (`crawl`) stay for games no sister covers
  (`tests/crawl.test.ts`), so "no store is visited for a game a sister covers" still holds at every store that sister reads.
- The uncovered games keep their collections and their slots: a collection an uncovered game claims is never re-read as a
  gap game's, and gap games take only the slots of the 8-a-store cap the uncovered games leave (`capWithGap`). With no gap
  option the probe's result is byte for byte what it was.
- `addCrawlOffers` (import): a sister's row for the same store, market and product always wins and the crawl's is left out
  (a store BandaiCompare added after the weekly probe). Listings are taken by the same rules as every crawl listing (id,
  title rule, AI placement), so matching is not loosened.
- Measure after the next probe (Sunday) and the import after it: Union Arena / Fusion World / Digimon products with 0
  stores, against 94 / 50 / 32. If it lifts them, the same flag is the way for another sister's thin game.

## 2026-11-18 — Accounts on TCG Prices (one network account)

Owner (18 Nov): expand accounts beyond RiftCompare and OP Compare, team decides. TCG Prices plugs into RiftCompare's sister account
service like DexCompare and MTG Compare: `/account` (emailed sign-in link; Google once `NEXT_PUBLIC_TCGPRICES_GOOGLE_CLIENT_ID` holds
its own client), `/watches` (every price alert set with that email, any device, with a stop button), `/premium` (RiftCompare Premium:
no banner ads, 200 alerts). A quiet account icon in the header from sm up and "Sign in / My watches" in the phone menu; no pop-up, no
corner card. No back-in-stock button yet: the card page is one CDN copy for every market and needs a per-market island first.
Members' banner ads (`data-ad="banners"`, `data-ad="inline"`) are hidden by `data-adfree`; the price table is untouched.
The browser keeps one token (`tcgprices_premium_v1`); no page reads a cookie or header. Sign-ups: RiftCompare admin Accounts › TCG Prices.

## 2026-11-18: Home pages rank items by demand (owner: "the most popular items should be on the homepage in that order")

The owner wants every site's home page to lead with the items most likely to earn a click, revenue and a purchase. Each home list
(shelf, grid, picks, deals, pre-orders, popular cards) is now ordered by `src/lib/home-rank.ts`, the same pure file in every repo:

- **Demand**, real numbers only: each item's product page views and buy clicks, last 28 days plus the last 7 again (recent counts
  twice), from Vercel Web Analytics through RiftCompare's public `/api/demand/<site>` (`src/lib/analytics/item-demand.ts` there; top
  100 product pages a window, `buy_product` events by product where a site sends them). A buy click weighs 20 views. Log scale, so
  one runaway item cannot take the list.
- **Value**, from the item's own facts: in stock and at how many stores, a paid row with a price, the price (commission is a share of
  it, on a soft curve), a release in the last 30/90 days or an open pre-order, a price under its usual.
- `score = value × (1 + log(1 + views + 20 × clicks))`.
- **Safe fallback:** under 30 views and clicks across a list, demand is ignored and value alone decides; equal scores keep the list's
  old order. `NEXT_PUBLIC_HOME_RANK=off` (Vercel variable) turns it off without a code change.
- **No feedback loop:** the 4th slot, and every 8th after, goes to the best-valued item with no demand yet, so a new item is seen
  before it can be clicked; the 7-day weight lets a leader fall when it stops being clicked.
- **Data path, no database:** the daily data job runs `scripts/pull-demand.sh <site> <file>`, which commits the demand file to
  `main` with no deploy marker (it rides the release). That file's git history is the log of what the ranking saw each day.
- Heroes stay words, search and ways in (owner, 2026-11-13): the ranking orders the lists, it adds no product to a hero.
- Measure: buy clicks per visitor sitewide and on home pages, the week before (11-18 Nov) against the two weeks after the release;
  a demand file under 30 views for a list means that list ran on the fallback and is read apart.

Here: the home page lists (featured shelf, packs, pre-order rows, the newest set's row, deals) are ranked; `data/demand.json` is written into the daily data commit by `refresh-prices.yml`.

## The bottom nav is ON for every phone visitor on TCG Prices — 2026-11-18

Owner tried the opt-in build on his phone (good; lag fixed by the smoother build, verified live) and wants it on every site. `SITE.bottomNav`
is now "on": below 768px everyone gets it; `?bn=0` turns it off for a visitor (kept in localStorage), `?bn=1` back on, and "off" in the
config is the rollback for all of them. Everything else in the 2026-11-18 entries stands.

## "Ask our prices": the Search tab opens a plain-words sheet, no model — 2026-11-18

Owner liked Catchback's chat. Its "chat" is an AI agent that routes a sentence to a filtered page, not a person. Ours (`lib/ask.ts`,
`components/AskSheet.tsx`, `SITE.ask`): rules turn a sentence into (a) our own section pages (pre-orders, back in stock, movers, deals, the
game's hub), (b) a search of the words left after the filler is removed, answered from `/api/search` (CDN-cached), "cheapest" keeping the
lowest-priced matches, (c) a pasted store link to the "is this a good price" checker. No model call, no key, no database, nothing stored
about the visitor; no match says so and offers the search page. It only opens from a tap on the phone bottom nav's Search tab (a plain link
to /search without it, or with a modifier key): never by itself, no bubble, no pop-up. Events: ask_open, ask_query, ask_result_click,
ask_route. An AI-answered version needs the owner's OK and the AI budget; it is not built. Ships with the daily release, not urgent.

## 2026-11-18: "Ask our prices", the in-words answer (built dark)

Owner: the Anthropic balance is fine and the AI freeze is lifted within existing ceilings, so the sheet may answer in words. `/api/ask?q=`
(`lib/ask-ai.ts`): the same rules parse the sentence, `/api/search` finds the rows, then ONE Claude Haiku 5.5 call (no thinking, 220 output
tokens) picks up to three of those rows and writes one or two sentences. The guard keeps the model to our rows: picks are result numbers,
an answer that names a figure not printed on the rows, or a link, is dropped (the picks stay). About US$0.00026 a new question (Haiku 5.5
US$0.10 in / US$0.50 out per MTok, about 1,300 in and 200 out); an identical question is CDN-cached six hours and costs nothing.
Caps: 300 model calls a day per server instance (`ASK_AI_DAILY_CAP`, about US$0.08), 8 a visitor a day (their browser), a button press never
a keystroke. The hard ceiling is the owner's Anthropic workspace spend limit; the instance counter is a soft cap (no database).
OFF until the owner sets `ANTHROPIC_API_KEY` and `ASK_AI=1` on Vercel Production AND `NEXT_PUBLIC_ASK_AI=1` (the button only shows then); off,
the sheet is the rules-only version. Nothing about the visitor is stored. Roll back: unset `ASK_AI`.

## 2026-11-18: Share cards say more, guides and sets get the button, and a share-for-a-deal test (owner)

Owner: "a share feature … a very simple link and a link thumbnail that is very aesthetic and contains enough detail … some
insights … the ability to share pages and guides", then "if you share … you can open Deal Finder … gives incentive".

- The card share image (`card/[slug]/opengraph-image.tsx`) keeps its text-only rule (no photo, ~58 KB) and adds a right-hand
  panel: the market price line over the last 30 days (`sparkPath`, a vector path), the week's or month's move in words
  (`moveNote`, real changes only) and how many sellers have it in stock. Still drawn on first request and kept a day.
- The link stays the page's own canonical URL plus `utm_source=share&utm_medium=<what>`: already short (`/card/<slug>`), and a
  separate short-link host or `/s/<code>` table would add a function, a redirect and a store of codes for no gain in previews.
- Guides (`/blog/<slug>`), set pages and Deal Finder now carry the share button (mediums `guide`, `set`, `tool`).
- Share-for-a-deal: half of browsers (`share_arm` in localStorage, `pickShareArm`) see "Share · get a deal"; after a share
  completes the button opens a small card under itself with today's best store deal in the visitor's market and a link to
  Deal Finder, from the static `/share-deal.json` (`force-static`, built with the deploy, fetched only then). It is the
  visitor's own tap, closes with ✕, and shows nothing that is not free anyway: a store row only, never eBay, Amazon or
  TCGplayer, never a price withheld. The other half is the control. Events: `share { medium, arm }`, `share_unlock { medium }`,
  `share_visit { medium }` as before. Read share rate per arm at two weeks; keep the reward only if it raises shares.
## 2026-11-18: Feedback asks: "Was this page useful?" in the footer, a /feedback page, counted by the daily triage (owner)

The owner: "We need more feedback so can we find a way to get more". One RiftCompare visitor's note (sort the movers by %
gain or loss) became a feature the same day, but across the network three weeks brought about 58 star ratings and fewer than
ten written notes. Rift's own record also holds "too many popups asking for my opinion", so every ask here is inline.

- `components/FeedbackAsk.tsx` (the same file on every site): one line at the top of the footer, "Was this page useful?
  Yes / No". The tap is sent at once (a vote alone counts); only then does an optional "What would make it better?" box
  open. Never a pop-up, nothing fixed or floating, hidden for the rest of the visit on a page already answered, and in no
  quick view (the Dex / MTG quick-view A/B, 20 Nov to 3 Dec, is untouched).
- `/feedback`: the full form (an idea, something wrong, something missing) and "You asked, we built it", the changes
  visitors' notes have led to; add a line there when a note leads to a change. noindex, linked from the footer and the menu.
- Both post to `/api/report` as kind `feedback` (`lib/reports-github.ts`). A note is an inbox file like any report; a bare
  vote is `votes/<site>/<day>/<time>-up|down-<rand>.json`, counted from its file name by RiftCompare's daily *Reports
  triage*, which now prints a 7-day feedback table per site and flags every note for a look. No email address is asked
  for or kept: the thanks shows the site's inbox for anyone who wants a reply.
- This site had no `reports` branch of its own (its report and feedback forms could not save), so its reports now file
  on RiftCompare's (`SITE_REPOS`: `Specifxx/TCGEmpire`, under `inbox/<site>/`), where the triage already reads.
## 2026-11-18: Barcodes on sealed pages (owner: "unique identifiers … are easy SEO results")

Search Console says it plainly (TCGEmpire maintenance task `gsc-identifiers`, 90 days to 15 Nov): on KaeYoung every one of its 22 Google
clicks came from someone typing a product's barcode (318 barcode queries, 862 impressions), ScentCompare's barcodes drew 355 impressions,
and Gundam Compare's kit JANs show up too. TCGplayer's catalogue (`extendedData` "UPC", already read by RiftCompare's Pokémon section)
carries a barcode for about half of the sealed products, so each import now keeps it as `Product.upc` (`lib/gtin.ts`): check digit verified,
an 11-digit UPC given back its leading zero, and dropped when TCGplayer files the same code on two or more products (a case code on every
blister), because it would name the wrong product. Never taken from a store title, never invented.
The product page shows it ("UPC barcode" / "EAN barcode") with the TCGplayer ID, its Product markup carries `gtin12`/`gtin13` and
`productID: tcgplayer:<id>`, and `/api/search` finds a product when the whole barcode or TCGplayer id is typed (exact only). No new URLs.
## 2026-11-18: Leave nudge, an A/B test of a small "Before you go" card (owner: "we could have pop up affiliate clicks")

The owner asked for more clicks on the paid links and said pop-ups that drive them are fine. The return nudge (earlier today) only
reaches visitors who clicked a store; most product-page readers click nothing. `components/LeaveNudge.tsx` (`lib/leave-nudge.ts`) shows
the page's OWN eBay and TCGplayer links for that product in the return nudge's small card, when a reader who clicked no buy link is
leaving: on a desktop when the pointer leaves the window through the top after 8 s on the page, on a phone after 35 s of reading with a
scroll. Never on load, never after any buy click this session, once a session and once every three days per visitor, never Amazon,
never a price or "best" claim, never a modal (a `role=status` card with a close button and an "Ad" label, gone after 25 s), yields
to dialogs, the rating card and the return nudge. Only on `/card/<slug>` and only when the page's own paid links name one product (ad
units that show other products are ignored).

- A/B: half the visitors never see it (localStorage `ln-arm`). `leave_eligible` {arm, trigger} fires in both arms, `leave_shown`
  and `leave_click` in the "on" arm, every `buy_click` carries `leave_arm`, and its links say `from=<placement>_leave`. Lift = paid
  buy clicks per eligible visitor, on against off; read after two weeks (2 Dec). Keep it if paid clicks rise and total buy clicks do
  not fall; otherwise remove it.
- Rollback: remove `<LeaveNudge />` from `app/layout.tsx`.
- Not on DexCompare or MTG Compare until their quick-view A/B test ends (3 Dec), so the two tests never mix.

## 2026-11-18: the Amazon button is amber, and the quick view's "See full page" is a real button (owner)

The owner wants the Amazon row to stand apart from the site's own buy button and from eBay's and TCGplayer's. `.btn-amazon` (`globals.css`) is now a calm amber
(`#F5A524`, hover `#DC8A0B`, 1px border `#B7791F`) with near-black words (`#111`, about 9:1), written with no theme variant so it reads the same in the light
and the dark theme (`tests/contrast.test.ts` measures it where it lists the class). `PriceTable` draws the Amazon row's link with it (the row on the product page
and in the quick view are the same component). The row's order, price, "Ad" pill, `rel="sponsored nofollow noopener"`, tracking and link are unchanged, and the
Cheapest logic is untouched. This reverses the old comment that kept Amazon's own orange off the site; the owner's call, but the Associates agreement's wording on
styling that could pass for Amazon's own is worth a look if Amazon objects. No priced row means no Amazon row (2026-11-12), so there is no unpriced search row to colour.

The quick view's bottom link ("See price history and details", a ghost button) became a full-width `btn-primary` at least 48px tall, "See full page: price history and
details", still pinned under the scrolling prices so it is on screen on a phone without scrolling. One button only. `tests/amazon-button-amber.test.ts` pins both.

## 2026-11-18: the amber of the Amazon button is not Amazon's own orange

The first cut used #FFA41C, which is Amazon's brand orange. Amazon's Associates agreement bars styling that could pass for Amazon, so the button is now a distinct, calmer amber (#F5A524, hover #DC8A0B, border #B7791F, dark text #111): still clearly different from the site's normal buy button, not Amazon's colour.
## 2026-11-18: The cart A/B: half of the visitors see no cart

Owner, 2026-11-18: "I never intended the cart to be like a very big feature … we cannot sustain click leaks." On OP Compare the
share of visitors who clicked a buy link fell from 20-31% (1-13 Nov) to 11-12% on 14-15 Nov, the day a labelled "Add to cart" went
on every price row, with visitors flat (Vercel); OP Compare and Compare Empire have the cart switched off. Here it is a test:
`cartArm()` in `lib/cart-list.ts` puts each visitor in localStorage `cart-arm` "on" or "off" (50/50; storage that fails is "off").
The "off" arm sees no Add to cart button, and no header or bottom-nav cart unless its cart already holds lines. Every `buy_click`
carries `cart_arm`. Verdict 2 Dec: buy clickers and paid buy clicks per arm (the arms are equal halves of visitors). Keep the cart
only if the "on" arm is not lower; otherwise `cartArm()` returns "off" for everyone. Not on Dex or MTG Compare (their quick-view
A/B runs to 3 Dec).

## 2026-11-18: a return-visit beacon, so retention has a number on every site

Owner, 2026-11-18: "we want new visitors and we want to retain those visitors". Vercel Web Analytics cannot tell a returning
visitor from a new one, and Google Analytics runs on only four of the sites (consent-gated on two). `lib/return-visit.ts` keeps one
small localStorage record (`rv`: first day, last day, visit days) and `components/ReturnBeacon.tsx` (root layout, renders nothing)
sends ONE `return_visit` event the first time a returning visitor opens the site on a new day. New visitors send nothing (Vercel's
visitor count is the denominator), so it costs at most one event per returning visitor per day. Properties are buckets only:
`k` = "<days since last visit>:<page type>", `age` = days since first visit, `n` = visit days, `via` (direct, search, email, share,
social, ai, other), plus the arm of each live 50/50 test (`rn`, `ln`, `share`, `cart`, `watch`) so every retention lever reads its
return rate on against off. No id, date or URL leaves the browser. The identical file is in every Compare repo; read weekly by the
retention thread. Rollback: remove `<ReturnBeacon />` from the layout.

## 2026-11-18: "Watch this price" under the price, as a 50/50 test (retention lever 1)

Retention baseline (18 Nov): a RiftCompare account comes back about ten times as often as a plain visitor, yet the sister sites held 5
price alerts between them, because the alert ask was a quiet link under the long price table. `components/WatchPrice.tsx` adds a
one-tap "Watch this price · free email when it drops" button in the product header, beside "I own this", that opens the same shared
alert form in place (RiftCompare's alert service, double opt-in, weekly email still an unticked box). Half of the visitors (localStorage
`watch-arm` = off) see no button; the link under the table stays for everyone. The form now sends a window event `price-alert`
{kind: open | saved, from: top | page}; the page turns it into `watch_open` / `watch_signup` {arm, from}, and `watch_eligible` {arm}
counts once a visitor-day on a product page. Read ~2 Dec: alerts per eligible visitor and the `return_visit` rate of each arm. A button
in the page, never a pop-up. Rollback: remove `<WatchPrice />` from the card page.

## 2026-11-18: "Since your last visit": cheaper since you looked, as a 50/50 test (retention lever 2)

The owner (2026-11-18): "we want new visitors and we want to retain those visitors". A returning visitor had nothing new
to come back to. Now a product page notes, in the visitor's own browser, the lowest prices it showed (`SeenPrice`,
localStorage `seen-prices`, at most 30 products). On the first page of a LATER day, `SinceLastVisit` reads this site's
static `/alert-feed.json` (the same prices the alert service reads, rebuilt every release, CDN-cached) and, when a product
they looked at is now at least 1% cheaper in their market, shows ONE in-page line under the header naming up to three of
them with the old and new price (`lib/since-visit.ts`). Then the noted prices move to today's, so a drop is told once.

- Never a first visit (nothing is noted yet), never a pop-up or overlay, worked out at most once a day, one ✕ hides it.
  It is personal and conditional, so it does not count as the shell's one promo strip.
- 50/50 `since-arm`, assigned only when there is a drop to show: `since_eligible` {arm, drops} in both arms,
  `since_shown` and `since_click` {pos} in the "on" arm. `return_visit` now carries `since` (lib/return-visit.ts
  `ARM_KEYS`, the same file everywhere), so the lever reads its return rate on against off. Read about 2 Dec.
- Nothing leaves the browser but the arm and counts. Same-site paths only; prices are the feed's (store and TCGplayer
  in-stock lows, never eBay, never converted).

## More shareable artefacts: collection card, movers and Deal Finder images (owner, 2026-11-18)

Owner: "we need more shareable artefacts". Ranked by effort against likely shares, cheapest first:

- **Collection value card.** My collection's "Share my collection" now draws a 1200×630 picture of the visitor's own
  totals (value, change since added, item count, three most valuable items, "Track yours free at <host>") in the
  browser with a canvas (`components/vault/collection-card.ts`) and hands it to the share sheet as a file; where files
  can't be shared it saves the PNG and copies the link. No server, no function, no Vercel image cost, nothing sent to
  us. The link is `/?utm_source=share&utm_medium=collection&utm_campaign=collection-card`. Counted as `share
  {kind: collection, how: image|text|saved|copy}` in Vercel, only once it really went out.
- **Movers and Deal Finder share images.** `/movers` (this week's five risers and three fallers) and
  `/tools/deal-finder` (today's five biggest US store deals, the same `shareDeals` rows as the share-for-a-deal card:
  never eBay, Amazon or TCGplayer) get their own `opengraph-image.tsx`, one image each, text only (2026-11-08 cost
  cap), a day in the CDN. Their pages drop the `images` key so the sibling file is the preview. `/movers` gets a share
  button (medium `movers`).
- Already here and not rebuilt: the embeddable widgets (`/embed`), shared lists (`encodeList`) and the card page's
  price-history panel.

## 2026-11-18: "Which tool should we build here next?" (a demand test, not a promise)

Owner, 18 Nov: the other sites lack RiftCompare's tools, which is why Premium only sells there (Rift's sign-ups: 24 from the tool
gate, 11 tool previews, 9 deck tools, 6 set tracker of 152 in 30 days). Before copying any tool here, `components/ToolInterest.tsx`
asks product-page readers, low on the page and never beside a price, a buy button or in the quick view, which of four RiftCompare
tools they want: Best Basket, box value, pull tracker, set tracker. One tap per visitor (localStorage) sends `tool_interest
{tool, page}`; nothing else is stored or sent. Read about 4 Dec: a tool is built on a site only if it clears 5 taps per 1,000
product viewers. Remove the box once read. Plan: /mnt/project-files/strategy/premium-network-plan-2026-11-18.html (project files).

## The weekly Hot 100 at /hot-100 — 2026-11-18

**What.** A new page, `/hot-100`, with its own share image: every product whose TCGplayer market price rose over the
last seven days, biggest rise first, up to 100, each with its place on last week's chart (▲ / ▼ / NEW). Built only from
the committed daily price history (`lib/hot100.ts`, pure; `hotInputs()` in `lib/data.ts` reads one history file per
set). A week with fewer real risers (products worth $3 or more) is the Hot 37, never padded with flat or falling ones,
the same honesty rule as RiftCompare's Hot 40. `/movers` links to it.

**Why.** Owner, 2026-11-18: RiftCompare's Hot chart works on Reddit as a plain link and title and brings real visits;
every site should have one stable URL to post once a week (tagged `utm_source=reddit&utm_medium=social&utm_campaign=hot100-<site>-<date>`).
Rides the next import release; the chart fills once a week of history exists (from 21 Nov 2026). `tests/hot100.test.ts`.

## Titles in each game's own words, and set pages as landing pages (Cardmarket's playbook) — 2026-11-18

**What.** Every set and sealed product title now leads with its game as its players type it, from `GameLine.seo` in
`site.config.ts` (`lib/game-seo.ts`): "One Piece The Dominance of God (OP18) Booster Box & Sealed Prices",
"Pokémon Delta Reign Booster Box & ETB Prices", "Gundam Stardust Trails Booster Box (GD06) Price". Before, every one
said `SITE.gameShort` ("TCG ME06: Delta Reign Booster Box Price — TCG ME06: Delta Reign"), so no page named its game.
TCGplayer's code prefix leaves the name ("ME06: "), a set code is added only for games whose players search by it
(One Piece, Yu-Gi-Oh!, Gundam, Union Arena, Fusion World, Digimon, Vanguard, DBS, Shadowverse, Palworld), and
Pokémon says ETB. Set pages also get: breadcrumbs Home > game > set (product pages Home > game > set > product), the
"older/newer" and "Other sets" links kept inside the set's own game (a Pokémon set linked Magic sets before), the H1
with the game's name, and a short "About" paragraph built only from our data (`lib/set-facts.ts`: release date, the
product types we compare, the cheapest in-stock US booster box against TCGplayer's market price) with links to
`/how-we-pick-stores` and `/methodology`. Product JSON-LD `brand` is the game, not "TCG". URLs, h2s and the sitemap
are unchanged.

**Why.** Owner, 2026-11-18: apply what Cardmarket did (Semrush, "How Cardmarket wins search", July 2026). Its six
steps include metadata templated per game in the community's language, expansion pages treated as high-intent landing
pages with set-specific copy beside the listings, and verifiable trust signals. We write no copy we cannot source: no
pack counts, print runs, MSRP or card text. `tests/game-seo.test.ts`. Read the effect with real Search Console numbers
on 2 Dec and 16 Dec 2026 (set and product pages, non-branded queries).

## 2026-11-18: The dock A/B: the phone ad dock stays up above the bottom nav for half of the visitors

Owner, 2026-11-18: "right above the nav bar, we should have those ads show up … very, very visible for mobile phone users." Since
the phone bottom nav went on (18 Nov) the eBay/TCGplayer dock (`AdDock.tsx`) yielded to it: one bar at a time, the dock only while
scrolling down. `dockArm()` in `lib/dock-arm.ts` puts each visitor in localStorage `dock-arm` "on" or "off" (50/50; storage that
fails is "off"). "On": the dock no longer yields to `html[data-bottomnav]`; it is lifted 57px (the nav's height) with `translate`
while the nav shows, so both bars are visible and neither covers the other (dock 64px + nav 57px, about 15% of a phone screen,
under Better Ads' 30% line). Every other dock rule stands: never on the first screen or a product page, yields to other ad units,
the footer, dialogs and the keyboard, ✕ for the visit, labelled Ad, rel sponsored. "Off": unchanged. Every `buy_click` carries
`dock_arm`. Verdict 2 Dec: buy clickers and paid buy clicks per arm. EPN's Network Agreement (Exhibit A §1.4, §2.5) puts any
promotional method it does not expressly permit under prior written approval; the dock has run since 2026-11-06, this changes only
when it shows. Not on Dex or MTG Compare (their phone A/B runs to 3 Dec).

## 2026-11-18: Back in stock alerts on sold-out products, free for everyone

**Owner** (retention programme, decision card 18 Nov): back-in-stock alerts are free for everyone. RiftCompare's
`/api/sister-alerts` takes `kind: "restock"` with an email alone, under the same double opt-in (TCGEmpire #512).

**What.** `PriceAlertForm` is now two forms behind one name: with an in-stock store price in the visitor's region it is the
price-drop alert as before; with none it is "Email me when it's back in stock" (one email field, `kind: "restock"`). Both are
inline, never a pop-up, on the card page and the top watch strip. A sold-out product is not in `/alert-feed.json`; the service
holds a restock watch while its item is missing and fires on the first in-stock price. Event `restock_signup` {member, region},
read per site with the retention programme on 2 Dec. `tests/restock-alert.test.ts`.

## 2026-11-18: A plain store that is cheapest gets a plain "Best price" tag, not the loud green

Owner, 2026-11-18. The row carrying the Best price badge was drawn loudly (green tint, green chip, the table's one filled button), and
when that row was a store that pays us nothing it pulled clicks away from our paid rows (eBay, TCGplayer, Amazon, Awin / Impact
stores). `bestTreatment()` in `lib/best-price.ts`: when the cheapest row is paid (`isPaidRow`: eBay, TCGplayer, Amazon, or a store whose
link goes through one of our programmes) everything stays exactly as it was; when it is a plain store, the button is the calm one (this site's table already marks no row, 2026-11-14, so there is no tag or hint here). The phone top buy block and sticky bar (`CardBuy`) and the set quick-buy list use that test for their button. Not touched: sort order, which row is cheapest, links, rel, tracking, labels, JSON-LD, feeds, alerts, deal and
price-drop badges. Measure: paid clicks per 100 buy clicks (`buy_click`) before and after. `tests/best-price.test.ts`.

## 2026-11-18: The ad-look A/B: half of the visitors see the sponsored units in their brands' colours

The owner (18 Nov): the banner ads "can look more attractive … more decorated and more highlighted so people can actually click on
them". Since 12 Nov the units have been drawn in the calm palette (ink button, no brand colours). Now half of the visitors
(`lib/ad-look.ts`, localStorage `ad-look`, 50/50, storage failure is the old look) see look "b": the inline eBay / TCGplayer block
gets its brand's stripe along the top (eBay's four colours, TCGplayer's blue), a tint, a filled brand-colour button with a slow
shine, a lift on hover and the price in the brand colour; the phone dock gets the eBay stripe and a filled button; the leave
nudge gets the stripe and a stronger shadow. Paint only (globals.css, "The ad-look A/B", under `html[data-adlook="b"]`): no size,
position, timing, label, wording or rule changes, CLS 0, every motion off under reduced motion. `<html data-adlook>` is set when
a sponsored unit mounts, and buy_click carries `ad_look`. Read on 2 Dec: paid clicks per 100 visitors, "b" against "a"; the
winner becomes the only look. Not on Dex or MTG (their phone A/B runs to 3 Dec).
## 2026-11-18 — The bottom nav is a floating pill, and closing the cart gives it back

Owner, 2026-11-18: "after you open the cart and then you close it, the little bottom navigation disappears", and the nav should be
"the little football field kind of shape … floating above the bottom a little bit" (Catchback's), with the eBay / TCGplayer ad dock
sitting on top of it.

- **The bug.** A header that mounts the cart button twice (desktop and phone copies) mounted two `CartDrawer`s. Only one draws, but both
  ran the scroll-lock effect: the second saved the first's `overflow: hidden` as "previous" and put it back on close, so the page stayed
  locked and `BottomNav` (and the ad dock) read it as an open dialog forever. Now only the drawer that draws locks scroll or checks
  live prices (`mounted` in both effects). Sites with one header button never hit it, but carry the same guard.
- **The pill.** Geometry only, colours stay the site's own: 12px from each side (at most 460px wide), rounded ends, a soft shadow, and
  `bottom: var(--bn-gap)` where `--bn-gap` is `max(8px, safe-area − 14px)`, so it floats above the home indicator without the old full
  safe-area band. `--bn-h` (54px) and `--bn-space` (height + gap) are on `:root`; the stacked ad dock, nudges and toasts sit
  `var(--bn-space)` + a small gap up, and the body's bottom padding follows it. Hidden, it slides fully off-screen (transform only, CLS 0).
- **Measured** (local build, dock stacked): Pixel 7 412×915 nav + dock take 129px (14.1%); iPhone 15 393×852 with a 34px safe area
  143px (16.8%); iPhone SE 375×667 129px (19.3%); the old flush bar took about the same plus the full safe area.

## 2026-11-18: Products of games a sister still ranks for are noindex here (core update)

The November 2026 core update (from 10 Nov) took YGO, Gundam and Cyberpunk Compare out of Google, while MTG Compare,
DexCompare, OP Compare, Lorcana Compare and Rift Compare kept ranking. This site lists the same sealed products as those
sisters, from the sisters' own store rows, so for about 2,800 of its 4,535 products two of our hosts would compete for one
search. Product pages of `mtg`, `pkm`, `pkj`, `op`, `lor` and `rb` (`SISTER_RANKED_LINES`, `lib/indexing.ts`) are live for
visitors, noindex and out of the sitemap; every other game, including the four whose sister already lost Google, keeps the
normal index gate. Set and game hubs are unchanged. Reverse a line only if its sister stops ranking or folds into this site.
John Mueller (Bluesky, 10 Nov) on "crawled, currently not indexed": making a site smaller does not by itself raise its
quality, so this is about not competing with ourselves, not a quality fix.


## 2026-11-19: Core-update quality pass: no ad banners under the hero, fewer links, no leave pop-up, who runs the site

Google's November 2026 core update took several sister sites to near-zero impressions (a quality verdict, not a technical
fault). Owner, 2026-11-19: "all the ads that can negatively impact our indexing let's remove and have more strategically
placed ads".

- **Ads**: the `AdBanners` row under each hero (2026-11-14) is gone from the home, card, set and sealed pages, where the
  page's one native ad block already sits below the content; on a game page the banners move to the foot of the page. On
  a card page that removes the banner row that sat between the buy block and the price table. The exit "leave nudge"
  pop-up is off (`LEAVE_NUDGE_ON = false`). Cross-site cluster tiles are off (`CROSS_SITE_BLOCKS = false`).
- **Fewer links**: the header shows three tools and the tools page, no creators or feedback link, and 6 sets (was 12). The
  footer drops seasonal sale pages, the report, widgets, pre-orders, collection, stores, creators, feedback and
  list-your-store (~27 → ~14).
- **Who runs it**: the about page names the co-founders (Bill and George), says AI tools help build the site and draft
  guides while prices are read by a program, and gives the running cost (about A$790 a month for the group, our books to
  15 Nov 2026). It drops the YGO wording ("structure deck") it was copied with.

## 2026-11-19: The dock A/B ends: the phone ad strip sits above the bottom nav for everyone (owner)

The owner, 2026-11-19: "I want it for all the sites, so people have like an ad on their phone right there." The dock A/B of
2026-11-18 (`lib/dock-arm.ts`) ends early with its "on" arm for every visitor: the eBay (and, where the site has it, TCGplayer) dock is
stacked just above the phone bottom nav whenever it shows, instead of taking turns with the nav. Its own rules are unchanged: after a
scroll, labelled "Ad", ✕ for the visit, never Amazon. `dock_arm` on buy_click now always reads "on".

## 2026-11-19: No ads on Premium, account, collection, watches, sign-in or giveaway pages

A production check on a sister site found /premium opening on phones under ad blocks. Premium promises no ads, and these are
conversion and utility pages, so the layout's ad units (DockAds) stand down on them (`lib/ad-free-paths.ts`,
`AdRouteGate.tsx`, `tests/ad-free-paths.test.ts`).

## 2026-11-19: launch week leads the home shelf (merchandising)

The home shelf's in-demand boxes (`lib/popular-boxes.ts`) multiply the import's score by visitors' page views. A box released
today has no views, so on 20 Nov The Dominance of God, Icons 2027 and Diva Fever (import scores 84 to 92) would have ranked under
Homeworlds (387, from 44 views) and missed the shelf on their own release day. Now a box in its first seven days is ranked by the
import's signals alone and up to three lead the shelf, one a game (`pickLaunches`, `withLaunches`); the demand ranking fills the
rest, no game more than twice. Pre-orders stay in the pre-order tab. Measured as experiment E2 on the merch board: buy clicks per
home visitor, baseline 11-18 Nov, read 26 Nov.
## 2026-11-19 — A calmer home page on a phone

Owner, 2026-11-19: "way too much going on in the mobile version of the home page" (KaeYoung first; the same pass on every
site). Below sm: the hero's region row shows from sm up (the header's region button does the job); each tab of the home
shelf is ONE sideways row (`.home-shelf .pc-grid` in globals.css) instead of a grid four rows deep; "Pick your game" is two
columns of game names with their product counts, and each game's product-type chips and newest set show from sm up (the
game's own page lists every type). Measured on a 390px phone: 9,311 px tall before, 5,053 after. Layout only: URLs,
titles, headings, links, metadata and JSON-LD are the same, the server HTML is the same at every width, and the desktop
page is unchanged. Before adding a block to the phone home page, say what it replaces.

## 2026-11-19: Search-engine-first audit after the November 2026 core update

Google's core-update guidance asks whether a page exists mainly to help people or mainly to catch a search, and names
content "spread across a large network of sites" and re-dating pages to look fresh as warning signs. What changed here:

- **Seasonal sale pages.** The same template put Boxing Day, January sales and Lunar New Year (and Valentine's Day where
  a site has it) pages on every Compare site, indexed all year, each listing the same deals as the Black Friday page.
  `saleIndexable` in `lib/sale-seasons.ts`: Lunar New Year and Valentine's Day pages are never indexed, Boxing Day and
  January sales only from three weeks before the homepage links them until a week after they end; out of season they are
  noindex, follow and out of the sitemap (`withoutOffSeasonSales`). The URLs stay live all year (URL freeze).
- **Honest sitemap dates.** About, methodology, store-listing and similar prose pages no longer carry a lastmod of the
  latest import: their words do not change with prices.

Black Friday and Cyber Monday pages are unchanged (in season). Judge the effect on 1 to 8 Dec against 3 to 9 Nov.

## 2026-11-19 — Accounts: collection needs sign-in, Sign in and Premium visible, Google and Discord, Collection tab

Owner, 19 Nov: "you can only use my collection if you are signed in and the login/signup button should be visible for all sites",
"premium should also be visible", Collection in place of Menu on the phone bar, and Google and Discord sign-in on every site for
retention. `/collection` asks a signed-out visitor to sign in ("I own this" too); the header's account link shows at every width
("Sign in" in words from 400px), a gold Premium pill from md, and the phone menu opens with Sign in and Premium; the phone bar's last
tab is Collection (the header keeps the menu button). `/account` has "Continue with Google" and "Continue with Discord"
(`OAuthButtons.tsx`, through RiftCompare's sister sign-in and its existing apps: nothing to set up), and signed in it is an account
hub. `/account/verify` lands where the visitor was headed. Browser-only: every page keeps one CDN copy. Same as MTG, Dex and YGO.

## 2026-11-19: eBay's button is eBay blue again

Owner (2026-11-19): "our eBay clicks have still stagnated. We're nowhere near our all-time high … I really need to increase it."
Vercel buy clicks: eBay about 240 a day across the network before 12 Nov, about 170 since; 5-11 Nov vs 12-18 Nov DexCompare 706 to
489, RiftCompare 298 to 165, OP Compare 153 to 61. The fall starts on 12 Nov, when the calm palette made eBay's button ink;
TCGplayer, which kept its own blue button, rose (DexCompare 545 to 779, MTG Compare 160 to 363). So eBay's buttons wear eBay's own
blue again (#3665f3, white ink, fixed in both themes) on every site; nothing else about the rows changes (no outline, tint, order or
label), and the cheapest row keeps its mark. RiftCompare and OP Compare had started a 50/50 the same morning; it ended for
everyone. Read: eBay buy clicks per 100 visitors, the week after release vs 12-18 Nov.

## 2026-11-19: The price history chart draws two lines, OP Compare's look (owner)

Owner: "I really really like opcompare's price history where you have the tcgplayer market price as well as the cheapest
price locally. Can we pls copy it across all our tcg websites?" `components/PriceHistory.tsx` replaces `PriceChart.tsx` on
the product page and in the quick view: the cheapest in-stock store price in the visitor's market (solid red, from
`data/store-lows`, its own currency, a day with nothing in stock is a gap) against TCGplayer's market price (dashed gold,
`data/history`, converted at the import's rate outside the US and labelled "converted"), Now / Low / High / change from the
store line, 7D / 30D / 90D / All tabs only where the history is longer, and a crosshair tooltip with both lines. Either line
draws alone where the other has no data. The axis ends on the import's own day (`historyThrough()`), never the clock, so
the server and browser draw the same chart. Pure maths in `lib/history-chart.ts`, pinned by `tests/history-chart.test.ts`.
## 2026-11-19 — A graded-slab variant never prices the raw card

A store can sell a raw card and its slabs as variants of ONE Shopify product ("Near Mint" A$344, "Graded - Beckett
9.5" US$115, found on OP Compare). `pickVariant` took the cheapest in-stock variant, so the slab priced the card.
It now drops every variant `isGradedVariant` reads as a slab (PSA, BGS, CGC, SGC, Beckett, TAG/AGS grades, Graded,
Slab, ACE grading) before choosing; a product with only slabs gives no offer. `tests/graded-variant.test.ts`.

## 2026-11-19 — Premium keeps what it promises: a year of collection history and a spreadsheet export

Premium's copy promised "a year of value history and a spreadsheet export" for the collection; YGO Compare and MTG Compare had them
and this site did not. Ported from YGO Compare: a member's collection keeps 365 days of daily value (`MEMBER_HISTORY_DAYS`, free: 60),
drawn as a line under each market's total, and "Export to spreadsheet (CSV)" (`collectionCsv`, formula-safe cells). Everything still
lives in the visitor's browser; nothing is sent anywhere.

## 2026-11-19: Sign in is a filled button at every width, and the sign-in flow never names another site

Owner, 2026-11-19: "there should be a login or sign up button, very visible for new … or non-logged in users … I don't want them to
redirect. I don't want the [RiftCompare] logo to appear on any of the site signups."

- Signed out, the header's account link is a filled button in the site's own colour reading "Sign in" from 340px wide (the icon alone
  below that). Every header was measured at 360, 390, 430, 768, 1024, 1280, 1440 and 1536px: the button is on screen with no
  sideways scroll at each. Where the row was full, other items stepped aside (the Premium pill, a sections row or a sponsored link
  move to a wider breakpoint; the menu carries them), never Sign in.
- Copy on the sign-in, account, Premium, watches, alert and privacy pages says "our shared alert service" and "all our price
  comparison sites", never the name of the site that runs the shared account service.
- `next.config.js` rewrites `/account-service/alerts/(confirm|manage|unsubscribe)` and `/account-service/oauth/(google|discord)[/callback]`
  to the shared service, so alert emails and (once the owner registers the redirect addresses) Google and Discord sign-in keep the
  visitor on this site's own address. A rewrite is not a redirect: the address bar never changes.
## Amazon API allowance: mostly ScentCompare, card sites at zero (owner, 2026-11-19)

Amazon's Creators API limit is per Associates account (one a country), shared by every site on it: 1 call a second and
8,640 a day for the first 30 days (the US until about 8 Dec 2026), then 1 a day per US$0.05 of shipped revenue the API
referred in 30 days. The owner: "be very frugal", no Amazon calls for card sites ("people aren't buying on Amazon"), and
half or more for ScentCompare, the best performer. Each site's daily calls (environment variables can only lower them):

| Site | searchItems a day (US / other) | getItems at build (US / other) |
|---|---|---|
| ScentCompare | 2,000 / 600 | 200 / 100 |
| KaeYoung | 600 / 300 | 100 / 60 |
| DexCompare | 300 | 30 |
| MTG Compare, WargameCompare | 100 | 20 |
| Compare Empire | 100 | 30 |
| CamCompare | 150 (AU only) | about 30 (AU only) |
| Rift, OP, YGO, Lorcana, Cyberpunk, Gundam (and kits), Bandai, SportsCardCompare, TCG Prices, Figure, Motor | 0 | 0 |

US total at most about 3,600 calls a day (ScentCompare about 61%, ScentCompare and KaeYoung together about 81%), against
8,640 until about 8 Dec 2026 and a revenue-based limit after it (1 a day per US$0.05 of API-referred shipped revenue).

Here both defaults are 0: no search, no price call; the Amazon row keeps its tagged search link. Raising them is the owner's call.

## 2026-11-19: [urgent] needs eight hours too: a network ceiling of 57 builds a day

[urgent] in a commit subject used to skip the 12-hour gap altogether. On 17 and 18 Nov the network built production 94
and 137 times a day, almost all of them [urgent] (about eight builds per site per day), and Vercel reached $10.27 a day
against the $6 cap: every build rewrites the ISR cache and burns build CPU. `scripts/vercel-ignore-build.sh` now builds an
[urgent] commit only when production last built at least `URGENT_MIN_GAP_HOURS` (8) ago; a plain [deploy] still waits 12.
So one site builds at most three times a day, and the 19 production projects at most 57 a day (normally about 25).
Batch urgent changes into one release instead of one per merge. Pinned by `tests/deploy-gap.test.ts`. The same change
went to every Compare site's gate.
## 2026-11-19 — Sealed Sniper: verified restocks and price drops on Discord (boardroom move N2)

The Compare Empire Discord gets a cross-game "Sealed Sniper" channel: after each import (twice a day), `scripts/sniper.ts`
posts restocks (an offer sold out in the last commit and in stock now, `lib/restocks.ts`) and price drops (a market's cheapest
in-stock store price down 10%+ and US$5-equivalent on the last commit) of sealed Pokémon (English), One Piece, Riftbound, Magic
and Lorcana. It replaces `scripts/restocks-discord.ts`, which never had its secret. Rules (`lib/sniper.ts`,
`tests/sniper.test.ts`):

- Headline types only (booster boxes, ETBs, bundles, cases, collections, troves, Commander decks), TCGplayer market US$25+, and
  the price inside a band of that market (restock 60-125%, drop 60-105%, converted for the check only, never shown converted):
  a price far under market is a wrong match, far over is a scalper, neither is news.
- **No false in-stock posts.** Each candidate is asked once at the store itself, Shopify's `/products/<handle>.js`, through
  `lib/import/polite-http.ts` (robots.txt, our User-Agent, a 401/403/429 or challenge stops that store), right before it is
  posted: the variant must be available and no dearer than our price (2% slack); the post shows the store's live price. No
  answer, a non-Shopify store or robots.txt saying no means no post. The post carries the check's time as a Discord timestamp
  (`<t:…:R>`), which every reader sees as "N minutes ago", counting up, plus "the store's page has the final word".
  This is the one exception to "no store is visited for a game a sister covers": at most 8 posts and about 50 requests a run,
  one per product page, never a crawl.
- At most 8 posts a run (5 restocks when drops are waiting), one per product, restocks first, most viewed first. A store's
  restock of a product once per 3 days; a market's drop once per 7 days unless a further 5% lower (`data/state/sniper.json`).
- Links: our product page, `utm_source=discord&utm_medium=social&utm_campaign=sealed-sniper`; its eBay and TCGplayer rows carry
  the affiliate tags. No eBay API call, no eBay price, no mentions (`allowed_mentions` empty).
- A no-op until the repository secret `DISCORD_SNIPER_WEBHOOK` exists. The ops monitor's "Sealed Sniper" check is amber when no
  run has written state for 30 hours, or a run had 5+ candidates and posted none (the store check failing everywhere).
- Read on 14 Dec: Discord members (pass: 150) and visits with `utm_campaign=sealed-sniper`.

## 2026-11-20: the probe also reads each store's pre-order shelf (Job A)

Thin launches on the games we crawl ourselves (DBS Masters Chromatic Ascension, 27 Nov: 1 store; Weiss Schwarz and
Vanguard Persona 30th, Dec: 0) showed that many shops file a new set under a game-less "Pre-orders" or "New releases"
collection before the game's own collection, which the probe never read (Rift Compare fixed the same, TCGEmpire #523).
The weekly probe now names ONE such shelf per store (`choosePreorderShelf`: the largest collection whose handle or title
says pre-order, upcoming, new release or coming soon and names no game by any line's `crawl` or `ownCrawl` words; never
singles, never empty), only at a store already read for at least one game, and gives it to exactly those games
(`CrawlStore.preorder`). The crawl reads it once, after the games' own collections: a listing only there carries those
games, one a game's collection also gave keeps that collection's games, so no listing's game set grows where it was
already read. Every listing still goes through pickId / pickByTitle / pickByAi unchanged: a shelf listing of a game the
store is not read for is refused as before. Cost: one more collection a store at most, (8 + 1) × 4 pages + robots +
currency = 39 under the per-store cap of 40; the 19 Nov crawl used 7,068 of 12,000 requests.

## 2026-11-20: A "Join the Discord" box with a reason, linking the family's one hub

The owner asked why the Discord had 9 members after five months: the only link anywhere went (from RiftCompare's menu) to
a server the owner does not run, with two empty channels and no reason to join. The family now has ONE hub, the owner's
server "TCG Deals & Restocks" (the sealed restock and price-drop feeds on top, a channel per game). This site links its
own never-expiring invite code, so the server's Invites list counts the members each site brings with no tracking of
ours. `DiscordCta` ("Restock and price-drop alerts, free on Discord") sits under the price table on the product page and
in the footer: never above a price, never a pop-up. `tests/discord-cta.test.ts`.


## 2026-11-20: The Hot 100 share image shows rises AND drops (owner)

A Reddit reply to a Hot 100 link post asked for "the biggest drops. I just want to rip and play"; the owner: every snapshot
thumbnail is half biggest rises, half biggest drops. `hotDrops` in `lib/hot100.ts` is the chart's rule the other way (the same
seven days and $3 floor, biggest fall first, from the same history); the share image draws the week's top rises beside its top
drops, and `/hot-100` lists up to 20 drops under the chart. Nothing new is read. `tests/hot100.test.ts`.

## 2026-11-20: A Santa hat on the logo and lights under the header

**Owner, 2026-11-20:** "change the logo for all of our websites so that it's Christmas themed now. Put a Santa hat on top
of the logos … and add some decorations here and there, like some Christmas lights … and yeah, Santa Claus." The owner
asked for hats and lights by name, so they come back after the 2026-11-08 tone-down, kept to the header.

- The logo mark wears a Santa hat (class `xmas-cap` on its wrapper), a string of lights hangs under the sticky header
  (`xmas-garland`), and the home page's gift-guide line, where there is one, gets a small Santa. All of it is the
  `xmas-logo` block in `globals.css`, the same block on every Compare site (RiftCompare's DECISIONS has the history).
- CSS only: three inline SVG data URIs (~2.5 KB of stylesheet), no request, no script, no animation. Every piece is
  `position: absolute` and `pointer-events: none`: no layout shift, no tap caught, nothing in the server HTML changes
  but two class names, so titles, metadata and structured data are untouched. Favicons and share images are unchanged.
- Off switch: `CHRISTMAS_FESTIVE_LAYER` (`lib/season.ts`, the `data-festive` attribute on `<html>`); the Christmas window
  also ends it on 27 December by itself. Remove after New Year: delete the block and the two classes.
- Off switch: `CHRISTMAS_FESTIVE_LAYER` (`lib/season.ts`, the `data-festive` attribute on `<html>`); the Christmas window
  also ends it on 27 December by itself. Remove after New Year: delete the block and the two classes.

## The Hot 100 sells, not just ranks (2026-11-20)

Reddit link posts land on `/hot-100`, and those visitors almost never clicked buy (13–19 Nov, across the network: Rift's
Reddit visitors 0.7%, MTG's 2.9%, MTG's Hot 100 0 of 732, against 12–23% from Google; the buy-clicks boardroom, move 2).
The page now has a "Shop the top risers" strip in the first screen (the top three, `SealedQuickBuy` with
`from=hot_quickbuy`), and every row carries the cheapest in-stock price in the visitor's market and a Buy button
(`HotBuy.tsx`) that opens the quick view, whose table puts eBay and TCGplayer first. Both read only `summaryOf(id).best`,
already in memory for the page: no new data read, no fetch, the page's day-long cache unchanged. Read on 27 Nov and
4 Dec as buy clickers among visitors with a reddit.com referrer; the target is 8% or more.

## One-tap price and restock alerts for anyone signed in (2026-11-20)

As MTG Compare (2026-11-19; boardroom: one-tap restock and price-drop alerts, free for all, alerts stay free). Signed in with any
account (free or Premium), the card page's alert (`components/PriceAlert.tsx`) is one button: "Alert me under <10% below today's
lowest in-stock price in the visitor's market>", with "Pick my price" beside it, or, sold out there, "Tell me when it's back in
stock". The account's token names the address (no email field; no confirmation when the address is verified). Signed out, the
ordinary form, unchanged; the server HTML is that form. Nothing saves or opens by itself.

## 2026-11-20 — buy_click stays at 16 properties or fewer

Vercel Web Analytics silently drops a custom event with more than 16 properties (measured on riftcompare.com on 20 Nov: 9 to 16
arrived, 17 to 19 never did). TCG Prices' buy_click carries exactly 16 and buy_click_geo 9, so none was lost; `tests/vercel-props.test.ts`
now fails if either passes 16. A new key replaces one or folds into an existing key.

## 2026-11-20: The Spread, a monthly sealed price report at /the-spread/<yyyy-mm> (code red boardroom, Data Editor)

The open data (/data) earns links only if someone writes about it; journalists and forums cite a dated report with a headline
number, not a CSV. The Spread is that report: one frozen edition a month (`lib/spread.ts`, `lib/spread-store.ts`,
`scripts/spread-edition.ts`, `data/spread/<id>.json`, `tests/spread.test.ts`), goal earned referring domains.
- **The headline is the spread itself:** for products 3+ stores have in stock, the median gap between the cheapest store and the
  middle store (and the dearest), per market, game and product type. It needs no history, so it is solid from edition 1. Price
  moves over the period and sale days (Black Friday 27 Nov 2026 and Cyber Monday 30 Nov, each against the same weekday a week
  before) are matched-pair: each product's cheapest in-stock store price (data/store-lows) on both days, as shares that got
  cheaper or dearer, because most products do not move in a fortnight and a median change of 0.0% says nothing.
- **Same rules as the open data:** stores only (never a TCGplayer, eBay or Amazon price or a TCGplayer-derived figure, per the
  18 Nov council), never converted, never estimated, groups under 10 products hidden.
- **Frozen.** The script refuses to overwrite an edition; the pages read only the edition file. Corrections are dated lines on
  the page. "Why prices moved" notes are written by the editor after checking (store sell-outs move the cheapest price too), never
  generated. A mover the editor finds is a mismatch is removed by hand and the removal said in the notes.
- Cut by hand after the release holding the period's last day, merged without `[deploy]`/`[urgent]`, riding the next data release.
  /the-spread 404s until the first edition exists, and only editions go in the sitemap.
## 2026-11-20: A "keep up" strip on the Hot 100 (owned audience)

The Hot 100 is where Reddit posts land, and Reddit visitors rarely buy (about 2.3% click a buy button, against about 19% from
Google), and a Reddit visitor who does not buy is gone. Under the first buy cards, before the chart, the page now offers two ways
to come back: the week's biggest price drops by email (the existing weekly email on RiftCompare's shared alert service, kind
"weekly", double opt-in; this site keeps no address) and the Discord hub through this site's own invite code
(`components/KeepUpStrip.tsx`). Inline, never a pop-up, no heading, a fixed minimum height so nothing moves. It is not an A/B
test: it is on for everyone. Measured as `weekly_signup` with placement `hot-100` (an existing event, no new event name) and
the invite's uses in Discord. The email promises the week's drops, which is what the weekly email sends, not the Hot 100 chart
itself.

## 2026-11-20: Sealed Sniper posts one drop a run

Each run of the Sealed Sniper now sends ONE Discord message holding all of the run's checked posts (at most `MAX_POSTS`, 8, under Discord's 10 embeds a message), instead of one message per post. The hub's cap is at most 3 drops a day across all feeds (Owned Audience, 20 Nov): this feed runs twice a day, so it is 2 drops, and DexCompare's #pokemon-deals feed gets the third. Every link carries `utm_content=sniper-<YYYYMMDDHH>` so clicks can be read per drop. If Discord refuses the message, nothing is recorded as posted, so the next run tries those deals again.

## 2026-11-20: Fusion World listings in a shop's "Dragon Ball Super" collection

The 20 Nov crawl refused 88 Fusion World listings as "other-game" (and took only 19 Fusion World listings in all): shops file
Fusion World boxes under a plain "Dragon Ball Super" collection, which DBS Masters' crawl words claim, so the listing carried
only the DBS Masters game and its Fusion World id was refused. Reach the God (11 Dec) had 2 stores. `GameLine.alsoIn`
(`fw: ["dbs"]`): a listing read for DBS Masters whose one TCGplayer id is a Fusion World product is read again as a listing of
both games, so every `pickId` check still decides (photo and id conflicts, product type, quantity, Fusion World's matcher). It
applies only at a store BandaiCompare does not list, the same rule as the gap crawl, and a sister's own row still wins
(`addCrawlOffers`). No title placement, no extra request: the collection was already read. `meta.json` `crawl.alsoTaken`
counts it. Read after the next import: `takenByLine.fw` (baseline 19) and the "other-game: fw" refusals (baseline 88).

## 2026-11-21: the hero's five game links follow this week's hub views (merch M12)

The hero linked the first five games of `LINES` (Magic, Pokémon, One Piece, Yu-Gi-Oh!, Riftbound). In the week to 20 Nov,
`/games/star-wars-unlimited` drew 106 views (all in 7 days) while those five hubs drew 0-4 each, so the most-opened game hub was
not one tap from the home page. `lib/hero-games.ts` now moves a game whose hub has 30+ views in 7 days (`HUB_FLOOR`, so one stray
visit cannot reshuffle the hero) ahead of the fixed order, most viewed first; the rest keep `LINES` order. Still words and links only,
never a product; the home-rank off switch (`NEXT_PUBLIC_HOME_RANK=off`) restores the fixed five. Read 28 Nov: Star Wars hub views
and buy clicks per home visitor against 14-20 Nov.


## 2026-11-21: A Cyber Weekend sign-up under the real drops (owned audience)

The Black Friday and Cyber Monday pages carry one sign-up directly under the real-drops block: the weekly drops email (KeepUpStrip,
placement `black-friday`, email only because the Discord box sits lower on the page) on the sister-alert sites, a free-account
prompt on the account sites. The weekly email has its own Black Friday (27 Nov) and Cyber Monday (30 Nov) editions on RiftCompare's
service (TCGEmpire DECISIONS, same day), so a sign-up before 26 Nov gets the Black Friday one. Inline, never a pop-up; real drops only.

## 2026-11-21: an upcoming product's price band uses the stores' median when TCGplayer's pre-order market is higher

Every sister and crawled row must sit at 50% to 4x of TCGplayer's market (`OFFER_FLOOR`, `storePriceTrusted`). Before release
that "market" is a few early pre-order sales, not a price: Riftbound's Legacy Vault Bundle (29 Jan) read US$94.65 on the 20 Nov
data while Rift Compare's ten in-stock shops in six markets asked US$31-50, so 9 of the 10 were dropped and the page showed one
store against Rift Compare's ten (the Legacy Pre-Rift Kit lost 2 of 3 the same way). On the same data the floor dropped 11 of 39
in-stock Riftbound rows of upcoming products and 24 of 1,126 of released ones (those are real mismatches: a single Champion Deck
filed under its display, a Proving Grounds box at a pack's price), so the floor stays as it is for released sets.

For a product of an upcoming set only, the band is now judged against the lower of TCGplayer's market and the median of the
cheapest in-stock USD price of at least three distinct, unrefused stores (`launchReferenceCents`, `lib/import/sanity.ts`). It can
only fall, never rise above the market; one or two cheap shops cannot move it; the 4x top is then 4x the lower reference, so it
refuses more at the top, not less. Store vetting (the too-cheap median) still judges against TCGplayer's market. The import logs
how many rows the launch reference kept. Read after the next import: store rows on the Legacy Vault Bundle (baseline 1) and
Pre-Rift Kit (baseline 1), then their buy clicks.

## 2026-11-21: The Sealed Sniper posts to Telegram too

The owner asked for a Telegram channel next to the Discord hub (2026-11-21). It is t.me/tcgdealsrestocks. Its bot,
@tcgdealsrestocks_bot, is an admin there, and its key is the `TELEGRAM_BOT_TOKEN` secret, set by the owner's script. Each run
sends the same drop to both places, as ONE message each. On Telegram that is plain text from `telegramText`: Discord's
markup is removed, "checked" becomes an `HH:MM UTC` time, links are tagged `utm_source=telegram` with the drop's `utm_content`,
and the message stays under 4,096 characters. The cap is the same as Discord's (two drops a day from the sniper). A drop counts
as posted when either channel took it. Without the secret, the Telegram step is a no-op.

## 2026-11-21: The launch reference reaches the crawl's title and AI picks too

The 2026-11-21 launch reference (above) judges sister and crawl rows of an upcoming product against the stores' own median, but
only once they are offers. A crawl listing with no id is taken by its title (or an AI placement) only within 40-250% of
TCGplayer's market, and that check runs first, so on our own crawled games the pre-order "market" still refused them before the
median could be read. DBS Masters' Chromatic Ascension box (27 Nov) reads US$414.22 on TCGplayer; its two store rows ask
US$245 and US$333, and any shop asking under US$166 is refused there.

`takeCrawl` now holds a title or AI pick of an upcoming product that only its price band refused (`IdPick.held`), and, once every
store is read, judges it again against `launchReferenceCents` of the cheapest in-stock price of each distinct store for that
product (the held picks and the rows already taken): at least three stores, a median under the market, 40% of that median at the
bottom and still 250% of the market at the top. Every other check of the pick has already passed. Released sets, fewer than three
stores, or a median at or above the market: the refusal stands. Then the offer band applies as before. `crawl.launchTaken` in
`meta.json` counts what it kept. Read after the next import: `launchTaken`, store rows on the Chromatic Ascension box (baseline 2)
and the other upcoming crawled products, then their buy clicks.

## 2026-11-21: A Chrome buying assistant

Bill bought a Chrome Web Store developer account (2026-11-21) and asked for Chrome extensions that act as a buying
assistant and send people to our sites' buy links. `extension/` is one Manifest V3 engine, built per site from
`extension/sites/<id>.json`; TCG Prices ships first.

- **What it does:** on a TCGplayer product page it reads the TCGplayer product id from the URL and, only when
  `/extension.json` has that exact id, shows the cheapest in-stock STORE price in the visitor's market (never eBay,
  Amazon or TCGplayer itself, never converted) beside TCGplayer's market price, with one link to our product page and
  a search link to the game's sister site. The popup searches the same file; "Find the product on this page" fills the
  box from the tab title only when pressed. A right-click search. Never a title match claimed as the product.
- **Why TCGplayer pages:** our sealed product ids ARE TCGplayer's, so the match is exact, and it is where buyers
  already compare. eBay and store pages get the popup's search, not a claimed match ("a wrong match is worse than none").
- **No affiliate injection.** It changes no link on any other site and adds no affiliate code (Chrome Web Store's
  affiliate policy: disclosed, user-initiated only). It earns only through our own pages, which it links with
  `utm_source=chrome-extension` (so its traffic and buy clicks show in analytics).
- **Cost:** `/extension.json` is force-static (built with each release, ~770 KB, ~160 KB gzipped), the extension
  fetches it at most every 12 hours per browser without cookies. No function runs for it.
- **One extension per game site, not 15 copies at once.** Chrome Web Store's spam policy forbids publishing several
  extensions with duplicate functionality, and a strike is account-wide. The TCG Prices extension covers every game
  and links each product's sister site; a sister gets its own extension only where it does something the TCG Prices
  one cannot (e.g. singles on Rift or OP Compare), staggered after the first is approved.

## 2026-11-22: The extension asks for the click

Bill (2026-11-22): the first build was too passive, and should link our flagship game sites. v1.1.0: the panel leads with
"Buy at <cheapest store> · $X", then "Compare all N stores", then "See it on <the game's site>" (DexCompare, Rift Compare,
MTG Compare…), then "Check eBay listings (Ad)". The popup opens on today's deals (US: in-stock store prices 10-60% under
TCGplayer's market, 3+ stores) with a Buy button per row, and lists our TCG sites. Every buy and eBay button goes through
`/go` (host allow-list, affiliate tag where one exists, `from=ext-…` in the click log), never straight to a shop, and is
disclosed on the panel, the popup and the store listing. Still no link on another site is changed (Chrome policy).
`/extension.json` grows to ~2.1 MB (~440 KB gzipped) for the cheapest store's URL per market.
v1.0.0 failed the store's install test: `web_accessible_resources` matches must be `https://host/*`, not a path.

## 2026-11-22: Bot rules never untag a real person

The owner (22 Nov): "make sure that there are literally zero false negatives when you filter bots, and false positives are okay."
A buy link sent untagged to a real person is a lost sale; a bot sent tagged costs nothing we can see. `lib/bot-click.ts` had
untagged anything with no Accept-Language, no Sec-Fetch-Mode, or a Sec-Fetch-Site of "none" or "cross-site". Real people
send all of those: iOS before 16.4 and some in-app browsers send no Sec-Fetch-*, and a link opened from Discord, an email, a
pasted URL or a translate proxy is "none" or "cross-site". "yandex" and "baidu" also matched real browsers' UAs (YaBrowser
builds, baiduboxapp). Now `looksLikeBot` (the one thing that untags) is only an empty User-Agent or a self-named crawler or
script; the header checks moved to `suspectClick`, which at most leaves a click out of the server-side click log, never the tag.
The 10-14 Nov crawler with full browser headers will reach the networks tagged again: accepted by the owner's rule.

## 2026-11-22 — The extension names the product on a store's page only when its words decide it

Bill: "it doesn't work properly" (Good Games' Vendetta Booster Box: "No match"). v1.1.0 put the whole tab title, store name
and all, into the search box and needed 60% of its words to appear in our name; "Booster Box" is "Booster Display" on
TCGplayer, so it failed. Measured on 2,307 real page titles (MTG Compare and DexCompare store titles, Rift Compare's sealed
listings, TCG Prices' own store handles for the other 27 games, eBay and Amazon tab styles, 149 single cards) it named the
right product 59% of the time and claimed a sealed product for 31% of singles.

v1.2.0 (`extension/src/match.js`): the store's name and Amazon's and eBay's furniture are taken off; type words (box,
display, pack, case, bundle, ETB…) decide the KIND, never the name, and a kind that disagrees is never a match (a box is
never its case); the game named on the page and the language must agree; name words are weighted by how rare they are, so
"Mega Evolution Perfect Order" is Perfect Order; a barcode on the page decides outright. The popup reads the open tab's
product data, share title and heading (activeTab + scripting, only the tab it was opened on, nothing sent anywhere) and
names the product only when sure; otherwise it lists the closest. Result on the same set: 87% right first time, 98% in the
top 3, wrong claims 2% (most of those are the test labels' own errors, e.g. "Play Booster" labelled as the sleeved one),
singles 98% left alone. The feed carries each product's sealed type, set name, set code and barcode for it.

## 2026-11-22: The pre-order shelf is a card-games shelf, never another hobby's or one that leaves pre-orders out

The 22 Nov probe (the first with the pre-order shelf, #118) gave 551 stores a shelf, and about one in seven was not a
launch shelf of card games: "No pre-order", "All products excluding pre-orders", "Preorder ohne TCG" (a shelf that leaves
pre-orders out), Games Workshop, Warhammer, board games, Funko, comics, statues, model kits, LEGO and event tickets
(another hobby's, often the store's largest, so it beat the real "Pre-orders" shelf on size), and "2024 Preorders". Each
cost a store one of its 40 requests for listings no game could take. `choosePreorderShelf` now refuses those three
kinds, and ranks a shelf that names card games ("TCG Pre-orders") first, then a plain "Pre-orders" / "New releases",
then the rest (one named after an old set), size breaking ties. It only changes which one collection the probe names;
the pick rules are unchanged. `tests/crawl.test.ts` holds the real handles.

## 2026-11-22 — Sealed Sniper posts a market's first pre-order

On 22 Nov a Canadian store's Delta Reign ETB pre-order (CA$89.99, the cheapest in Canada) took 10 orders in 41 minutes,
most of them not through our tracked links: the link spread in a restock chat. The Sniper now has a third kind,
`preorder`: in a market where no tracked store listed the product on the previous commit (in stock, pre-order or sold out),
the cheapest store now taking pre-orders, inside the restock price band. It ranks above restocks, is posted once per
product and market, and is live-checked like the rest (Shopify reports a pre-order as available). A market with no
offer at all in the previous shard was not read then, so nothing there counts as "first". It is still one drop a run.

## 2026-11-23: "Share this deal with your group chat" on the product page

`components/DropShare.tsx` (ported from DexCompare) sits under the price header: the phone's share sheet, else one line copied with
the cheapest in-stock STORE price in the visitor's market (`dropText` in `lib/share.ts`: never eBay, TCGplayer or Amazon, never
converted, "Pre-order: " when that offer is one) and this page's link tagged `utm_source=share&utm_medium=drop`. A separate component,
so ShareButton's share-for-a-deal A/B test is untouched; event `share { medium: "drop" }`.

**Why.** On 22 Nov a CA$89.99 Delta Reign ETB pre-order at Cardboard Hero took ten referral orders in 41 minutes, almost none through
a click we tracked: the store link had been pasted into a restock chat. People share drops anyway; this makes the link they paste ours.
Owner, 2026-11-23: "apply all these learnings to all the other sites". Read `share` medium `drop` and `share_visit` a week after release.

## 2026-11-23: TCG Prices: a real profile page, and sign-in slides inside the one-prompt-a-visit budget

**Decision.** `/account` signed in is now a profile (`components/account/ProfileHub.tsx`): who, Free or Premium, three tiles (the
collection's value today from this browser's list and `/prices.json`, the price alerts, Premium),, a "get the most from your account" checklist, and the Premium card for a free
account. Signed out, `/account` puts the sign-in slides (`SignInSlides`, "panel") beside the form. The slides sell only the FREE
account, one true benefit each (alerts, the collection, one account for every card site): no price, no
Premium, nothing the copy rules ban. The minimal home page gets no banner. `SignInCorner` (new here; this site had no
corner card): a signed-out visitor is asked for a free account, never money; never on a visit's first page, after a scroll, closed
for 7 days, never on the account pages, never on product pages (`/card/`, where the leave-nudge test runs). It is the visit's ONE self-opening prompt
(`lib/prompt-slot.ts`): it stands down when the rating card, the return nudge or the leave nudge had the visit, and the
rating card stands down after it.
Every sign-in prompt links `/account?src=<surface>`; the sign-in sends it on, and RiftCompare stamps a new account
`sister:tcgprices:<surface>` (TCGEmpire `sisterSignupSource`). Events: `signin_prompt` {surface, step}, `signin_prompt_click`,
`signin_complete` {src, method}, `profile_view`.

**Why.** Owner, 2026-11-22: "Can we significantly uplift the profile pages and the sign in and login incentive ... especially
dexcompare and mtgcompare". In the week to 22 Nov, 118 of 125 new reachable people were RiftCompare accounts and Dex and MTG, with most of the Google traffic, added 6. Owner, 2026-11-23: "keep user experience high and not flooding them with ads and
information" (ops/product-ux/page-budget.md): hence one prompt a visit and nothing on the first page.
TCG Prices runs no giveaway, so its slides are alerts, the collection and one account. Ported from MTG Compare and DexCompare.

## 2026-11-23: Chrome extension 1.3.0: what you'd save on the page you're on, on any shop, and price drops

Owner, 23 Nov: "test out our extension and see if you can improve it significantly". Tried as a shopper, 1.2.1 never
said whether the page in front of you was a good price (it showed our cheapest store and TCGplayer's market price, and
on the Lost Origin ETB our "cheapest" was above TCGplayer's market without saying so), named one store only, and did
nothing outside TCGplayer unless the popup was opened. 1.3.0:

- **The page's own price against the cheapest store.** `extension/src/pageinfo.js` reads the price the page states
  (schema.org offers; Amazon's and eBay's own price elements), and `verdict()` (shared.js) says "Save $18.24 (8%)",
  "✓ the lowest price we track" or "about the same", only in the same currency and only when the page's price is
  40–250% of the store's (a pack's page matched to a box, or a case price, says nothing). On TCGplayer it is the
  product's own lowest listing (its JSON-LD offer whose URL carries this product id), else the market price.
- **The three cheapest stores.** The feed gains `r`: the next two cheapest stores per market as [key, cents], no URL
  (the cheapest keeps `b` with its listing link for 1.2.x; the others link to our page). The feed grows from about
  470 KB to 570 KB gzipped; with URLs it was 860 KB, so they stay out.
- **Price check on other shops, opt in.** Off by default. Turning it on asks Chrome for `https://*/*` as an OPTIONAL
  host permission, and the service worker registers the content script then (`registerContentScripts`). It speaks only
  on pages that describe a product and only when the matcher is sure, as one line in the corner ("Save $33 at Common
  Lands"), opened with a click, with "Hide on this site". Never on our own sites. Matching runs in the service worker
  against the downloaded file: nothing about the page leaves the browser.
- **Watch price.** A star on every card; the watchlist lives in `chrome.storage.local`. Each new price file is checked
  (and an `alarms` tick every 6 hours, which reuses the 12-hour cache): a 3%+ and one-unit drop under the lowest seen,
  or a return to stock, sets a green ↓ badge and, if the visitor allowed the OPTIONAL `notifications` permission, a
  notification. New permission `alarms` gives no install warning, so 1.2.x users are not asked again.
- The popup asks the service worker for search, deals and matching instead of loading the whole file each time it opens.
- `cleanTitle` no longer cuts a title at a dash followed by the product's own name ("Sword & Shield – Lost Origin Elite
  Trainer Box - DXCOLLECTION" was read as "Sword & Shield"): 2,307-title test set 86.7% → 86.8% right first time, top 3
  97.9% → 98.1%, wrong claims unchanged at 1.9%.

Tested on real pages: Common Lands, eBay, TCGplayer, Good Games (20 products, 17 named, 0 wrong, every price read),
Zone 151 (21 products, 18 named, 0 wrong). Amazon refuses automated browsers, so its selectors are untested.

## 2026-11-23: Extension 1.3.1: one honest rating ask

Owner: get people to rate it. The popup (never a page) shows one line, "Saving you money? A rating helps other collectors
find us", only after the extension has sent the visitor to buy once or shown them a saving three times, at least three
days after install. "Rate it" opens the store's reviews tab and ends the ask; "Not now" waits 30 days, twice at most. The
two counters stay in `chrome.storage.local`. No incentive, no review written for anyone, no prompt on any web page
(Chrome Web Store policy and the page budget). Uploaded only after 1.3.0 is approved, so its review isn't restarted.

## 2026-11-23: Gundam joins the gap crawl; its probe words refuse model-kit shelves

Site loop, the first import after the 22 Nov probe: the gap crawl (2026-11-18) took 117 Union Arena listings (6 on 17
Nov) and 338 Digimon (117), and products with no store fell UA 94 → 88, Fusion World 50 → 44, Digimon 32 → 30
(`scripts/coverage-report.ts`). The next thinnest sister game with indexable pages is Gundam: 23 of 82 products with no
store, store collections only at the 52 own-list shops. Gundam Compare's list is 321 shops (163 US); 293 US shops of the
directory are not on it (1,039 in all markets).

- `gun` is a gap game (`GAP_CRAWL` in `site.config.ts`), on the 2026-11-18 terms: read only at a shop Gundam Compare does not
  list, only in the slots the uncovered games leave, a sister's row for the same shop and product wins, taken by id (or
  the crawl's title rules), never a new rule.
- The probe's words are whole words, so `not: ["model kit"]` never refused "Gundam Model Kits": the 22 Nov probe gave
  `gundam-model-kits`, `gundam-kits` and `gundam-figures-model-kits` slots at own-list shops. `gun`'s `not` words now
  add the plurals, kit/kits, the grades (high, master, real, perfect), plastic model, Gundam Assemble (a tabletop game),
  paints and figures. Refuse-only. `tests/crawl.test.ts` pins both.

Read after the Sun 29 Nov 04:15 UTC probe and the import after it: `takenByLine.gun` (22 Nov: 91), Gundam products with no
store (23 of 82). Lorcana (41 of 171) is thinner but noindex here (its sister ranks), so it waits.

## 2026-11-23: The pages past the home page: a filter bar on lists, folded directories

Owner: "we spend so much time on the landing page that we've kind of forgoed the database pages, the filters, the guides, all
the other pages and hubs … revamp and upgrade those." Measured on a 390px phone before: `/sealed/booster-box` 123,022 px tall
(774 tiles, no filter, no sort, unpriced pre-orders of small games on top), `/sealed` 41,085, `/sets` 84,435 (a table whose
last columns were cut off), `/stores` 48,003 (one bulleted list). After: 8,711, 6,419, about 18,000 and 9,233.

- **Type pages** (`/sealed/<type>`, `/games/<game>/<type>`): `FilterGrid.tsx` renders EVERY tile in the server HTML, most
  likely to be bought first (`rankProducts`, the home page's own ranking; it was newest set first), and folds the tiles
  after the first 40 with a class. `ListControls.tsx` is the bar: a name filter, a sort (popular, newest set, price up
  or down, most stores), "In stock now" and, on the all-games pages, one chip a game. It only hides tiles and sets their CSS
  `order`: no fetch, no navigation, no query string (one CDN copy per URL), the choice kept in the hash so a filtered list
  can be shared. Scripts off: a `<noscript>` rule shows every tile and hides the bar. A list of 12 or fewer has no bar.
- **`/sealed`**: ten of each type, most popular first (it was 24, newest first), one sideways row on a phone like the home shelf.
- **`/sets`** and **`/stores`**: `FoldFinder.tsx`, a find box, a jump row (games, countries) and each group folded to its
  first rows (6 newest sets a game; 12 stores a country, most listings matched first) with "Show all". Every set and store
  link is still in the HTML; store links keep `nofollow`.
- Dates read "Jun 26, 2026" (`shortDate`, US first) on the set page, the sets list and the guides; JSON-LD keeps ISO dates.

Unchanged: every URL, title, canonical, h1 and JSON-LD type; the price table and its row order; the one ad block a page,
under the grid; no new prompt, banner or pop-up (the page budget). Only the two type pages' meta description changed two
words ("most popular first"). `tests/list-controls.test.ts` pins the server HTML, the no-fetch bar and the folded directories.

Read 7 Dec: buy clickers per 100 visitors who land on `/sealed/*` and `/games/*/*` (Vercel, 24 Nov to 6 Dec against 9 to 22
Nov), and phone bounce on those paths. If either is worse, put newest-first back as the default sort before anything else.

## 2026-11-23: The deal finder's table fits a phone

On a 390px screen the deal finder's six columns pushed the price, the saving and the Buy button off the right edge, behind a
sideways scroll: the one page whose whole point is the buy click hid it. Below `sm` the Where, Market and Under columns are
hidden and their content folds into the two cells that stay (the store under the name, "−N% · mkt $X" under the price), so a
row is name, price, Buy. Desktop is unchanged. No new copy, prompt or ad.

## 2026-11-23: "Is it worth it?" is written from each product's own data (SEO quality pass)

A live audit of the sitemap's product pages on 23 Nov (24 random pages per page type, `<main>` text without header, footer,
nav and forms; 5-word shingles shared by more than a fifth of the sample counted as template) found a median of **69 words
of a page's own** on `/card/*` here (16 of 20 under 80), against 653 on DexCompare's product pages. The "Is it worth it?"
section was one templated sentence on every product page.

`lib/buyer-read.ts` (pure, the same file as YGO Compare's; `tests/buyer-read.test.ts`) now writes it from the product's own
prices, stock and history: each market's in-stock store count, cheapest and dearest and what the gap saves; the cheapest
US-dollar store against TCGplayer's market price (never converted); one store versus many, sold out, pre-orders only;
TCGplayer's lowest listing; TCGplayer's market price since we started recording it, its tracked range and where today sits;
the set's release and age, the product's rank among the set's priced sealed products and how many of its cheapest pack it
costs. `ebayPrices: false`: no eBay price is ever named here (2026-11-14). On the 1,000 indexable products the section's own
words go from ~25 to a median of 147 (10th percentile 90). `usCheapestQuoted` stays in `lib/product-page.ts` for its test
but the page no longer uses it. Judge on 1 to 8 Dec against 3 to 9 Nov.

Set pages too: `setRead` (same file) writes "<set> prices at a glance" under each set page's grid from the set's own products. The import and marketplace advice sentences that would repeat on every page were removed from both sections.

## 2026-11-23: Clicks that feel instant, on the real URLs (NavBoost)

Owner, 23 Nov: "I want the sites to be very, very fast to use ... clicking all the tabs", with a single-page site of his as the
model (it switches views on a `#hash`, so nothing loads). We cannot do that: a hash route is one URL to Google and breaks the URL
freeze. The same feel the crawlable way, in `components/NavBoost.tsx` (one delegated listener, mounted once in the layout, nothing
in the server HTML):

- **Intent prefetch.** A same-site link starts loading on touch-down, on a 65 ms hover and on keyboard focus (`router.prefetch`),
  once a visit. Only a page somebody is already pressing or pointing at, so it costs about what the click would have. The
  viewport prefetch `components/Link.tsx` turns off for cost stays off (`tests/nav-boost.test.ts` fails on an IntersectionObserver).
- **The main tabs warmed when idle**: `/`, `/sealed`, `/sets`, `/games`, `/tools/deal-finder`, once a visit, skipped on Save-Data
  and 2g. Five CDN-cached hubs: at most five edge requests a visit and no function run while the CDN copy is warm.
- **Feedback inside the tap**: `html[data-nav]` draws a line of light on the top edge from the click until the new page is in
  (after 120 ms, so an instant swap never flashes it). A tile that opens the quick view is left alone.
- Never `/go`, `/out`, `/api`, a sponsored link, a new-tab link or another host.

Measured (production build, emulated phone: 4x CPU slowdown, 150 ms round trip, 9 Mbps; tap to first paint of the new page, median
of 5): Sealed tab 871 → 567 ms, All games 740 → 432 ms; a link that is only prefetched on touch-down 609 → 591 ms (the touch
gives about 100 ms of head start, most of the rest is the phone drawing the page). What is left is page weight, not network:
`/sealed/booster-box` takes 1.4 s to draw on that phone because every product is in the page. Next: make the heavy pages lighter
to draw. Rollback: remove `<NavBoost>` from the layout.

## 2026-11-23: The games get their own menu, and the Sets menu shows the sets people open

Owner, 23 Nov: "our sites' navigation can be significantly improved". Two things were wrong in the header and the phone menu:

- The eight biggest games were filed under "Deals & stock", between the sale and the pre-orders. On a site of 31 games the game
  is the first thing a visitor picks. `navGroups` now returns a "Games" group first; the header row is Games, Sealed, Sets, Deals,
  More (five, the most `tests/shop-nav.test.ts` allows) and the phone menu opens on the games. Deals & stock keeps the sale, the
  pre-orders, the deals, the movers, restocks and the stores. Same links, same server HTML, none added or dropped.
- The Sets menu listed the six newest sets of any game, which few visitors know. It now lists the sets whose products rank
  highest in the home page's own ranking (`rankProducts`, lib/home-demand.ts), titled "Popular sets".

No URL changed.

## 2026-11-23: The Sealed Sniper covers every game our sites cover

The owner asked for the deals hub to "cover all the tcgs we have": the Discord and Telegram feed read as Pokémon-only. `SNIPER_LINES`
now holds Pokémon, One Piece, Riftbound, Magic, Lorcana, Yu-Gi-Oh!, Gundam, Union Arena, Fusion World, Digimon, Star Wars: Unlimited,
Flesh and Blood and Cyberpunk. Pokémon Japan stays out (yen prices). The same checks, bands and caps apply to every game, and a run is
still ONE message of at most `MAX_POSTS`, so the hub's three drops a day hold. So that Pokémon's volume cannot fill every slot,
`spreadGames` puts each game's first `MAX_PER_GAME` (3) ranked events in front and the rest after them: a quiet day still fills its
slots. The hub's price bot copies each drop's posts into the game's own channel (TCGEmpire `scripts/discord-publish.ts`).

## 2026-11-23: Extension matcher: a set of two, a bonus pack or a special edition is never the plain product

The 1.3.0 test on live shops (Collectors Kingdom UK, TCGKing NL) found two wrong names: a single "30th Celebration
Battle Deck" was named as the "[Set of two]" (and told the visitor it was the lowest price), and "ST04: SEED Strike
Starter Deck" as the deck's bonus pack, because TCGplayer writes "Starter Deck 04" where stores write "ST04". `marks()` in
`extension/src/match.js` now reads set of two/three, bonus, special edition (and "ST02A"-style codes) and Gundam Assemble;
both sides must say the same ones or it is no match. "Starter Deck 04" reads as "ST04". It only refuses (and the ST
reading finds the right deck); the 2,307-title set went from 86.8% to 87.0% right first time, wrong claims unchanged at
1.9%. It ships in 1.3.1, which was not uploaded yet. `tests/extension.test.ts` holds the real titles.
The same test at Good Games AU found One Piece singles listed under their booster ("Nami EB05-055 (Extra Booster: …) -
Alternate Art Foil") named as the booster pack, three with a "Save" line. A card code (`EB05-055`, `OP01-001`, `GD01-012`)
or a printing after a dash ("- Foil", "- Alternate Art Foil", "- Normal") now makes a page a single card, whatever kind
of product the words also name. No change on the 2,307-title set.
And at Common Lands US a "Collector Booster Display" page carried the Collector Booster Pack's UPC, so the barcode named
the pack. A barcode still decides a page, except when the page's own words name another kind of product.
On eBay, a "(Seal Damage)" ETB was called the lowest price: damaged, dented, crushed, torn, opened, resealed and empty
now refuse a page, as lots and repacks already did ("unopened" is still fine).

## Black Friday page: one deal list, deals above the fold (owner's review, 2026-11-24)

The owner reviewed DexCompare's Black Friday page and asked for the changes "urgently" on every site: deals above the fold with a
one-line intro, one list with a toggle, a discount badge on every row, filters and sort, sticky section chips, per-row freshness,
delivered price, a sparkline, plain labels, one affiliate disclosure, aligned rows, the store button primary and eBay a text link,
bigger thumbnails, one slim alerts bar, phone rows with 44px targets, and click and scroll tracking per section.

- The page's lists (US "under TCGplayer", each country's "under other stores") are ONE list (`lib/sale-deals.ts`,
  `lib/sale-deals-data.ts`, `components/SaleDeals.tsx`). Each row is the cheapest in-stock store price for a product in one country,
  and both savings are measured against that price; the toggle ("Under TCGplayer" / "Under other stores today") picks the basis
  that badges and ranks, a country select picks the market (the visitor's own once the page loads; the server HTML is the US). The
  struck price is that basis's reference, labelled for screen readers, never "was".
- The strongest 48 rows per country and basis ship to the browser, so the filters run without a request and the page stays light.
- A row whose store was read more than 12 hours ago says so in amber (the store's own `meta.stores[...].at`). Delivered price
  only where the store's shipping was read; otherwise "Shipping at checkout". The sparkline is the country's cheapest in-stock
  store price per day (`data/store-lows`), the last 30 days.
- Clicks keep going through `/go` with `from=<page>_list` (and `_list_ebay`); `bf_section` counts each section's first view
  (scroll depth), `bf_filter` each filter used. The weekly email box became the alerts bar after the fifth row (email, Discord,
  Telegram).

## 2026-11-24: The owner's UX review, site-wide (P0, P1, P2)

The owner reviewed DexCompare on desktop (AU) on 23 Nov and asked for the same fixes on every site, urgently. On TCG Prices
(the sale pages' items shipped in #173 and #174):

**P0**
1. **No interrupting ads.** `lib/visitor-busy.ts`: a focused text field or a key in the last 5 s means nothing self-opens. The
   sign-in slide, the rating card and the return nudge ask it. The return nudge (the floating eBay/TCGplayer card, A/B since
   2026-11-18) covered the page, so it is OFF (`RETURN_NUDGE_ON`); `nudge_eligible` still fires. It also now takes the visit's
   one prompt slot (`lib/prompt-slot.ts`). The leave nudge and the phone dock were already off.
2. **Fresh prices.** Pages said "checked 30 hours ago". Cause: GitHub started `refresh-prices.yml` 4-9 hours late, so its two
   data commits landed 8-9 hours apart and the 12-hour gate skipped every second one (19-23 Nov, every early-UTC data commit:
   "Canceled by Ignored Build Step"). Now the import is timed to the gate, with no release of its own: `freshness.yml` (hourly)
   reads the last production build from its GitHub commit status (`scripts/last-build.sh`) and starts the import 11 hours after it
   (the import takes 64-77 min), so its usual `[deploy]` data commit lands when the gate opens; a scheduled run that would land
   inside the 12 hours stops itself (job `gate`). Red alerts: snapshot 14 h old, live build 16 h old (one cycle plus run time);
   the ops monitor's import check went from 30/54 h to 14/20 h. Each store row says when its price was read
   (`lib/store-checked.ts`: the crawl's last full read, else its sister site's data time).
3. **Sort and filter on every listing** (`ListControls`): price both ways, % under market, newest, most stores; set, release year
   and price band, beside game and stock. No price-per-pack sort (no pack counts in the catalogue; never guessed) and no language
   filter (the catalogue is English).
4. **One visible order.** The product table's stores are one cheapest-first run; every eBay, TCGplayer and Amazon row sits in the
   marketplaces block (item 10). The listing grids had no interruption.
5. **Typo-tolerant search** (`lib/search-fuzzy.ts`): exact words; then shorthand (ETB, UPC, BB, SPC…); then each unmatched word
   swapped for the nearest catalogue word (1 edit for 4-6 letters, 2 for 7+, none for codes), said as "Showing results for";
   nothing at all shows the most popular sealed products. `search_none` and `search_corrected` are tracked (P2 24).
6. **Less above the title.** The one promo line under the header (sale or pre-order) closes with ✕ for 7 days (`StripClose`).

**P1**: product page stores first with eBay, TCGplayer and Amazon under a labelled "Marketplaces · Ad" block (reverses the
2026-11-17 eBay-first order on the product page only; the quick view keeps it), store rows' View deal is the primary button, the
thumbs are hidden on phones and the cart button is a quiet "Save"; the cart is the **Shortlist** everywhere, and says "We sell
nothing" whenever it opens (URL `/cart` unchanged); sticky jump links (Prices, History, Facts, Is it worth it?) and the price
history moved beside the price (left column on a desktop); every discount badge says what it is measured against ("N% under
market" or "N% under median") with the definition on hover; one-line intros with "How it works" on listing, deals and restocks;
a failed product photo is retried once after 1.5 s, then shows the site mark (`ImageFallback`). Not done: delivered price by
default (P1 9), since no store row carries shipping in the data yet.

**P2**: the Deals menu holds five (the sale, today's deals, movers, restocks, pre-orders; the release on pre-order keeps its strip
and its place on the hub, the stores directory moved to Guides); the account link has a tooltip (theme, region and shortlist
had one). Not done here: set logos (no licensed source), the one "Get alerts" component, the 390px template pass.

Click guard: eBay and TCGplayer outbound clicks per 100 product views at release+2d (the marketplaces moved down); if they fall
more than 40% with store clicks flat, the product page's marketplaces block goes back above the stores (owner's call).

## 2026-11-24 — Game hub snippets are written from the data (page scorecard, Job D)

The 23 Nov page scorecard put the game hubs (`/games/yugioh`, `/games/cyberpunk-tcg`, `/games/digimon-card-game`,
`/games/godzilla-card-game`, `/games/cookierun-braverse`) and three game-type hubs in TCG Prices' bottom 20%: page one in
Google (positions 5 to 15, for "yugioh prices", "cyberpunk tcg prices", "digimon card value", "godzilla booster box"), 20 to 58
impressions each over 28 days, no click. Their title and description were one template for all 31 games ("<game> Booster Box
Prices — Every Store"; "booster boxes, cases and starter decks compared…").

`lib/hub-snippet.ts` now writes both from the page's own products: the title names the game and only the kinds it has ("Yu-Gi-Oh!
Prices: Booster Boxes, Packs & Decks"; a type hub "Digimon Card Game Booster Pack Prices: All 44 Compared"), and the description
leads with ONE real price: the newest released product (a booster box on a game hub) that a store has in stock in the US, the
store's own US-dollar price and name, beside TCGplayer's market price. Never TCGplayer, eBay or Amazon as that price, never a
pre-order, never an MSRP or a pack count; with no such offer the price sentence is left out. Pages are CDN-cached six hours, so
the snippet moves with the data, like the set pages' "About this set" lines (2026-11-18). Sister-ranked games' product pages stay
noindex as before; their hubs were already indexable and get the same snippet. `tests/hub-snippet.test.ts`.

Read: Google clicks and CTR on those eight URLs, 28 days to ~22 Dec vs the scorecard's 0 clicks.

## 2026-11-25 — Riftbound Sniper deals name RiftCompare

Every Riftbound deal in a Sealed Sniper drop (Discord and Telegram) now ends with "Every Riftbound price, every day, on RiftCompare",
linked to riftcompare.com/legacy-preorders until 13 Dec and /sealed after, tagged utm_campaign=brand (plan item 4). Rift's Google plan needs brand searches back from about 130 to 170 or more
a week by 15 Dec, and a drop that names the brand next to a real deal is the cheapest way to put the name in front of Riftbound
buyers. Same side of the network, one line per Riftbound deal, nothing for other games (`riftCompareUrl`, `tests/sniper.test.ts`).

## 2026-11-25 — Fiverr usability review (owner's paid tester): search, trust line, a shorter product page top

A paid tester recorded a nine-minute think-aloud on tcgprices.app (UK, then US; transcript in the project files,
`fiverr-review-2026-11-25/`). Verdict: clear, not confusing, would click View deal; asks: make search stand out, say we
compare every store and not only the paying ones, show ratings, and declutter the product page's top. Done here:

- Home hero: the art is dimmer (peak 0.55 to 0.30) and the search box carries a brand edge, solid ground and glow at rest.
  The intro line adds "Every store we track is listed, paid or not, in price order" (true: most stores pay us nothing).
- Product page: the same sentence under the price table, linked to /methodology; the About page's copy brought up to the
  stores-first order of 2026-11-24. "I own this", "Share deal" and the watch button share one row (the collection hint is a
  tooltip, the group-chat share a two-word label). On a phone the price history now comes right after the prices, before
  the alert form (the columns are `contents` below md and their parts ordered).
- Phone price table: a long one-word store name ("LegendsSportsGames") held the table 29 px wider than a 390 px screen, so
  every View deal button was cut off. Names now wrap anywhere, cells and buttons are tighter below sm, the ↗ hides there.

Not done, on purpose: Add to cart/Shortlist and the "Watch this price · free email" wording are A/B arms frozen until 2 Dec
(the tester said they would not use the shortlist; that goes into those verdicts); the alert form stays open under the prices for
the same reason (collapsing it shifts the watch test). A ratings block on the home page is one the owner cut on 2026-11-13
(`tests/minimal-look.test.ts`); a Trustpilot profile needs the owner. Longer history ranges come as the data grows.

## 2026-11-26: The header's string of Christmas lights is removed (owner)

Owner, 2026-11-26: "I don't really like the Christmas lights on the very top." The string of lights hanging under the header
(2026-11-20) is removed on every Compare site: the `.xmas-garland::after` rule is gone from the `xmas-logo` block in `globals.css`
and the class is off the header. The Santa hat on the logo stays, and nothing else of the Christmas layer changes.

## 2026-11-26 — Trustpilot business profile: domain meta tag

The Fiverr tester asked for an outside trust signal. Bill opened a free Trustpilot business account for TCG Prices
(bill.jyang101 login, no tcgprices.app mailbox), so the domain is verified with Trustpilot's one-time meta tag in the
root layout's `<head>`. It carries no tracking and stays harmless after verification. No Trustpilot widget or script is
added (UX guard: no extra prompts or third-party scripts); a plain "Review us on Trustpilot" link may follow once the
profile is live.

## 2026-11-25: A TCGplayer column in the empty right side of a wide window (owner)

The owner, 2026-11-25, on a desktop: "Why are the display ads at the very bottom of the site? … there's so much space on the left and the
right side of the website." (YGO Compare #267 and the sister sites.) The home page's one ad block already sits after the games and sets,
before the reading matter, so it stays. New: `components/GutterAds.tsx` (YGO Compare's) with `sides="right"`, from 1440px wide: one
labelled TCGplayer column in the right-hand gutter, never eBay (this site has no eBay keyset, so an eBay column would be searches with
no price). Sized to the gutter beside the page's 1152px content (about 110px at 1440, 180px at most), 14px clear of it and of the
window; absolutely inside `<main>` with a sticky card, so it never covers or narrows the page, the header or the footer. Browser only
(CLS 0), labelled Ad, rel sponsored through /go under `gutter-tcg`, never Amazon, never on the ad-free pages (`AdRouteGate`) or for
ad-free members. Tiles start after the block's own three. Read: gutter clicks per 100 desktop visitors; if desktop buy clicks per
visitor fall 10%, it goes.

## 2026-11-25: Best Basket as a Premium plan with shipping borrowed from the sister sites

The owner (2026-11-25): Best Basket "on all the sites as premium", after users asked for it. `/tools/best-basket` (noindex, never in the sitemap) takes the shortlist's products and splits them across
stores for the lowest total with shipping. It runs RiftCompare's solver unchanged (`lib/basket-optimize.ts`), the same port as
DexCompare (CompareEmpire #369), MTG Compare (#278) and YGO Compare (#269), whose files these are.

- **Shipping is borrowed, never guessed.** This site measures no store's postage. DexCompare and MTG Compare measure it every
  week at each Shopify store's own checkout. A shop's postage does not depend on the game, so
  `scripts/borrow-shipping.ts` (in `refresh-prices.yml`, never fatal) copies those measurements onto our stores. A store is
  matched by host AND market, never by name, and only in its market's own currency. The result is written to
  `data/shipping/borrowed.json`, which covered 924 of 1,346 stores on the first run. A store with no measurement is left out of
  a basket and counted, never priced at zero. The ops monitor's "Best Basket shipping" check watches the file's age and
  coverage.
- **Rows:** in stock, from a store whose last good read (`meta.stores[key].at`) is under 48 hours old. Never a pre-order (an
  unreleased set, the offer's `preorder` flag, or "pre-order" in the title or link). Never TCGplayer, eBay or Amazon. These are
  Rift's rules after the Sprite Fountain report (TCGEmpire #653).
- **Free vs Premium:** everyone gets the delivered total and the saving. The store-by-store plan (`/go` buy links, each
  store's shipping, the one-store order) is returned by `/api/basket` only when RiftCompare's sister-premium status says the
  token is Premium right now. It is withheld in the response, not hidden with CSS.
- **Placement:** one link on `/cart` once the list holds two or more products. There is no pop-up.

## 2026-11-26: the phone's home page, tidied (one path: the headline, the search, the games in one row, the products)

**Owner, 2026-11-26:** "we should still tidy up the landing page for our sites a little bit, because I think there's just too
much going on, especially for mobile phone." The 19 Nov pass made the shelf one sideways row and the game list two columns; he
still finds the page busy.

**Measured at 390px before:** 5,343px tall. Above the first product: the sale strip, the pre-order pill, the headline, four
lines of sub-text, the search, six game tiles in three rows, the line of counts, the game marquee (the same games again), the
shelf's title, tabs and two notes. The first product began at about 1,150px, on the second screen, and "Pick your game" was
thirty games in fifteen rows, about 1,300px.

**Now, below 640px only:** the headline, the search, the games drifting past as the ONE row of ways in, then the shelf, the
first ten games with a button to all of them, the ad block, the guides and the questions. 3,994px (25% shorter), and the first
products begin at about 590px, on the first screen. Hidden on a phone: the six game tiles (the marquee right under them
carries every game, the same five first, and "All games" is the button under "Pick your game"), the sub-line, the line of
counts, the pre-order pill while the sale strip under the header shows (one promo per page; a visitor who closes the strip
gets the pill back, and the shelf's Pre-orders tab is on the same screen), the shelf's first note where it has two, and the
games after the tenth.

**Unchanged:** the 2050 layer and the marquee, untouched. The HTML is the same at every width, so a crawler, find-in-page and
a desktop see every block; no URL, title, heading or JSON-LD changes; from 640px up the page is pixel-identical (compared at
700px and 1280px). No ad moves: the one ad block is still under the game list, as it was. One element is new in the HTML: the
"All 30 games" button under the game list (`sm:hidden`, a plain link to `/games`, which the hero and the menu already link).
CSS only otherwise, in one block at the end of `globals.css` ("The phone's home page, tidied"); the hooks are `home-tidy` (the
page) and `home-games` (the list). Reverts by deleting the block.

**Read:** phone bounce (non-Reddit) and buy clickers per 100 phone visitors on the home page, and phone visits to
`/games/<game>` from the home page, the week after release against the week before. If game-page visits from a phone fall,
the six tiles come back as one sideways row and the marquee is the one that hides.

## 2026-11-26: The crawl reads set names without TCGplayer's release code

TCGplayer puts a release code in front of the set name for almost every Union Arena (61 of 62), Cardfight!! Vanguard
(70 of 70) and Shadowverse: Evolve (44 of 44) set, and some hololive and Palworld ones ("UE25BT: My Hero Academia
Special Booster", "DZ-LBT02: Lyrical Monasterio Season of Wonders"). `matchSealed` needs every word of the set's name in
the title, so on our own crawl a shop title that did not spell the code could never be placed by its title. On the
catalogue, a title of "<set name> <product name>" placed itself for 1 of 153 Union Arena products, 8 of 111 Vanguard,
10 of 71 Shadowverse. The Amazon matcher already reads names this way (2026-11-14), and nothing explained why the store
import should not.

- The crawl's per-game index is `crawlIndex` (`lib/import/crawl.ts`), `buildIndex` with `stripSetCodes`: the code is one
  more code of the set, not a word every title needs. Same simulation after: 153/153, 108/111, 71/71, and no product of
  any game placed on another that was not already (the 9 One Piece Double Pack Set and 1 Digimon release-event rows
  are the same before and after; the title pick's type and quantity checks refuse them).
- `setCodesInTitle` now also reads a whole release code the index knows ("UE25BT", "DZ-LBT02", "ECP01"); before, the
  two-letters-two-digits shape stopped at "UE25" and read nothing. It only adds codes, so a title naming another set's
  code is refused.
- Every other rule of the title pick is unchanged (in stock, one game, its own type, quantity one, 40-250% of
  TCGplayer's market). The old store pass (`idx` in `import-all.ts`) is left as it was.

**Read:** after the next import, `takenByLine` ua / cfv / sve (25 Nov: 116 / 421 / 124) and the products with 0 stores
(`scripts/coverage-report.ts`; Union Arena 88/154 on 23 Nov), the Union Arena My Hero Academia box (714370, 11 Dec) and
the Vanguard Persona 30th display (710648, 11 Dec), both TCGplayer only on 25 Nov.

## 2026-11-26: BandaiCompare merged into TCG Prices

The owner asked whether BandaiCompare should be split into one site per game or merged into TCG Prices ("we thrive on
sites that are tailored … Bandai Compare has earned us nothing"). The numbers: 4 weeks to 22-23 Nov, A$4 earned, 299
visitors, 1 buy click; its best page in Google had 19 impressions and no click (page scorecard, 23 Nov). The last eight
launches earn A$0-27 a month after 3-7 weeks, and the standing rule is no new site before 18 Jan, so three new sites
would start from the same nothing. TCG Prices already had all three games as game hubs (Union Arena, Fusion World,
Digimon: 357 products to BandaiCompare's 219) and already took BandaiCompare's store prices as a sister. Merged.

- bandaicompare.com 301s every page to its TCG Prices twin, one hop (`Specifxx/bandaicompare`,
  `data/redirects/tcgprices.json`, frozen): 508 pages, 389 to the same path here, the 110 others (93 release-event and
  promo sets with no sealed product here, 17 old Digimon decks and boxes culled here) to the game's hub. Its domain
  stays and keeps renewing.
- BandaiCompare's daily store import keeps running in its own repo, as this site's price feed for the three games
  (`sisters.ts`, unchanged), its 100 eurozone shops of 26 Nov included. Retire it only after a trial import shows our own
  crawl matches it game by game.
- Here: `SITE.family.merged` (`["bandai"]`) keeps BandaiCompare off `/our-sites`, the family block and the sister search
  links; its three evergreen guides (Union Arena star rarities, the card-number guide, fake cards) moved to `/blog`
  under the same slugs. `tests/sister-sites.test.ts` pins it.
- The other sites' shared `family-network.ts` still lists BandaiCompare; its link lands here through the 301.

**Read:** Google clicks on `/games/union-arena`, `/games/dragon-ball-super-fusion-world` and `/games/digimon-card-game`
and the three guides, 28 days to ~24 Dec, against 0; GSC's page indexing for bandaicompare.com should show the 301s
by mid-December.

## 2026-11-26 — Sealed Sniper drops on /restocks, with hot, cold and expired

**Asked:** the COO's OzBargain study, move 1: phase one of a TCG deal board. Visitors vote a Sniper drop hot or cold or
flag it expired, inline, with no sign-in and no prompt, stored on RiftCompare's backend.

**Now:** `scripts/sniper.ts` appends every drop it really posted (Discord or Telegram took it) to
`data/public/sniper-drops.json` (`lib/sniper-board.ts`: id, time, kind, product, store, price; 14 days, 120 at most;
nothing private). `/restocks` shows the newest 20 as cards above the restock list, each with `DropVotes`: one GET of
every card's tally after render (riftcompare.com/api/deal-votes, CDN six hours) and a POST per tap that answers with
that drop's fresh count. No page gains a function or a build step. Votes order nothing: no price, row, badge, feed or
alert reads them. GA gets `drop_view` (a card 60% in view, once a page view), `drop_vote` and `drop_click`, for votes per
100 drop views and the click-through.

## 2026-11-26 — My collection follows a signed-in member, with an opt-in weekly value email

Owner, 2026-11-26 (move 5 of the deal-site study: a sealed stash tracker with a weekly "your stash moved" email; "designed in a very, very
nice way … tested"). The list still lives in the browser (`ce_vault_v1`) and every page still values it from `/prices.json`; for a
signed-in member it is now also kept with their account on RiftCompare (`/api/sister-premium/stash`, TCGEmpire DECISIONS.md, same day).

- `lib/vault-sync.ts` syncs once on `/collection` and on a product page, then 1.2 s after any change, when the tab comes back and when
  the connection returns; one sync at a time. It is a three-way merge against the last list both sides agreed on, and every write
  names the server's revision (a stale one is refused and merged again): an item added on the phone and one removed on the laptop both
  survive, a quantity changed on both keeps the larger, never the sum. A browser that last synced another account takes the new
  account's list and never copies the old one into it. `tests/vault-sync.test.ts`.
- The weekly value email is a switch on `/collection` (`VaultAccount.tsx`), off until the member turns it on, to the account's own
  address. It is a control on the page, never a prompt (the one-prompt-per-visit rule is untouched). The email links only to this site.
- The page: a sync line under the title, a hero card with the total, change pills, a filled value line (members), "Items / Up most /
  Not counted" and the share and spreadsheet buttons together; rows on a grid that keeps name, value and quantity tidy at 360 px; the
  backup file folded away now that the account carries the list between devices. Privacy page updated.


## 2026-11-26 — Brag cards: the stash and "found it cheaper" pictures people post

Community plan move 4 (owner: "the community is really, really important, because when people talk about things, that's when
things really blow up"; target 200 shares in December). A share is worth far more as a picture than a link: it lands in a group
chat, a Discord channel or a story as something to look at, with our address on it.

- One renderer, `lib/brag-card.ts` (the same file in TCGEmpire for the pull card): 1080×1350 portrait, drawn in the browser on a
  canvas, no route, no function, no Vercel image cost. A JPEG of about 200 KB. Dark ground with the site's colour, the product
  photo when it loads cleanly (cross-origin only with CORS, else the card is drawn without it), a kicker, the title, one big
  number, a tone pill, up to three rows and a footer with the address. Text is measured and clipped; the photo takes only the room
  the words leave.
- My collection's share button (the 1200×630 `collection-card.ts` is gone): "My sealed stash", the market total, the change since
  the items were added, the three most valuable lines. Shared as a file where the phone can, else saved and the link copied.
- Product pages: on a phone that can share a picture, and only when the visitor's market has a real gap between STORES
  (`bragGap`: never eBay, Amazon or TCGplayer as the cheapest), the share button sends "Found it cheaper". In the US, when the
  cheapest store is under TCGplayer's market price, that is the saving shown ("$14.52 under TCGplayer market"), the fair
  yardstick rather than an outlier store; otherwise the spread to the dearest store. It never says the visitor bought anything.
  Desktops and products without a gap share the link exactly as before.
- A phone opens its share sheet only shortly after the tap, so the card is drawn ahead in idle time (`prepareBrag`, one cached
  card) and the tap reuses it.
- Counted as `brag_share { kind: stash | saved, how }` (Vercel Analytics) beside the existing `share` events; the link carries
  `utm_medium=brag-card&utm_campaign=<kind>`. Read in December against the 200 target. `tests/brag-card.test.ts`.

## 2026-11-26 — The deal board: /drops, a page per drop, and a Hot order

**Asked:** the owner, on the OzBargain study ("can we get these implemented ASAP … designed in a very, very nice way …
tested … state of the art"). Phase one put the Sniper's drops on `/restocks` as a plain list with three buttons, hidden
under the restock alert box. A board people come back to needs its own page, a score, and an order that votes change.

**Now:** `/drops` is the board (`lib/drop-board.ts` pure and tested, `lib/drop-board-data.ts` builds the rows,
`components/DropBoard.tsx` draws them): the newest 60 drops as cards with a score between two arrows, the product
photo, the posted price, the store, and what OUR latest import says about it (still that price, a different price now,
or sold out). `/drops/<id>` is one drop's page with a share button: the link to paste in a group chat. Decisions:

- **Votes now order one thing: the board's "Hot" tab.** This reverses phase one's "votes order nothing" for the board
  only. Score over age (`heat`), sold-out and flagged-gone drops under every live one. Hot is worked out when the tab is
  picked, so a vote never moves the card under a thumb. No price, store row, badge, feed, alert or Sniper post reads a
  vote (`tests/drop-board.test.ts`).
- **Stock is our read, not the crowd's.** Each card's state comes from the latest import (`dropState`); visitors' "Gone?"
  flags add "N visitors say it has gone" from three flags (`GONE_FLAGS`) and sink the card in Hot, nothing more.
- **"N% under market" only for a US store's price and only from 5%** (`underMarket`): TCGplayer's market price is in US
  dollars and nothing is converted; a point under is noise.
- **A tap shows at once** and is undone with a line of text if the service refuses it. The same `dv_mine` key as
  `DropVotes`, so a vote on `/restocks` shows on the board. Still no sign-in, nothing typed, no prompt.
- **Cost:** `/drops` is one static copy per release; `/drops/<id>` is `force-dynamic` behind the CDN for a day
  (`CDN_PAGES`), never ISR, noindex and out of the sitemap because a drop leaves the log after 14 days; an id the log no
  longer holds redirects to the board, so a shared link never 404s. `/drops` joins the sitemap once it has a drop.
  No new function, no new request beyond phase one's single tally read.
- **Not in the Deals menu yet** (five at most, owner's UX review): the board is linked from `/restocks` and lights the
  phone bar's Deals tab. Give it a menu place when it has earned one.

**Not done, on purpose:** comments and member-posted deals. Both need accounts and moderation the owner is not there to
do; they follow once the votes show people use the board. Measure with phase one's events plus `drop_sort`.

## 2026-11-26: AI shadow match runs as a half-price batch, and Haiku 5.5 is trialled beside Sonnet

Claude Haiku 5.5 costs US$0.10 / US$0.50 per million tokens, a twentieth of Sonnet 5.5 (US$2 / US$10), and Message
Batches halve either. `ai-shadow-match.yml` takes `batch` (one Message Batch per run, admitted only while a cautious cost
estimate fits `max_usd`; cancelled after 45 minutes, unanswered titles asked next run; a failed batch fails the run and
counts its reserve as spent) and `model` (Sonnet 5.5 or Haiku 5.5 only). Sonnet stays the live model: only it writes
`cache.json`, the file `pickByAi` reads. Haiku is a TRIAL: it writes `cache-claude-haiku-5-5.json` and a summary whose
`vsReference` counts agreement with Sonnet on the same titles, and a trial never publishes without the live cache on the
branch. Haiku goes live only if it agrees with Sonnet's guarded matches as well as Sonnet's own 99.5% pilot precision
(scripts/ai-title-pilot.ts); a wrong match is worse than none.

## 2026-11-26: The collection app: single cards, what I paid, import, and an installable app

Owner, 2026-11-26: "can we launch like Collectr … something better … you don't need to install an app, you can use it on the
website, on your phone". My collection (the sealed stash tracker, entry above) becomes the app:

- **Single cards of every game.** This site still prices sealed only; a card in a collection is valued in the browser from TCG
  Singles DB's open card API (tcgsinglesdb.com/api/open, its DECISIONS.md the same day): TCGplayer's market price in US$ for the
  printing the member owns, labelled as such and never converted. A card is an ordinary vault item with the id
  `card:<game>:<set>:<tcgplayer id>:<printing>` (lib/card-collection.ts), market US, so it syncs, backs up, shares and gets the
  weekly email through the same code. Its row links to TCGplayer and an eBay search through /go (tagged); no card page, file or
  function is added here. The value chart includes a card only when held in the printing Singles DB's history follows (the
  dearest); others are left out, not estimated.
- **What I paid.** `addedCents` stays the one cost field (the account stores it as `a`): it starts as the price on the day an
  item is added and the member can change it; the change line reads "against what you paid". A cost edited on one device wins a
  sync like a quantity does (three-way, lib/vault-sync.ts).
- **Import.** A CSV from Collectr, the TCGplayer app, ManaBox or any sheet: a row becomes a card only when its set name lands on
  exactly one set and its number (or exact name) on exactly one card with the names agreeing; a bracketed qualifier ("Black Dot
  Error") must be in the sheet's name to count. Graded rows (no graded prices), sealed rows and every miss are listed back with
  the reason. Nothing is added before the member says so. Collectr's export columns are not published where we could read them,
  so the reader takes the usual header names and says which columns it needs.
- **Installable, offline.** The manifest opens on /collection (PNG icons, maskable, shortcuts); `public/sw.js`, registered from
  /collection only, keeps the last copy of that page, its build files and /prices.json and Singles DB set files for offline use,
  and passes every other request straight through (no push, no sync, no caching of other pages). "Add to home screen" is an
  in-page card, the visit's one prompt (`claimPromptSlot("app-install")`), shown only with something in the collection, on a
  browser that can install, and silent 30 days after a close. A failed sync request offline is now an "offline" answer, not an
  uncaught error.
- Signing in still opens My collection (owner, 2026-11-19); the cheapest price is never behind Premium.

## 2026-11-26: My collection: try first, sign in to sync

Owner, 26 Nov (decision card "Let people try My collection before signing in?": "Yes, try first, sign in to sync"), reversing
2026-11-19's "you can only use my collection if you are signed in". Collectr makes you install an app before you start; a sign-in
wall is the same hurdle, and the collection app's pitch is no friction. Signed out, `/collection` and "I own this" work at once and
keep the list in this browser (`lib/vault.ts`, as it always was underneath); one quiet line on the page (`GuestNote`) says so and
links sign-in, never a pop-up or a second prompt. Signing in merges the browser's list into the account: the first sync has an empty
base, so it is a union and nothing is lost (`lib/vault-sync.ts`). The weekly email and Premium history stay account-only.
`tests/card-collection.test.ts` pins that neither page sends a signed-out visitor to sign-in.

## 2026-11-26: Sealed Sniper drops lead with one real price gap through the TCGplayer sale

The Cluely growth study (move 1, strategy/cluely-2026-11-26) wants every Discord and Telegram drop to lead with one live,
surprising number. Until `PRICE_GAP_UNTIL` (1 Dec 04:00 UTC, the end of TCGplayer's sale) each drop opens with the biggest
spread among the products it posts: "<product> ranges $low to $high across n <market> stores today. Same product." The low
is the price just checked at the store; the high is the dearest in-stock independent store in the same market in today's
data (what the product page shows). A spread needs 3+ stores, the high 15%+ and 10+ above the low, and no store cheaper
than the one posted; otherwise no hook (never a made-up or converted number, and the dear store is never named). Every
product link in the drop is tagged `utm_campaign=price-gap` while it runs, so its clicks read apart from `sealed-sniper`.
Game-room copies (TCGEmpire discord-publish.ts) carry the embeds only, so the hook stays in #sealed-sniper and Telegram.
## 2026-11-26 — Member rewards on the account page

Owner (26 Nov): "we really, really need a loyalty system ... on all of our Empire websites", one that never runs at a loss. The
shared account service keeps one points balance (RiftCompare `lib/loyalty.ts`, `/api/loyalty`, DECISIONS there, "Compounding daily
streaks, and member rewards"); this site draws it in its own name on the account page (`components/account/MemberRewards.tsx`),
posting the member's token as every other account call does. A daily check-in is 1 point on day 1 of a streak, one more each day in
a row, up to 10 a day; points buy 7 days of Premium (300 points, once a month, never for paying subscribers). It loads after render,
opens nothing by itself and shows on no other page (one prompt a visit at most). Points have no cash value and never change giveaway
entries.

## 2026-11-26: Foreign words in a shop's own language, and single-card codes, refuse a crawl listing

The Haiku 5.5 shadow trial (strategy/claude-capabilities-log.md, 26 Nov) hand-read 25 listings the guards passed: three
Japanese boxes titled in Dutch, French and German ("Japans", "japonais", "Japanisch") and two singles from a starter deck
or mastery pack ("(ST02-002)", "(MPW088)") would have been placed on English sealed products. `isForeign` now also reads
the European words for Japanese, Korean and Chinese (`FOREIGN_NAMED`; it applies to every path, Amazon's included), and
`namesCardCode` refuses a title or raw handle carrying a single card's code (letters and digits, hyphen, three digits;
"LOB-EN001"; "BLC-1-001"; a bracketed "(MPW088)") in the id, title and AI picks and in the shadow guard. Set and deck
codes ("OP-09", "OP09", "[ST-02]", "UE25BT", "SV10") are not card codes. No catalogue name matches either pattern. An id
TCGplayer's own photo proves is still taken, since a promo collection may name its card. Rules only refuse. The Haiku
re-trial (both models on the same candidates, 50 graded) comes after the next crawl reads with these rules.

## 2026-11-26 — Deal board: the banner and the shares lead with one price gap

**Asked:** the COO's Cluely study, move 1: every surface that is shared leads with ONE real, surprising number, tracked
with `utm_campaign=price-gap`.

**Now:** `/drops` opens with today's widest gap between stores for a product on the board ("X ranges $A to $B across N US
stores today. Same sealed product."), with the difference as the big figure, a link to that product's stores and a share
button. A drop's own share text leads with its product's gap, then says where the low end is. The gap is
`lib/share.ts` `bragGap` (in-stock STORES in one market, never eBay, TCGplayer or Amazon, never converted) through
`storeGap`; under 5% of the dearest price (`GAP_MIN_PCT`) nothing is said, and with no gap the banner is absent and the
share falls back to the drop's own line. US first, then the widest in money (`pickGap`). Both share links carry
`utm_campaign=price-gap` beside the usual `utm_source=share&utm_medium=drop`. No word about any store beyond its price.
`tests/drop-board.test.ts`.

## 2026-11-27 — Trustpilot domain verified; review link on About and How we compare

tcgprices.app was verified on Trustpilot through the meta tag above (26 Nov, Bill's account). A plain text link
"Review us on Trustpilot" (trustpilot.com/review/tcgprices.app) now sits at the foot of /about and /methodology only.
No widget, no script, no stars on product or home pages, no prompt (UX guard). We never filter or ask only happy
buyers for reviews.
## 2026-11-27: The Empire design system replaces the 2050 layer's effects

A visitor wrote to Compare Empire asking us to "hire a graphic designer so it wasn't giving claudeslop", and the owner asked
for a design agent to lift every site. The tells were ours: a glow and a perspective grid behind a centred hero, a pill above
the headline, gradient words and wordmark, a spinning ring of light round the search, glass tiles with a pointer spotlight, a
breathing gradient button, a pulsing dot. The `empire-ds` block at the end of `globals.css` (the same block on Dex and MTG;
rules in the project's `design-system/README.md`) takes those off and sets a price guide's type and rules: the brand
colour solid, a left-aligned masthead hero from 640px (centred on phones), a hairline between sections, 10px radius on cards,
inputs and buttons and 6px on badges, hover as a firmer edge. CSS only: no markup, words, order, URL or heading changes. The
paintings behind the hero (owner, 2026-11-14) and the Santa hat stay.

## 2026-11-26: Embed visits and the /data page are now counted (traffic plan rows 5 and 6)

The 26 Nov check could not score "+200 visits from embeds" because nothing counted them. Every widget already links back with
`utm_source=embed` (`utm_medium` = widget, daily or index; the index widget lands on /data). `EmbedArrival` sends one Vercel Web
Analytics event, `embed_visit { medium, page }`, once per browser tab, the same way `share_visit` works: no id, no referrer, no
address stored. Read it in Vercel → Analytics → Events; /data's own visits are in Pages. Returning visitors were already counted
by `return_visit` (ReturnBeacon). Not counted: how often a widget LOADS on someone else's page (it is a cached script-free
document, so no function runs); only clicks through to us are. `tests/embed-arrival.test.ts`.

## 2026-11-27: A release event, tournament or advance-deck title never lands on the set's plain pack or case

A self-test of the crawl's matcher (each sealed product's own TCGplayer name read as a shop title, 26 Nov catalogue) put 21
products on ANOTHER product: every Union Arena, One Piece, Fusion World and Digimon "Release Event Pack" on that set's plain
"Booster Pack" (the event pack's set is "<Set> Release Event Cards", so a title without "cards" missed its own set and the plain
pack won with only a small penalty), OP's "3rd Anniversary Tournament" packs on the Carrying On His Will pack, Bleach's "Advance
Deck Display Case" on the booster box case, and a Secret Lair bundle on "The Hobbit - Bundle". A shop's event pack at US$8
sits inside the 40-250% band of a US$5 pack, so pickByTitle and the sisters' store pass would have shown it as that pack's price.
The Amazon matcher's kind words (`OTHER_KIND`, 2026-11-14) now live in `match.ts` and `matchSealed` itself applies them, with
"anniversary tournament", "advance deck" and "secret lair" added: a title naming such a kind only matches a product whose
name, or whose set's name, names it too. A kind is its words side by side and in order ("Booster Box (24 Pack) + Promo" is
no promo pack), and "advanced" reads as "advance" (TCGplayer's "Advance Deck" is the set's "Advanced Deck"). It only refuses.
After: 0 wrong of 4,570 (was 21), and every product still matches its own TCGplayer name; real shop spellings were not
available here, so read crawl takenByLine ua/op/fw/dg after the next import.
`tests/match.test.ts`.
