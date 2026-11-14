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
