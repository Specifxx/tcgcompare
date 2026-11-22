// The toolbar popup: search our price file, pick a market, turn the panel on or off. "Find the product on this page"
// reads only the current tab's title, and only when the visitor presses it (activeTab), to fill the search box: the
// results are search matches for them to choose from, never a claim that the page is that product.
(async () => {
  const $ = (id) => document.getElementById(id);
  document.documentElement.style.setProperty("--brand", CONFIG.brand);
  $("brand").textContent = CONFIG.short;
  $("about").href = tagged(CONFIG.page, "popup-about");
  const settings = await getSettings();
  for (const m of MARKETS) $("market").append(new Option(MARKET_LABEL[m], m, false, m === settings.market));
  $("panel").checked = settings.panel;
  $("panel").addEventListener("change", () => chrome.storage.sync.set({ panel: $("panel").checked }));

  let feed = null;
  let index = null;
  const status = (t) => ($("status").textContent = t);
  status("Loading prices…");
  try {
    const res = await chrome.runtime.sendMessage({ type: "feed" });
    if (!res?.ok) throw new Error(res?.error || "no feed");
    feed = res.feed;
    index = Object.entries(feed.items).map(([id, it]) => ({ id, it, hay: fold(`${it.n} ${feed.lines[it.g]?.name ?? ""}`) }));
    status(`${index.length.toLocaleString()} products · updated ${new Date(feed.generatedAt).toLocaleDateString()}`);
  } catch (e) {
    status("Couldn't load prices. Check your connection and try again.");
  }

  function fold(s) {
    return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/elite trainer box/g, "etb").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function search(q) {
    const words = fold(q).split(" ").filter((w) => w.length > 1 || /\d/.test(w));
    if (!words.length || !index) return [];
    const market = $("market").value;
    const scored = [];
    for (const row of index) {
      let hit = 0;
      for (const w of words) if (row.hay.includes(w)) hit++;
      if (hit < Math.max(1, Math.ceil(words.length * 0.6))) continue;
      // Fewer words the visitor did not type ranks first: "destined rivals etb" puts the ETB above the ETB case.
      const extra = row.hay.split(" ").filter((h) => !words.some((w) => h.startsWith(w))).length;
      scored.push({ row, s: hit * 10 - extra * 1.5 + (row.it.p[market] != null ? 3 : 0) + Math.log10(1 + (row.it.m ?? 0)) * 0.5 });
    }
    return scored.sort((a, b) => b.s - a.s).slice(0, 25).map((x) => x.row);
  }

  function show(rows, emptyText, title = "") {
    const ul = $("results");
    ul.textContent = "";
    $("listTitle").textContent = title;
    const market = $("market").value;
    const cur = feed?.currency?.[market] ?? "USD";
    for (const { id, it } of rows) {
      const a = document.createElement("a");
      a.className = "row";
      a.href = tagged(feed.home + it.u, title ? "popup-deals" : "popup-search");
      a.target = "_blank";
      a.rel = "noopener";
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = it.n;
      const sm = document.createElement("small");
      const c = it.p[market];
      const pct = market === "US" && c != null && it.m ? Math.round((1 - c / it.m) * 100) : 0;
      sm.textContent = [feed.lines[it.g]?.name, it.s ? `${it.s} stores in stock` : null, it.pre ? "pre-order" : null].filter(Boolean).join(" · ");
      if (pct >= 5) {
        const sv = document.createElement("span");
        sv.className = "save";
        sv.textContent = ` · ${pct}% under TCGplayer`;
        sm.append(sv);
      }
      n.append(sm);
      const p = document.createElement("span");
      p.className = c != null ? "p" : "p none";
      p.textContent = c != null ? money(c, cur) : `none in ${MARKET_LABEL[market]}`;
      a.append(n, p);
      const li = document.createElement("li");
      li.append(a);
      const b = it.b?.[market];
      if (b && c != null) {
        const buy = document.createElement("a");
        buy.className = "buy";
        buy.href = goUrl(feed.home, b[1], b[0], market, id, title ? "popup-deals-buy" : "popup-buy");
        buy.target = "_blank";
        buy.rel = "noopener sponsored";
        buy.textContent = "Buy";
        buy.title = `Buy at ${feed.stores?.[b[0]] ?? "the store"}`;
        li.append(buy);
      }
      ul.append(li);
    }
    if (!rows.length && emptyText) status(emptyText);
  }

  /** With the search box empty: today's best store prices under TCGplayer's market (US), else the most stocked products. */
  function deals() {
    if (!index) return;
    const market = $("market").value;
    let rows;
    if (market === "US") {
      rows = index
        .filter(({ it }) => it.p.US != null && it.m && it.m >= 2000 && it.s >= 3 && !it.pre && it.p.US < it.m * 0.9 && it.p.US > it.m * 0.4)
        .sort((a, b) => a.it.p.US / a.it.m - b.it.p.US / b.it.m)
        .slice(0, 12);
      show(rows, "", "Today's deals under TCGplayer market");
    } else {
      rows = index.filter(({ it }) => it.p[market] != null && !it.pre).sort((a, b) => b.it.s - a.it.s).slice(0, 12);
      show(rows, "", `Most stocked in ${MARKET_LABEL[market]}`);
    }
  }

  for (const s of feed?.sites ?? []) {
    const a = document.createElement("a");
    a.href = tagged(s.url, "popup-sites");
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = s.name;
    a.title = s.game;
    $("sites").append(a);
  }

  let t = 0;
  const run = () => {
    const q = $("q").value;
    if (!q.trim()) return deals();
    const rows = search(q);
    show(rows, q.trim() ? `No match for “${q.trim()}”. Try fewer words.` : "");
    if (rows.length) status(`${rows.length} match${rows.length === 1 ? "" : "es"} · tap one to compare every store`);
  };
  $("q").addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(run, 120);
  });
  $("f").addEventListener("submit", (e) => {
    e.preventDefault();
    run();
  });
  $("market").addEventListener("change", async () => {
    await chrome.storage.sync.set({ market: $("market").value });
    run();
  });
  $("page").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const id = tab?.url?.match(/tcgplayer\.com\/product\/(\d{3,9})/i)?.[1];
    if (id && feed?.items[id]) return show([{ id, it: feed.items[id] }]);
    const title = (tab?.title ?? "")
      .replace(/\s*[|\-–—]\s*(eBay|TCGplayer|Amazon\.[a-z.]+|Amazon).*$/i, "")
      .replace(/\b(new|sealed|free shipping|in stock|buy now|english)\b/gi, " ")
      .slice(0, 120);
    $("q").value = title.trim();
    run();
  });
  deals();
  $("q").focus();
})();
