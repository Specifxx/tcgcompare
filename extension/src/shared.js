// Helpers shared by the service worker, the content script and the popup.
const MARKET_LABEL = { US: "US", UK: "UK", CA: "Canada", AU: "Australia", EU: "Europe", SG: "Singapore" };
const MARKETS = ["US", "UK", "CA", "AU", "EU", "SG"];
const MARKET_OF_CURRENCY = { USD: "US", GBP: "UK", CAD: "CA", AUD: "AU", EUR: "EU", SGD: "SG" };

/** Every link to our site says it came from the extension, and from which part of it. Nothing else is added. */
function tagged(url, content) {
  const u = new URL(url);
  u.searchParams.set("utm_source", "chrome-extension");
  u.searchParams.set("utm_medium", "extension");
  u.searchParams.set("utm_campaign", CONFIG.id);
  u.searchParams.set("utm_content", content);
  return u.toString();
}

/** The visitor's market from their own time zone, until they pick one. */
function guessMarket() {
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();
  if (tz.startsWith("australia/")) return "AU";
  if (tz === "europe/london") return "UK";
  if (tz.startsWith("europe/")) return "EU";
  if (tz === "asia/singapore") return "SG";
  if (/^america\/(toronto|vancouver|edmonton|winnipeg|halifax|regina|st_johns|montreal|moncton|whitehorse|yellowknife|iqaluit)/.test(tz)) return "CA";
  return "US";
}

/** panel: the panel on TCGplayer pages (on by default). shops: the price check on other shops (off until the visitor
 * turns it on and grants the permission). */
async function getSettings() {
  const s = await chrome.storage.sync.get(["market", "panel", "shops"]);
  return { market: MARKETS.includes(s.market) ? s.market : guessMarket(), panel: s.panel !== false, shops: s.shops === true };
}

function money(cents, currency) {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** A buy link through our own /go route: it checks the host, adds the affiliate tag where one exists, and counts the click. */
function goUrl(home, url, source, market, productId, content) {
  const q = new URLSearchParams({ u: url, s: source, m: market, from: `ext-${content}` });
  if (productId) q.set("p", String(productId));
  return `${home}/go?${q}`;
}

/** eBay's own search for a product, sorted cheapest first; null in a market with no eBay site we link. */
function ebaySearch(market, query) {
  const host = { US: "www.ebay.com", UK: "www.ebay.co.uk", AU: "www.ebay.com.au", CA: "www.ebay.ca" }[market];
  return host ? `https://${host}/sch/i.html?_nkw=${encodeURIComponent(query.replace(/\s+/g, " ").slice(0, 120))}&_sop=15` : null;
}

/** The cheapest stores in a market, cheapest first: [{ key, name, cents, url? }]. Only the cheapest has its own
 * listing link (the feed's `b`); the next two (`r`, 1.3.0) link to our page, which lists every store. */
function storesIn(pack, market) {
  const it = pack.it;
  const out = [];
  const first = it.b?.[market];
  if (it.p?.[market] != null) out.push({ key: first?.[0] ?? null, name: pack.stores?.[first?.[0]] ?? "a store", cents: it.p[market], url: first?.[1] ?? null });
  for (const [key, cents] of it.r?.[market] ?? []) out.push({ key, name: pack.stores?.[key] ?? key, cents, url: null });
  return out;
}

/**
 * The page's own price against the cheapest store, only when both are in the same currency and the page price is
 * believable for this product (40-250% of the store price: a pack page matched to a box, or a case price, says nothing).
 * save: a store has it at least 3% and one unit of money cheaper; lowest: the page is at or under every store we track;
 * same: within that band.
 */
function verdict(pageCents, cheapest) {
  if (pageCents == null || cheapest == null || !(pageCents > 0)) return null;
  if (pageCents < cheapest * 0.4 || pageCents > cheapest * 2.5) return null;
  const diff = pageCents - cheapest;
  const pct = Math.round((diff / pageCents) * 100);
  if (diff >= 100 && pct >= 3) return { kind: "save", diff, pct };
  if (diff <= 0) return { kind: "lowest", diff, pct: 0 };
  return { kind: "same", diff, pct };
}

/** The price card, used by the on-page panel and the popup alike. `d` = { pack, market, currency, home, page: {cents,
 * currency}|null, onTcg, watching, from }. Returns an element; the caller supplies the CSS (CARD_CSS). */
function buildCard(d, handlers = {}) {
  const { pack, market, currency, home } = d;
  const it = pack.it;
  const cur = currency[market] ?? "USD";
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const k of kids) if (k) e.append(k);
    return e;
  };
  const stores = storesIn(pack, market);
  const best = stores[0] ?? null;
  const page = d.page && d.page.currency === cur ? d.page.cents : null;
  // On TCGplayer with no price read from the page, its market price stands in (US only, same currency).
  const pageRef = page ?? (d.onTcg && market === "US" ? it.m : null);
  const v = best ? verdict(pageRef, best.cents) : null;
  const pageWord = page != null ? (d.onTcg ? "TCGplayer's price here" : "this page") : "TCGplayer's market price";
  const where = `${best?.name ?? ""}`;

  const card = el("div", { class: "tp-card" });
  if (d.title !== false) card.append(el("div", { class: "tp-name", text: it.n, title: it.n }));
  const sub = [pack.line?.name, it.pre ? "Pre-order" : null, it.s ? `${it.s} ${it.s === 1 ? "store" : "stores"} in stock` : null].filter(Boolean).join(" · ");
  if (sub) card.append(el("div", { class: "tp-sub", text: sub }));

  if (!best) {
    const others = Object.keys(it.p ?? {}).filter((m) => m !== market);
    card.append(el("div", { class: "tp-v tp-none" }, el("b", { text: `No store has it in stock in ${MARKET_LABEL[market]} today` }), others.length ? el("span", { text: `In stock in ${others.map((m) => MARKET_LABEL[m]).join(", ")}.` }) : null));
  } else if (v?.kind === "save") {
    card.append(el("div", { class: "tp-v tp-save" }, el("b", { text: `Save ${money(v.diff, cur)} (${v.pct}%)` }), el("span", { text: `${where} has it for ${money(best.cents, cur)}, against ${money(pageRef, cur)} on ${pageWord}.` })));
  } else if (v?.kind === "lowest") {
    card.append(el("div", { class: "tp-v tp-ok" }, el("b", { text: page != null ? "✓ The lowest price we track" : "✓ TCGplayer's market price is lower than any store" }), el("span", { text: `Cheapest store: ${money(best.cents, cur)} at ${where}.` })));
  } else {
    card.append(
      el(
        "div",
        { class: "tp-v" },
        el("small", { text: `${it.pre ? "Cheapest pre-order" : "Cheapest in stock"} · ${MARKET_LABEL[market]}` }),
        el("strong", { text: money(best.cents, cur) }),
        el("span", { text: v?.kind === "same" ? `at ${where}, about the same as ${pageWord}.` : `at ${where}` }),
      ),
    );
  }

  if (stores.length) {
    const list = el("ol", { class: "tp-stores" });
    stores.forEach((s, i) => {
      const href = i === 0 && s.url ? goUrl(home, s.url, s.key, market, pack.id, `${d.from}-buy`) : tagged(home + it.u, `${d.from}-store`);
      const a = el("a", { href, target: "_blank", rel: i === 0 && s.url ? "noopener sponsored" : "noopener", class: i === 0 ? "tp-buy" : "tp-go", text: i === 0 && s.url ? "Buy" : "View" });
      list.append(el("li", {}, el("span", { class: "tp-sn", text: s.name }), el("span", { class: "tp-sp", text: money(s.cents, cur) }), a));
    });
    card.append(list);
  }
  if (it.m != null && !(d.onTcg && page == null && market === "US")) {
    card.append(el("div", { class: "tp-ref" }, el("span", { text: market === "US" ? "TCGplayer market price" : "TCGplayer market (US)" }), el("span", { text: money(it.m, "USD") })));
  }

  const actions = el("div", { class: "tp-actions" });
  actions.append(el("a", { class: "tp-cta", href: tagged(home + it.u, `${d.from}-compare`), target: "_blank", rel: "noopener", text: it.s > 1 ? `Compare all ${it.s} stores →` : "See it on " + CONFIG.short + " →" }));
  if (handlers.watch) {
    const w = el("button", { type: "button", class: "tp-watch" + (d.watching ? " on" : ""), "aria-pressed": String(!!d.watching), title: "We'll tell you when the price drops" });
    w.textContent = d.watching ? "★ Watching" : "☆ Watch price";
    w.addEventListener("click", async () => {
      const on = await handlers.watch(!w.classList.contains("on"));
      w.classList.toggle("on", on);
      w.setAttribute("aria-pressed", String(on));
      w.textContent = on ? "★ Watching" : "☆ Watch price";
    });
    actions.append(w);
  }
  card.append(actions);

  const links = el("div", { class: "tp-links" });
  const eb = ebaySearch(market, `${pack.line?.ebay ?? ""} ${it.n}`.trim());
  if (eb) links.append(el("a", { href: goUrl(home, eb, "ebay", market, pack.id, `${d.from}-ebay`), target: "_blank", rel: "noopener sponsored", text: "eBay listings (Ad)" }));
  if (pack.line?.sister) {
    const name = it.n.replace(/\s+/g, " ").slice(0, 100);
    const href = pack.line.sister.search ? pack.line.sister.search.replace("{q}", encodeURIComponent(name)) : pack.line.sister.url;
    links.append(el("a", { href: tagged(href, `${d.from}-sister`), target: "_blank", rel: "noopener", text: pack.line.sister.name }));
  }
  if (handlers.hideSite) {
    const h = el("button", { type: "button", text: "Hide on this site" });
    h.addEventListener("click", handlers.hideSite);
    links.append(h);
  }
  if (links.childNodes.length) card.append(links);
  card.append(el("p", { class: "tp-foot", text: "Store prices from today's update. Buy and eBay links are affiliate links: we may earn a commission, at no cost to you." }));
  return card;
}

/** The one-line summary the collapsed panel and the toolbar badge show. */
function headline(pack, market, currency, page, onTcg) {
  const cur = currency[market] ?? "USD";
  const best = storesIn(pack, market)[0];
  if (!best) return { text: `Not in stock in ${MARKET_LABEL[market]}`, badge: "", tone: "none" };
  const pageCents = page && page.currency === cur ? page.cents : onTcg && market === "US" ? pack.it.m : null;
  const v = verdict(pageCents, best.cents);
  if (v?.kind === "save") return { text: `Save ${money(v.diff, cur)} at ${best.name}`, badge: `-${Math.min(v.pct, 99)}%`, tone: "save" };
  if (v?.kind === "lowest" && page) return { text: "Lowest price we track ✓", badge: "✓", tone: "ok" };
  return { text: `From ${money(best.cents, cur)} at ${best.name}`, badge: "$", tone: "info" };
}

const CARD_CSS = `
.tp-card{font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a}
.tp-name{font-weight:650;font-size:13.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tp-sub{color:#64748b;font-size:11.5px;margin-top:1px}
.tp-v{display:flex;flex-direction:column;gap:1px;margin:10px 0 8px;padding:9px 11px;border-radius:10px;background:#eef2ff}
.tp-v b{font-size:15px}
.tp-v span{color:#334155;font-size:12px}
.tp-v small{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
.tp-v strong{font-size:24px;line-height:1.15;color:${CONFIG.brand}}
.tp-save{background:#dcfce7}.tp-save b{color:#166534}
.tp-ok{background:#ecfdf5}.tp-ok b{color:#047857}
.tp-none{background:#f1f5f9}
.tp-stores{list-style:none;margin:0;padding:0}
.tp-stores li{display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid #f1f5f9}
.tp-stores li:first-child{border-top:0}
.tp-sn{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tp-sp{font-weight:650;font-variant-numeric:tabular-nums}
.tp-buy,.tp-go{font-weight:600;font-size:12px;text-decoration:none;border-radius:7px;padding:4px 10px;white-space:nowrap}
.tp-buy{background:${CONFIG.brand};color:#fff}.tp-buy:hover{background:${CONFIG.brandDark}}
.tp-go{color:${CONFIG.brand};background:#eef2ff}.tp-go:hover{background:#e0e7ff}
.tp-ref{display:flex;justify-content:space-between;color:#64748b;font-size:12px;padding:6px 0 0;border-top:1px dashed #e2e8f0;margin-top:4px}
.tp-actions{display:flex;gap:6px;margin-top:10px}
.tp-cta{flex:1;text-align:center;text-decoration:none;font-weight:600;color:#fff;background:${CONFIG.brand};padding:8px 10px;border-radius:9px}
.tp-cta:hover{background:${CONFIG.brandDark}}
.tp-watch{all:unset;cursor:pointer;font-weight:600;font-size:12.5px;color:${CONFIG.brand};border:1.5px solid ${CONFIG.brand};padding:6px 10px;border-radius:9px;white-space:nowrap}
.tp-watch.on{background:#fef3c7;border-color:#f59e0b;color:#92400e}
.tp-links{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:8px;font-size:12px}
.tp-links a,.tp-links button{all:unset;cursor:pointer;color:${CONFIG.brand}}
.tp-links a:hover,.tp-links button:hover{text-decoration:underline}
.tp-links button{color:#64748b}
.tp-foot{margin:8px 0 0;font-size:10.5px;color:#94a3b8}
`;
