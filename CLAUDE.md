# Working in this repo

Read `README.md` first. This is TCG Prices (tcgprices.app): **sealed product only, for every trading card game with a
real market**, on one site (`SITE.lines`, 31 games). It began on 2026-11-14 as a copy of YGO Compare's engine with
BandaiCompare's multi-game parts. It is a copy, not a synced sister: change this repo on its own and port fixes by hand.
Game facts live in `src/site.config.ts`; engine code never names a game.

## What gets a page (owner, 2026-11-14)

- Sealed only, and only products with demand today (`lib/import/focus.ts`, `SITE.catalogFocus`): TCGplayer has a
  market price of US$5 or more AND the set is recent (36 months for boxes, cases, trainer boxes, bundles, tins,
  collections and decks; 18 months for packs and the rest), OR two stores in one market have it in stock. Inserts and
  accessories never; Search Console demand always. Never widen it to "everything TCGplayer lists": a dead set's packs
  are thin pages.
- A game needs a market of roughly US$1M a year or more (owner). Add one as a line in `SITE.lines` with its TCGplayer
  category id; a game with no product today has no page, menu entry or sitemap URL.
- A product the focus drops after it had a page goes to `data/public/culled.json` and must 301 to its set or game
  hub, never 404.

## Store prices come from the sister sites, by TCGplayer product id only

`lib/import/sisters.ts` reads each sister's published data from a sparse checkout (`SISTER_DIR`); nothing is fetched
from a store by this repo. OP Compare is read from its `snapshot` branch (its sealed ids are TCGplayer's), its
store list from its `main`. Never match a sister's offer by title. A sister whose data is over 72 hours old is skipped
and reported in `meta.json`. eBay, TCGplayer and Amazon rows of a sister are left behind, except the sister's own eBay
listing for the product, which is reused.

## Store vetting (owner, 2026-11-14: remove scam and suspicious shops)

`lib/import/vet.ts` judges every store on every import: blocked (`data/store-blocklist.json`, one host per line with
why), no domain of its own (a platform's free address), or too cheap to be true (median under 70% of TCGplayer's
market across five or more in-stock products). A single in-stock price under half of market is left out. Rules may
only refuse; never loosen one to keep a store. A refused store is simply absent: never call a named store a scam on a
page. `data/public/store-vetting.json` lists who was refused and why. `tests/vet.test.ts`.

## eBay: links only (owner, 2026-11-14)

This site has NO eBay keyset and must never be given one or pointed at a sister's. eBay is the first pinned row of
every product (`PriceTable` `ebayQuery`): a tagged search of the visitor's own eBay, labelled Ad, with no price
claimed. Campaign 5339155912, customid prefix `tcgprices`. Pinned paid rows are eBay then TCGplayer only; every store
is an ordinary row; Amazon only with a real Amazon price.

## Amazon's price on the Amazon row (not live yet: no credentials)

`scripts/amazon-asins.ts` (in `refresh-prices.yml`, after the import) finds each sealed product's ASIN on each market's own
Amazon with the Creators API's searchItems and keeps it only when `lib/import/amazon-match.ts` reads the title as THAT
product: the title names the product's own game (`amazon` words per line in `site.config.ts`) and no other, it is read
against that game's products only, set names lose their "ME06: " code, other kinds of pack (Double Pack Set, release
event, empty box) are refused, then `matchSealed` decides. Pokémon Japan and foreign-named products are never searched
(every Japanese title is refused). ASINs and misses are committed in `data/amazon/` (prices never);
`scripts/fetch-amazon-prices.ts` runs first in every build into the git-ignored `data/amazon-live/`, and the product page
shows the row only with a live price under 24 hours old (`lib/amazon-live.ts`). Never a sort, cheapest, deal, feed or
quick-view price. Credentials `AMAZON_CREATORS_AU_*` (and optionally `_US_*`) are **not set yet** in this repo's GitHub
secrets or Vercel: until the owner adds them every run writes `{"state":"off"}` and no row shows.
`tests/amazon-api.test.ts`, `tests/amazon-match.test.ts`.

## Deploys are gated: never add `[deploy]` to a commit subject

One production build per 12 hours, production only (owner, 2026-11-02: Vercel spend capped at $5 to $6 a day).
Production builds only a commit whose SUBJECT carries `[deploy]` (`scripts/vercel-ignore-build.sh`); `[urgent]`
overrides the 12-hour gap only when the owner says so. `refresh-prices.yml` runs twice a day, 12 h 10 min apart, and
its data commit carries the marker: that is the most the cap allows, never schedule a third. "Push to prod" means land
on `main` and ride the next import. Previews are off.

## Cost rules

1. Public data stays in committed files under `data/`; no database, no accounts, no mail key.
2. No `generateStaticParams` that prerenders data-heavy pages. No page or route revalidates under 21600 seconds.
3. Never write anything private to `data/`.
4. Measure `data/` before adding a game with a large catalogue: every server function bundles it.

## Design

The minimal look (owner, 2026-11-13): the hero is words, the search and six ways in, never a product; one tabbed
shelf; the game list; one ad block. No pop-ups, default region US. `tests/minimal-look.test.ts`. On top of it sits the
2050 layer (owner, 2026-11-14; `globals.css`, `Neo.tsx`, `GameMarquee.tsx`): dark by default, three lights, scroll
animations. Keep its rules: CSS only, no layout shift, hidden-until-scrolled only inside `@supports` for scroll
timelines, everything off under reduced motion, never a product in the hero.

## The site watches itself

`ops-monitor.yml`'s schedule is off until the domain is live; turn it on at go-live. A new scheduled job, external
API or limit gets a check in `scripts/ops-monitor.ts`.

## Checks

```
npm run typecheck
npm run lint
npm test
```

Record non-obvious decisions in `DECISIONS.md` (newest at the bottom).
