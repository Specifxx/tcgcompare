# Chrome Web Store listing: TCG Prices: Sealed Price Checker

**Category:** Shopping. **Language:** English. **Visibility:** Public. **Pricing:** Free. **Mature content:** No.
**Item ID:** fdhpgledimoadpaokiipficepklogmha
**Homepage / support URL:** https://tcgprices.app/extension
**Privacy policy URL:** https://tcgprices.app/privacy

## Summary (132 characters max; the manifest description)
See the cheapest store price for sealed TCG product on TCGplayer pages: booster boxes, ETBs, bundles. 31 games, 6 markets.

## Description
Never list game or brand names in store copy: a list of games was rejected as "Keyword Spam" (Yellow Argon, 2026-11-22).

Paying TCGplayer prices for sealed product? Independent card stores often sell the same booster box, Elite Trainer Box or bundle for less.

On TCGplayer product pages it shows:
• The cheapest in-stock price at independent stores in your market, in your currency
• TCGplayer's market price beside it, and how much you save
• One click to buy at that store, or to compare every store on tcgprices.app

The toolbar button shows today's best deals and searches every sealed product we track. Right-click any text to search TCG Prices.

Covers Pokémon, Magic: The Gathering, One Piece and many more trading card games.

It matches a product only by the TCGplayer number in the page address, never by guessing. No account, nothing tracked.

Its "Buy" and "Check eBay" buttons are affiliate links that may earn us a commission, at no cost to you. It changes no links on TCGplayer or any other site. TCG Prices is independent and not affiliated with TCGplayer.

## Single purpose
Shows independent stores' prices for the sealed trading card product the user is viewing on TCGplayer, and lets the user search those prices.

## Permission justifications
- **storage:** keeps the downloaded public price file and the user's market and panel settings in the browser.
- **contextMenus:** adds "Search TCG Prices for …" to the right-click menu for selected text.
- **activeTab:** when the user opens the popup (or presses "Find the product on this page"), reads the current tab's title and address to recognise the product they are looking at. Nothing is read from any tab the user did not open the popup on.
- **scripting:** with that same activeTab grant only, reads the product's name, heading and barcode from the open page (its structured product data and title tags) so the popup can show our price for that exact product. It runs only when the user opens the popup, changes nothing on the page, and sends nothing anywhere: the match is made inside the extension.
- **Host permission tcgprices.app:** downloads the public price file (https://tcgprices.app/extension.json).
- **Content script on tcgplayer.com/product/\*:** reads the product number from the page address and shows the price panel.
- **Remote code:** No. All code is in the package.

## Data usage (all "No")
Collects no personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity or website content. Certify: not sold to third parties, not used for purposes unrelated to the single purpose, not used for creditworthiness or lending.
