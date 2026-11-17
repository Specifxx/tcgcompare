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
