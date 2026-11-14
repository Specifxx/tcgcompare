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
