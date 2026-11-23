// The on-page price panel. On TCGplayer product pages (manifest content_scripts) it reads the TCGplayer product id
// from the page's own URL: an exact id, never a guess. On other shops it runs only after the visitor turns on "Price
// check on other shops" and grants that permission (background.js registers it then): it reads what the page says it
// sells (pageinfo.js), and shows a small panel only when the matcher is sure which product it is.
//
// It changes nothing on the page: no link on the page is read or touched, and the only links it adds are its own
// buttons (our product page, or a store through our /go route). It starts small on other shops (one line, opened on
// a click), and closes for the page with ×, or for the whole site.
(() => {
  if (window.__tcgpxPanel) return;
  window.__tcgpxPanel = true;
  const onTcg = /(^|\.)tcgplayer\.com$/.test(location.hostname);

  let shownFor = null;
  let host = null;
  let tries = 0;

  const idFromUrl = (href) => href.match(/tcgplayer\.com\/product\/(\d{3,9})(?:[/?#]|$)/i)?.[1] ?? null;
  const send = (m) => chrome.runtime.sendMessage(m).catch(() => null);
  const local = async (k, d) => (await chrome.storage.local.get(k))[k] ?? d;

  function remove() {
    host?.remove();
    host = null;
  }

  async function check() {
    const settings = await getSettings();
    const key = onTcg ? idFromUrl(location.href) : location.href.split("#")[0];
    if (key === shownFor) return;
    if (!key) {
      shownFor = null;
      remove();
      return;
    }
    if (onTcg ? !settings.panel : !settings.shops) return;
    if (!onTcg && (await local("hiddenHosts", [])).includes(location.hostname)) return;
    if (onTcg && (await local("dismissed", [])).includes(key)) return;

    let info = globalThis.__tcgpxRead?.() ?? null;
    // TCGplayer draws its product data after the page: wait a few seconds for this product's own lowest listing.
    const tcgPrice = (i) => (i?.price?.url?.includes(`/product/${key}`) ? i.price : null);
    if (onTcg) {
      for (let n = 0; n < 8 && !tcgPrice(info); n++) {
        await new Promise((r) => setTimeout(r, 500));
        info = globalThis.__tcgpxRead?.() ?? null;
      }
      if (info) info.price = tcgPrice(info);
    }
    let res;
    if (onTcg) {
      res = await send({ type: "item", id: key });
    } else {
      if (!info?.product) return retry(); // not a product page (yet: shops that draw the page late get two more looks)
      res = await send({ type: "match", info, market: settings.market });
    }
    if (!res?.ok || !res.pack) return onTcg ? null : retry();
    if ((onTcg ? idFromUrl(location.href) : location.href.split("#")[0]) !== key) return;
    shownFor = key;
    remove();
    const watching = !!(await local("watch", {}))[res.pack.id];
    const min = onTcg ? await local("panelMin", false) : true;
    render(res, settings.market, info?.price ?? null, watching, min);
    const h = headline(res.pack, settings.market, res.currency, info?.price ?? null, onTcg);
    send({ type: "badge", text: h.badge, tone: h.tone });
  }

  function retry() {
    if (++tries <= 2) setTimeout(check, 2500 * tries);
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

  function render(res, market, page, watching, minimized) {
    const { pack } = res;
    host = el("div");
    host.style.cssText = "all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646;";
    const root = host.attachShadow({ mode: "closed" });
    root.append(el("style", { text: CARD_CSS + PANEL_CSS }));

    const shell = el("div", { class: "panel", role: "complementary", "aria-label": `${CONFIG.short} price check` });
    const closeBtn = () => {
      const x = el("button", { class: "ic", type: "button", "aria-label": "Close", title: "Close" });
      x.textContent = "×";
      x.addEventListener("click", async () => {
        remove();
        if (!onTcg) return; // other shops: closed for this page only ("Hide on this site" is in the panel)
        try {
          const s = await local("dismissed", []);
          await chrome.storage.local.set({ dismissed: [...s.filter((v) => v !== pack.id), pack.id].slice(-300) });
        } catch {}
      });
      return x;
    };
    const mini = el("button", { class: "ic", type: "button", "aria-label": "Minimise", title: "Minimise" });
    mini.textContent = "–";

    const h = headline(pack, market, res.currency, page, onTcg);
    const pill = el("button", { type: "button", class: `pill ${h.tone}`, title: "Show prices" }, el("img", { src: CONFIG.icon, alt: "" }), el("span", { text: h.text }), el("i", { text: "▸" }));

    const card = buildCard(
      { pack, market, currency: res.currency, home: res.home, page, onTcg, watching, from: onTcg ? "panel" : "shop", title: !onTcg },
      {
        watch: async (on) => (await send({ type: "watch", id: pack.id, market, on }))?.on ?? false,
        hideSite: onTcg
          ? null
          : async () => {
              remove();
              const s = await local("hiddenHosts", []);
              await chrome.storage.local.set({ hiddenHosts: [...new Set([...s, location.hostname])].slice(-200) });
            },
      },
    );
    const head = el("div", { class: "head" }, el("img", { src: CONFIG.icon, alt: "" }), el("b", { text: `${CONFIG.short} · ${MARKET_LABEL[market]}` }), mini, closeBtn());
    const full = el("div", { class: "full" }, head, card);

    const show = (small) => {
      shell.textContent = "";
      if (small) shell.append(pill, closeBtn());
      else shell.append(full);
      shell.classList.toggle("small", small);
      if (onTcg) chrome.storage.local.set({ panelMin: small }).catch(() => {});
    };
    pill.addEventListener("click", () => show(false));
    mini.addEventListener("click", () => show(true));
    show(minimized);
    root.append(shell);
    document.documentElement.append(host);
  }

  const PANEL_CSS = `
    .panel{font:13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a;background:#fff;border-radius:14px;
      box-shadow:0 10px 30px rgba(2,6,23,.22),0 0 0 1px rgba(2,6,23,.08);box-sizing:border-box}
    .full{width:300px;padding:10px 14px 10px}
    .panel.small{display:flex;align-items:center;border-radius:99px;padding:0 4px 0 0}
    .head{display:flex;align-items:center;gap:6px;margin-bottom:8px}
    .head img{width:18px;height:18px;border-radius:5px}
    .head b{font-size:12px;flex:1;color:#475569}
    .ic{all:unset;cursor:pointer;font-size:18px;line-height:1;color:#64748b;padding:2px 5px;border-radius:6px}
    .ic:hover{color:#0f172a;background:#f1f5f9}
    .pill{all:unset;cursor:pointer;display:flex;align-items:center;gap:8px;padding:8px 6px 8px 10px;font-weight:600;font-size:13px;max-width:320px}
    .pill img{width:20px;height:20px;border-radius:5px}
    .pill span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pill i{font-style:normal;color:#94a3b8}
    .pill.save span{color:#166534}
    .pill.ok span{color:#047857}
  `;

  check();
  // Single-page shops (TCGplayer among them) change the URL without a page load.
  let last = location.href;
  setInterval(() => {
    if (location.href !== last) {
      last = location.href;
      tries = 0;
      check();
    }
  }, 800);
})();
