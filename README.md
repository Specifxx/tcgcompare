# TCG Prices

Sealed price comparison for every trading card game people buy (tcgprices.app, not yet live): booster boxes, cases,
trainer boxes, bundles, tins and decks for 31 games, compared across TCGplayer, eBay and over a thousand card stores in
the US, UK, Canada, Australia, Europe and Singapore. A Compare Empire site (RiftCompare is `Specifxx/TCGEmpire`),
started 2026-11-14 from YGO Compare's sealed engine and BandaiCompare's multi-game parts.

## How it works

- **Catalogue and TCGplayer prices**: TCGCSV, one TCGplayer category per game in `SITE.lines` (`src/site.config.ts`,
  `src/lib/import/tcgcsv.ts`). Sealed products only.
- **Store prices**: read from our sister sites' published data, never from the stores a second time
  (`src/lib/import/sisters.ts`). An offer is taken only when it names its product by TCGplayer's product id.
- **Store vetting**: every import refuses a blocked store, a store with no domain of its own and a store whose shelf
  is priced far under market (`src/lib/import/vet.ts`, `data/store-blocklist.json`).
- **Which products get a page**: only ones with demand today (`src/lib/import/focus.ts`).
- **eBay**: no eBay API. Every product's first row is a tagged eBay search; a sister site's own eBay listing is
  reused where it has one.
- **Data**: committed JSON under `data/public/`, written by `.github/workflows/refresh-prices.yml` twice a day. No
  database.

## Run it

```
npm ci
npm run dev          # reads data/public
npm run typecheck && npm run lint && npm test
```

The import needs the open internet and the sister repositories beside it, so it runs in GitHub Actions
(`refresh-prices.yml` on `main`; `trial-import.yml` on a `claude/**` branch whose commit message carries
`[trial-import]`).

Read `CLAUDE.md` before changing anything, and `DECISIONS.md` for why things are the way they are.
