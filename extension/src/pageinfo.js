// What a store page says it is selling, read from the page itself and nothing else: its product data (schema.org
// JSON-LD), share tags, heading and title, the barcode and the price it states. Used by the content script (on
// TCGplayer, and on other shops once the visitor turns that on) and by the popup (activeTab). It changes nothing on
// the page and sends nothing anywhere: the result goes to the extension's own service worker for matching.
globalThis.__tcgpxRead = function readPageInfo() {
  const names = [];
  const gtins = [];
  const prices = [];
  let isProduct = false;
  const host = location.hostname.replace(/^www\./, "");

  const num = (v) => {
    if (typeof v === "number") return v;
    let s = String(v ?? "").replace(/[^\d.,]/g, "");
    if (!s) return NaN;
    const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
    if (lc > ld) s = /,\d{2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else s = s.replace(/,/g, "");
    return parseFloat(s);
  };
  const cents = (v) => {
    const n = num(v);
    return Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n * 100) : null;
  };
  const addPrice = (v, cur, why) => {
    const c = cents(v);
    if (c && /^[A-Z]{3}$/.test(String(cur ?? ""))) prices.push({ cents: c, currency: String(cur), why });
  };

  const walk = (x) => {
    if (!x || typeof x !== "object") return;
    if (Array.isArray(x)) return x.forEach(walk);
    const t = [].concat(x["@type"] ?? []).map(String);
    if (t.some((y) => /^(Product|ProductGroup|IndividualProduct)$/i.test(y))) {
      isProduct = true;
      if (typeof x.name === "string") names.push(x.name);
      for (const k of ["gtin", "gtin13", "gtin12", "gtin14", "gtin8", "ean", "upc"]) if (x[k]) gtins.push(String(x[k]));
      const offers = [].concat(x.offers ?? []).flatMap((o) => (o?.offers ? [].concat(o.offers) : [o]));
      const variants = [].concat(x.hasVariant ?? []);
      for (const v of variants) for (const o of [].concat(v?.offers ?? [])) offers.push(o);
      // An in-stock offer first: a sold-out variant's price is not what the page sells it for.
      const sorted = offers.filter(Boolean).sort((a, b) => (/InStock/i.test(b.availability ?? "") ? 1 : 0) - (/InStock/i.test(a.availability ?? "") ? 1 : 0));
      for (const o of sorted) {
        for (const k of ["gtin", "gtin13", "gtin12", "gtin14", "gtin8"]) if (o?.[k]) gtins.push(String(o[k]));
        const cur = o.priceCurrency ?? o.priceSpecification?.priceCurrency;
        addPrice(o.price ?? o.lowPrice ?? o.priceSpecification?.price, cur, "ld");
      }
    }
    if (x["@graph"]) walk(x["@graph"]);
  };
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      walk(JSON.parse(s.textContent));
    } catch {}
  }
  const meta = (k) => document.querySelector(`meta[property="${k}"],meta[name="${k}"],meta[itemprop="${k}"]`)?.content ?? "";
  if (/product/i.test(meta("og:type"))) isProduct = true;
  addPrice(meta("product:price:amount") || meta("og:price:amount"), meta("product:price:currency") || meta("og:price:currency"), "meta");
  const ip = document.querySelector('[itemprop="price"]');
  if (ip) addPrice(ip.getAttribute("content") || ip.textContent, document.querySelector('[itemprop="priceCurrency"]')?.getAttribute("content"), "microdata");

  const text = (sel) => document.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const symbolCurrency = (s, fallback) => {
    if (/US\s?\$|USD/.test(s)) return "USD";
    if (/AU\s?\$|A\$|AUD/.test(s)) return "AUD";
    if (/C\s?\$|CA\s?\$|CAD/.test(s)) return "CAD";
    if (/S\$|SGD/.test(s)) return "SGD";
    if (/£|GBP/.test(s)) return "GBP";
    if (/€|EUR/.test(s)) return "EUR";
    return fallback;
  };
  // Amazon and eBay carry no product data a page script can read; their own title and price elements stand in.
  const amazon = host.match(/^amazon\.(com|co\.uk|ca|com\.au|de|fr|it|es|nl|sg)$/);
  if (amazon && text("#productTitle")) {
    isProduct = true;
    names.push(text("#productTitle"));
    const p = text("#corePrice_feature_div .a-offscreen") || text("#corePriceDisplay_desktop_feature_div .a-offscreen") || text("#apex_desktop .a-offscreen");
    const cur = { com: "USD", "co.uk": "GBP", ca: "CAD", "com.au": "AUD", sg: "SGD" }[amazon[1]] ?? "EUR";
    if (p) addPrice(p, symbolCurrency(p, cur), "amazon");
  }
  if (/^ebay\./.test(host) && text("h1.x-item-title__mainTitle")) {
    isProduct = true;
    names.push(text("h1.x-item-title__mainTitle"));
    const p = text(".x-price-primary");
    const cur = { "ebay.com": "USD", "ebay.co.uk": "GBP", "ebay.ca": "CAD", "ebay.com.au": "AUD" }[host] ?? "EUR";
    if (p) addPrice(p, symbolCurrency(p, cur), "ebay");
  }

  return {
    host,
    product: isProduct,
    names: names.slice(0, 3),
    gtins: [...new Set(gtins)].slice(0, 10),
    og: meta("og:title"),
    h1: text("h1").slice(0, 200),
    title: document.title.slice(0, 200),
    price: prices[0] ?? null,
  };
};
