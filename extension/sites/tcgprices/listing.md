# Chrome Web Store listing: TCG Prices: Sealed Price Checker

**Category:** Shopping. **Language:** English. **Visibility:** Public. **Pricing:** Free. **Mature content:** No.
**Homepage / support URL:** https://tcgprices.app/extension
**Privacy policy URL:** https://tcgprices.app/privacy

## Summary (132 characters max; the manifest description)
See the cheapest store price for sealed TCG product on TCGplayer pages: booster boxes, ETBs, bundles. 31 games, 6 markets.

## Description
Paying TCGplayer prices for sealed product? Independent card stores often sell the same booster box, Elite Trainer Box or bundle for less.

TCG Prices: Sealed Price Checker shows you, right on the TCGplayer product page:
• The cheapest in-stock price we track at independent stores in your market (US, UK, Canada, Australia, Europe or Singapore), in your own currency
• TCGplayer's market price beside it, and how far under it the cheapest store is
• How many stores have it in stock, and one click to compare every store on tcgprices.app

It covers sealed product for Pokémon, Magic: The Gathering, One Piece, Yu-Gi-Oh!, Disney Lorcana, Riftbound, Gundam, Union Arena, Digimon, Star Wars Unlimited, Flesh and Blood and 20 more games.

Also in the toolbar popup:
• Search every sealed product we track, with your market's cheapest store price
• "Find the product on this page": fills the search with the current page's title (eBay, a store, anywhere) so you can pick the product yourself
• Right-click any selected text to search TCG Prices

How it works
• It recognises a product only by the TCGplayer product number in the page's address, never by guessing from a title. On products we don't track it shows nothing.
• Prices come from our daily update of each store's own listing. Always check the store before you buy.
• Close the panel on a product and it stays closed. Turn it off any time in the popup.

Privacy: no account, no tracking, no browsing history collected. The extension downloads one public price file from tcgprices.app about twice a day and keeps it in your browser.

Disclosure: the extension changes no links on TCGplayer or any other site. Its links open tcgprices.app, where some store, eBay, TCGplayer and Amazon links are affiliate links that may earn us a commission at no cost to you. Commission never changes the order of prices.

TCG Prices is independent and not affiliated with TCGplayer, eBay or any game publisher.

## Single purpose
Shows independent stores' prices for the sealed trading card product the user is viewing on TCGplayer, and lets the user search those prices.

## Permission justifications
- **storage:** keeps the downloaded public price file and the user's market and panel settings in the browser.
- **contextMenus:** adds "Search TCG Prices for …" to the right-click menu for selected text.
- **activeTab:** when the user presses "Find the product on this page" in the popup, reads the current tab's title and address to fill the search box. Nothing is read without that press.
- **Host permission tcgprices.app:** downloads the public price file (https://tcgprices.app/extension.json).
- **Content script on tcgplayer.com/product/\*:** reads the product number from the page address and shows the price panel.
- **Remote code:** No. All code is in the package.

## Data usage (all "No")
Collects no personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity or website content. Certify: not sold to third parties, not used for purposes unrelated to the single purpose, not used for creditworthiness or lending.
