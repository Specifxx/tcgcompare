// Runs on TCGplayer product pages only (manifest content_scripts). Reads the TCGplayer product id from the page's own
// URL and, when our price file has that exact id, shows a small panel with the cheapest store price we track. No id,
// no panel: it never guesses a product from a title. It reads nothing else on the page and changes nothing on it:
// no link on TCGplayer is touched, and the only links it adds are to our own product page.
(() => {
  if (window.__tcgpxPanel) return;
  window.__tcgpxPanel = true;

  let shownFor = null;
  let host = null;

  const idFromUrl = (href) => href.match(/tcgplayer\.com\/product\/(\d{3,9})(?:[/?#]|$)/i)?.[1] ?? null;

  function remove() {
    host?.remove();
    host = null;
  }

  async function check() {
    const id = idFromUrl(location.href);
    if (id === shownFor) return;
    shownFor = id;
    remove();
    if (!id) return;
    const settings = await getSettings();
    if (!settings.panel) return;
    const dismissed = (await chrome.storage.local.get("dismissed")).dismissed ?? [];
    if (dismissed.includes(id)) return;
    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: "lookup", id });
    } catch {
      return;
    }
    if (!res?.ok || !res.item || idFromUrl(location.href) !== id) return;
    render(id, res, settings.market);
  }

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const k of kids) if (k) e.append(k);
    return e;
  }

  function render(id, res, market) {
    const { item, line, currency } = res;
    const cur = currency[market] ?? "USD";
    const store = item.p?.[market] ?? null;
    // Elsewhere: the markets that do have a store price, when the visitor's own has none.
    const others = Object.keys(item.p ?? {}).filter((m) => m !== market);
    const ref = item.m; // TCGplayer market, US cents
    const pageUrl = tagged(res.home + item.u, "panel");

    host = el("div");
    host.style.cssText = "all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646;";
    const root = host.attachShadow({ mode: "closed" });
    root.append(el("style", { text: CSS }));

    const close = el("button", { class: "x", type: "button", "aria-label": "Close", title: "Close" });
    close.textContent = "×";
    close.addEventListener("click", async () => {
      remove();
      try {
        const s = (await chrome.storage.local.get("dismissed")).dismissed ?? [];
        await chrome.storage.local.set({ dismissed: [...s.filter((x) => x !== id), id].slice(-300) });
      } catch {}
    });

    const head = el("div", { class: "head" }, el("img", { src: chrome.runtime.getURL("icons/32.png"), alt: "" }), el("b", { text: CONFIG.short }), close);

    const rows = el("div", { class: "rows" });
    if (store != null) {
      rows.append(
        el(
          "div",
          { class: "big" },
          el("span", { class: "lbl", text: `${item.pre ? "Cheapest pre-order" : "Cheapest store"} · ${MARKET_LABEL[market]}` }),
          el("span", { class: "price", text: money(store, cur) }),
        ),
      );
    } else {
      rows.append(el("div", { class: "none", text: `No store has it in stock in ${MARKET_LABEL[market]} today.${others.length ? ` In stock in ${others.map((m) => MARKET_LABEL[m]).join(", ")}.` : ""}` }));
    }
    if (ref != null) rows.append(el("div", { class: "row" }, el("span", { text: market === "US" ? "TCGplayer market price" : "TCGplayer market (US)" }), el("span", { text: money(ref, "USD") })));
    if (market === "US" && store != null && ref != null && store < ref) {
      const pct = Math.round((1 - store / ref) * 100);
      if (pct >= 3) rows.append(el("div", { class: "save", text: `${pct}% under TCGplayer market` }));
    }
    if (item.s > 0) rows.append(el("div", { class: "row muted" }, el("span", { text: `In stock at ${item.s} ${item.s === 1 ? "store" : "stores"} worldwide` })));

    const btns = [];
    const buy = item.b?.[market];
    if (buy && store != null) {
      // The cheapest store's own listing, through our /go link (logs the click, adds the store's affiliate tag if it has one).
      const a = el("a", { class: "cta", href: goUrl(res.home, buy[1], buy[0], market, id, "panel-buy"), target: "_blank", rel: "noopener sponsored" });
      a.textContent = `Buy at ${res.stores?.[buy[0]] ?? "the store"} · ${money(store, cur)}`;
      btns.push(a);
    }
    const cmp = el("a", { class: buy ? "cta2" : "cta", href: pageUrl, target: "_blank", rel: "noopener" });
    cmp.textContent = item.s > 1 ? `Compare all ${item.s} stores →` : "Compare stores on " + CONFIG.short + " →";
    btns.push(cmp);
    if (line?.sister) {
      const name = item.n.replace(/\s+/g, " ").slice(0, 100);
      const href = line.sister.search ? line.sister.search.replace("{q}", encodeURIComponent(name)) : line.sister.url;
      const a = el("a", { class: "cta2", href: tagged(href, "panel-sister"), target: "_blank", rel: "noopener" });
      a.textContent = `See it on ${line.sister.name} →`;
      btns.push(a);
    }
    const eb = ebaySearch(market, `${line?.ebay ?? ""} ${item.n}`.trim());
    if (eb) {
      const a = el("a", { class: "sis", href: goUrl(res.home, eb, "ebay", market, id, "panel-ebay"), target: "_blank", rel: "noopener sponsored" });
      a.textContent = "Check eBay listings (Ad)";
      btns.push(a);
    }

    const foot = el("div", { class: "foot", text: "Prices from our last daily update. Buy and eBay buttons are affiliate links: we may earn a commission, at no cost to you." });
    root.append(el("div", { class: "card", role: "complementary", "aria-label": `${CONFIG.short} price check` }, head, rows, ...btns, foot));
    document.documentElement.append(host);
  }

  const CSS = `
    .card{font:13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;background:#fff;width:272px;border-radius:14px;
      box-shadow:0 10px 30px rgba(2,6,23,.22),0 0 0 1px rgba(2,6,23,.08);padding:12px 14px 10px;box-sizing:border-box}
    .head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
    .head img{width:20px;height:20px;border-radius:5px}
    .head b{font-size:13px;flex:1}
    .x{all:unset;cursor:pointer;font-size:20px;line-height:1;color:#64748b;padding:0 4px}
    .x:hover{color:#0f172a}
    .big{display:flex;flex-direction:column;margin-bottom:6px}
    .lbl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
    .price{font-size:24px;font-weight:700;color:${CONFIG.brand}}
    .row{display:flex;justify-content:space-between;gap:8px;padding:2px 0}
    .muted{color:#64748b}
    .none{color:#334155;margin-bottom:6px}
    .save{display:inline-block;margin:4px 0;padding:2px 8px;border-radius:99px;background:#dcfce7;color:#166534;font-weight:600;font-size:12px}
    .cta{display:block;margin-top:10px;text-align:center;background:${CONFIG.brand};color:#fff;text-decoration:none;font-weight:600;padding:9px 10px;border-radius:10px}
    .cta:hover{background:${CONFIG.brandDark}}
    .cta2{display:block;margin-top:6px;text-align:center;background:#fff;color:${CONFIG.brand};border:1.5px solid ${CONFIG.brand};text-decoration:none;font-weight:600;padding:7px 10px;border-radius:10px}
    .cta2:hover{background:#eef2ff}
    .sis{display:block;margin-top:6px;text-align:center;color:${CONFIG.brand};text-decoration:none;font-size:12px}
    .sis:hover{text-decoration:underline}
    .foot{margin-top:8px;font-size:10.5px;color:#94a3b8}
  `;

  check();
  // TCGplayer is a single-page app: a product opened from search changes the URL without a page load.
  let last = location.href;
  setInterval(() => {
    if (location.href !== last) {
      last = location.href;
      check();
    }
  }, 800);
})();
