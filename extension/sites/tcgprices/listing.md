# Chrome Web Store listing: TCG Prices: Sealed Price Checker

**Category:** Shopping. **Language:** English. **Visibility:** Public. **Pricing:** Free. **Mature content:** No.
**Item ID:** fdhpgledimoadpaokiipficepklogmha
**Homepage / support URL:** https://tcgprices.app/extension
**Privacy policy URL:** https://tcgprices.app/privacy

## Summary (132 characters max; the manifest description)
Compare sealed TCG prices on TCGplayer and other shops: see what you'd save at the cheapest store, and watch prices drop.

## Description
Never list game or brand names in store copy: a list of games was rejected as "Keyword Spam" (Yellow Argon, 2026-11-22).

Paying too much for sealed product? Independent card stores often sell the same booster box, Elite Trainer Box or bundle for less.

On a TCGplayer product page it shows:
• What you'd save: the page's own price against the cheapest in-stock store in your market, in your currency
• The three cheapest stores, with one click to buy at the cheapest
• TCGplayer's market price beside it

Turn on "Price check on other shops" and it does the same on card shops, eBay and other stores: a small line in the corner when it recognises a sealed product, opened with a click. It stays quiet everywhere else, and you can hide it on any site.

Press "Watch price" on any product and it tells you when the price drops or the product comes back in stock.

The toolbar button shows the product on the page you're looking at, today's best deals, your watched products, and a search of every sealed product we track. Right-click any text to search TCG Prices.

Covers Pokémon, Magic: The Gathering, One Piece and many more trading card games, in six markets.

Pages are read and matched inside your browser: nothing about your browsing is sent anywhere. No account.

Its "Buy" and eBay buttons are affiliate links that may earn us a commission, at no cost to you. It changes no links on any site. TCG Prices is independent and not affiliated with TCGplayer.

## Single purpose
Shows independent stores' prices for the sealed trading card product the user is viewing, against the page's own price, and lets the user search and watch those prices.

## Permission justifications
- **storage:** keeps the downloaded public price file, the user's settings (market, panels on or off, hidden sites) and the user's watched products in the browser.
- **contextMenus:** adds "Search TCG Prices for …" to the right-click menu for selected text.
- **activeTab:** when the user opens the popup, reads the current tab's address and product details to show our price for the product they are looking at. Nothing is read from any tab the user did not open the popup on.
- **scripting:** with that same activeTab grant, reads the product's name, barcode and price from the open page's product data and title tags. Also used to register the "Price check on other shops" script, only after the user turns that on and grants access. It changes nothing on the page and sends nothing anywhere: the match is made inside the extension.
- **alarms:** checks the user's watched products against each new day's prices, so it can tell them about a drop.
- **notifications (optional):** asked only when the user turns on drop alerts; shows "price dropped" and "back in stock" for products they chose to watch.
- **Host permission tcgprices.app:** downloads the public price file (https://tcgprices.app/extension.json).
- **Optional host permission https://\*/\*:** asked only when the user turns on "Price check on other shops". Lets the extension read a shop page's product name, barcode and price so it can show the cheapest store for that product. It runs only on pages that describe a product, sends nothing anywhere, and the user can turn it off (or hide it per site) at any time.
- **Content script on tcgplayer.com/product/\*:** reads the product number from the page address and the product's price from the page, and shows the price panel.
- **Remote code:** No. All code is in the package.

## Screenshots (1280x800)
store/screenshot-1-panel.png (TCGplayer), store/screenshot-3-shops.png (another shop), store/screenshot-2-search.png.

## Data usage (all "No")
Collects no personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity or website content. Certify: not sold to third parties, not used for purposes unrelated to the single purpose, not used for creditworthiness or lending.
