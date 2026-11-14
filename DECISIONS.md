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
