# Chrome buying assistant

One small Manifest V3 extension engine (`src/`), built per site from `sites/<id>.json` (DECISIONS.md 2026-11-21,
"A Chrome buying assistant"). Today one site: TCG Prices (`tcgprices`).

- **Panel:** on a TCGplayer product page it reads the product id from the URL and, only when the site's
  `/extension.json` has that exact id, shows the cheapest in-stock store price in the visitor's market beside
  TCGplayer's market price, with one link to our product page. Never a title match, never a panel on a product we
  don't track.
- **Popup:** searches the same file; "Find the product on this page" fills the box from the tab's title when pressed.
- **Context menu:** "Search TCG Prices for …" on selected text.
- It changes no link on any other site and adds no affiliate code (Chrome Web Store policy). Our links carry
  `utm_source=chrome-extension&utm_medium=extension&utm_campaign=<id>&utm_content=<panel|popup-search|…>`.
- It sends nothing about the visitor: one cookie-less GET of the public price file every 12 hours.

```
node extension/scripts/build.mjs [id]          # dist/<id>/ (load unpacked) and dist/<id>-<version>.zip (upload)
node extension/scripts/assets.mjs <id> <sample.json>   # icons + Chrome Web Store images, from one real product
```

To release a new version: bump `version` in `sites/<id>.json`, build, upload the zip in the Chrome Web Store
developer dashboard (Bill's Google account). Store listing copy: `sites/<id>/listing.md`.
