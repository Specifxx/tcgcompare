// The toolbar popup. On opening it shows the product on the current tab when it can tell which one it is (the
// TCGplayer id in the address, or, through activeTab, what the page says it sells, matched inside the extension),
// then today's deals, the watchlist and search. The price file and the matching live in the service worker, so the
// popup opens without loading the whole file.
(async () => {
  const $ = (id) => document.getElementById(id);
  document.documentElement.style.setProperty("--brand", CONFIG.brand);
  document.head.append(Object.assign(document.createElement("style"), { textContent: CARD_CSS }));
  $("brand").textContent = CONFIG.short;
  $("about").href = tagged(CONFIG.page, "popup-about");
  const send = (m) => chrome.runtime.sendMessage(m).catch(() => null);
  const settings = await getSettings();
  for (const m of MARKETS) $("market").append(new Option(MARKET_LABEL[m], m, false, m === settings.market));
  const market = () => $("market").value;

  // ── Settings ─────────────────────────────────────────────────────────────────────────────────────────────────
  $("panel").checked = settings.panel;
  $("panel").addEventListener("change", () => chrome.storage.sync.set({ panel: $("panel").checked }));
  const hasShops = () => chrome.permissions.contains({ origins: ["https://*/*"] });
  $("shops").checked = settings.shops && (await hasShops());
  async function shopsOn(on) {
    if (on) on = await chrome.permissions.request({ origins: ["https://*/*"] }).catch(() => false);
    else await chrome.permissions.remove({ origins: ["https://*/*"] }).catch(() => {});
    await chrome.storage.sync.set({ shops: on });
    $("shops").checked = on;
    $("shopsTip").hidden = true;
    return on;
  }
  $("shops").addEventListener("change", () => shopsOn($("shops").checked));
  $("shopsTipOn").addEventListener("click", () => shopsOn(true));
  $("notify").checked = await chrome.permissions.contains({ permissions: ["notifications"] });
  $("notify").addEventListener("change", async () => {
    if ($("notify").checked) $("notify").checked = await chrome.permissions.request({ permissions: ["notifications"] }).catch(() => false);
    else await chrome.permissions.remove({ permissions: ["notifications"] }).catch(() => {});
  });

  const status = (t) => ($("status").textContent = t);
  const meta = await send({ type: "meta" });
  if (!meta?.ok) status("Couldn't load prices. Check your connection and try again.");
  else status(`${meta.count.toLocaleString()} products · prices updated ${new Date(meta.generatedAt).toLocaleDateString()}`);
  for (const s of meta?.sites ?? []) {
    const a = Object.assign(document.createElement("a"), { href: tagged(s.url, "popup-sites"), target: "_blank", rel: "noopener", textContent: s.name, title: s.game });
    $("sites").append(a);
  }

  // ── Watching ─────────────────────────────────────────────────────────────────────────────────────────────────
  let watched = new Set();
  async function loadWatched() {
    const w = (await chrome.storage.local.get("watch")).watch ?? {};
    watched = new Set(Object.keys(w));
    $("wCount").textContent = watched.size ? String(watched.size) : "";
  }
  await loadWatched();
  async function watch(id, on) {
    const r = await send({ type: "watch", id, market: market(), on });
    await loadWatched();
    // The first watch offers the drop notification (Chrome asks; it can only be asked from a click like this one).
    if (on && !$("notify").checked && !(await chrome.storage.local.get("askedNotify")).askedNotify) {
      await chrome.storage.local.set({ askedNotify: true });
      $("notify").checked = await chrome.permissions.request({ permissions: ["notifications"] }).catch(() => false);
    }
    return r?.on ?? false;
  }

  // ── Lists ────────────────────────────────────────────────────────────────────────────────────────────────────
  function rowsOf(packs, res, from, opts = {}) {
    const ul = $("results");
    ul.textContent = "";
    const m = market();
    const cur = res?.currency?.[m] ?? "USD";
    for (const pk of packs) {
      if (!pk) continue;
      const it = pk.it;
      const a = Object.assign(document.createElement("a"), { className: "row", href: tagged(res.home + it.u, from), target: "_blank", rel: "noopener" });
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = it.n;
      const sm = document.createElement("small");
      const c = it.p[m];
      const pct = m === "US" && c != null && it.m ? Math.round((1 - c / it.m) * 100) : 0;
      if (opts.watch && pk.w) {
        const wc = pk.w.c;
        const d = pk.w.drop && !pk.w.drop.seen ? pk.w.drop : null;
        sm.textContent = d ? "" : wc != null && c != null && c < wc ? `${money(wc - c, cur)} under the price when you started watching` : wc != null ? `${money(wc, cur)} when you started watching` : "Not in stock when you started watching";
        if (d) {
          const sv = Object.assign(document.createElement("span"), { className: "drop", textContent: d.from == null ? "Back in stock" : `Dropped from ${money(d.from, cur)}` });
          sm.append(sv);
        }
      } else {
        sm.textContent = [pk.line?.name, it.s ? `${it.s} stores` : null, it.pre ? "pre-order" : null].filter(Boolean).join(" · ");
        if (pct >= 5) sm.append(Object.assign(document.createElement("span"), { className: "save", textContent: ` · ${pct}% under TCGplayer` }));
      }
      n.append(sm);
      const p = document.createElement("span");
      p.className = c != null ? "p" : "p none";
      p.textContent = c != null ? money(c, cur) : `none in ${MARKET_LABEL[m]}`;
      if (pct >= 5 && it.m != null) p.append(Object.assign(document.createElement("s"), { textContent: money(it.m, "USD") }));
      a.append(n, p);
      const li = document.createElement("li");
      li.append(a);
      const b = it.b?.[m];
      if (b && c != null) {
        li.append(Object.assign(document.createElement("a"), { className: "buy", href: goUrl(res.home, b[1], b[0], m, pk.id, `${from}-buy`), target: "_blank", rel: "noopener sponsored", textContent: "Buy", title: `Buy at ${pk.stores?.[b[0]] ?? "the store"}` }));
      }
      if (opts.watch) {
        const rm = Object.assign(document.createElement("button"), { className: "rm", type: "button", textContent: "×", title: "Stop watching" });
        rm.addEventListener("click", async () => {
          await watch(pk.id, false);
          li.remove();
          if (!watched.size) status("Nothing watched. Press ☆ Watch price on a product to get told when it drops.");
        });
        li.append(rm);
      }
      ul.append(li);
    }
  }

  let tab = "deals";
  function selectTab(t) {
    tab = t;
    $("tDeals").setAttribute("aria-selected", String(t === "deals"));
    $("tWatch").setAttribute("aria-selected", String(t === "watch"));
  }
  async function showDeals() {
    selectTab("deals");
    const r = await send({ type: "deals", market: market() });
    if (!r?.ok) return;
    rowsOf(r.rows, r, "popup-deals");
    status(market() === "US" ? "Today's biggest store prices under TCGplayer's market price" : `Most stocked in ${MARKET_LABEL[market()]} today`);
  }
  async function showWatch() {
    selectTab("watch");
    const r = await send({ type: "watched" });
    if (!r?.ok) return;
    rowsOf(r.rows, r, "popup-watch", { watch: true });
    status(r.rows.length ? "We check every price update and tell you when a watched price drops." : "Nothing watched. Press ☆ Watch price on a product to get told when it drops.");
    send({ type: "seen" });
  }
  let t = 0;
  async function run() {
    const q = $("q").value.trim();
    if (!q) return tab === "watch" ? showWatch() : showDeals();
    const r = await send({ type: "search", q, market: market() });
    if (!r?.ok) return;
    rowsOf(r.rows, r, "popup-search");
    status(r.rows.length ? `${r.rows.length} match${r.rows.length === 1 ? "" : "es"} · tap one to compare every store` : `No match for “${q}”. Try fewer words.`);
  }
  $("q").addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(run, 120);
  });
  $("f").addEventListener("submit", (e) => {
    e.preventDefault();
    run();
  });
  $("tDeals").addEventListener("click", () => (($("q").value = ""), showDeals()));
  $("tWatch").addEventListener("click", () => (($("q").value = ""), showWatch()));
  $("market").addEventListener("change", async () => {
    await chrome.storage.sync.set({ market: market() });
    run();
    findOnPage();
  });

  // ── What is this page selling? ───────────────────────────────────────────────────────────────────────────────
  async function currentTab() {
    const forced = Number(new URLSearchParams(location.search).get("tab")); // for testing the popup in a tab
    if (forced) return chrome.tabs.get(forced).catch(() => null);
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    return t ?? null;
  }
  async function readPage(t) {
    if (!/^https?:/.test(t?.url ?? "") || !chrome.scripting) return null;
    try {
      await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["pageinfo.js"] });
      const [r] = await chrome.scripting.executeScript({ target: { tabId: t.id }, func: () => globalThis.__tcgpxRead?.() ?? null });
      return r?.result ?? null;
    } catch {
      return null; // a page the browser will not let extensions read (the Web Store, settings, PDFs)
    }
  }

  async function findOnPage() {
    const t = await currentTab();
    const here = $("here");
    if (!/^https?:/.test(t?.url ?? "")) return (here.hidden = true);
    const onTcg = /^https:\/\/(www\.)?tcgplayer\.com\//.test(t.url);
    const id = t.url.match(/tcgplayer\.com\/product\/(\d{3,9})/i)?.[1];
    const info = await readPage(t);
    // On TCGplayer, only this product's own lowest listing counts as the page's price (it is a single-page app).
    if (info && id && !info.price?.url?.includes(`/product/${id}`)) info.price = null;
    let r;
    if (id) r = await send({ type: "item", id });
    else if (info) r = await send({ type: "match", info, market: market() });
    $("hereBody").textContent = "";
    if (r?.ok && r.pack) {
      $("hereTitle").textContent = "On this page";
      $("hereBody").append(
        buildCard({ pack: r.pack, market: market(), currency: r.currency, home: r.home, page: info?.price ?? null, onTcg, watching: watched.has(r.pack.id), from: "popup" }, { watch: (on) => watch(r.pack.id, on) }),
      );
      here.hidden = false;
      // Matched without the shop check on: offer it, once per popup, never on TCGplayer (its panel is on already).
      $("shopsTip").hidden = onTcg || $("shops").checked;
      return;
    }
    $("shopsTip").hidden = true;
    if (r?.res?.single) {
      $("hereTitle").textContent = "On this page";
      $("hereBody").append(Object.assign(document.createElement("p"), { className: "muted", textContent: "This looks like a single card. We compare sealed product: boxes, packs, bundles, decks and tins." }));
      here.hidden = false;
      return;
    }
    if (r?.top?.length) {
      $("hereTitle").textContent = r.res?.foreign ? "Foreign-language page · closest English products" : "Is it one of these?";
      const ul = document.createElement("ul");
      ul.className = "close";
      for (const pk of r.top.slice(0, 4)) {
        const cur = r.currency[market()] ?? "USD";
        const li = document.createElement("li");
        li.append(Object.assign(document.createElement("a"), { className: "row", href: tagged(r.home + pk.it.u, "popup-close"), target: "_blank", rel: "noopener" }));
        li.firstChild.append(Object.assign(document.createElement("span"), { className: "n", textContent: pk.it.n }), Object.assign(document.createElement("span"), { className: "p", textContent: pk.it.p[market()] != null ? money(pk.it.p[market()], cur) : "—" }));
        ul.append(li);
      }
      $("hereBody").append(ul);
      here.hidden = false;
      return;
    }
    here.hidden = true;
  }

  await showDeals();
  $("q").focus();
  findOnPage();
})();
