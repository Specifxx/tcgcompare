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
