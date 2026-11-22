// The toolbar popup: search our price file, pick a market, turn the panel on or off. On opening (and from "Find the
// product on this page") it reads the current tab's title, product name and barcode (activeTab: only the tab the
// visitor opened it on) and names the product only when match.js is sure; otherwise it lists the closest products for
// the visitor to pick from.
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
    index = Object.entries(feed.items).map(([id, it]) => ({ id, it, hay: fold(`${it.n} ${feed.lines[it.g]?.name ?? ""} ${it.t ?? ""} ${it.k ?? ""}`) }));
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
  // ── What is this page selling? ─────────────────────────────────────────────────────────────────────────
  // Only when the visitor opens the popup or presses the button (activeTab): the tab's title and, on a normal web
  // page, the product's own name and barcode as the page states them (its product data, share title and heading).
  // Nothing is sent anywhere: the match is made here, against the price file already in the browser.
  const matcher = index ? makeMatcher(feed) : null;

  async function readPage(tab) {
    if (!/^https?:/.test(tab?.url ?? "") || !chrome.scripting) return null;
    try {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const names = [];
          const gtins = [];
          const walk = (x) => {
            if (!x || typeof x !== "object") return;
            if (Array.isArray(x)) return x.forEach(walk);
            const t = [].concat(x["@type"] ?? []).map(String);
            if (t.some((y) => /^(Product|ProductGroup|IndividualProduct)$/i.test(y))) {
              if (typeof x.name === "string") names.push(x.name);
              for (const k of ["gtin", "gtin13", "gtin12", "gtin14", "gtin8", "ean", "upc"]) if (x[k]) gtins.push(String(x[k]));
              for (const o of [].concat(x.offers ?? [], x.hasVariant ?? [])) for (const k of ["gtin", "gtin13", "gtin12", "gtin14", "gtin8"]) if (o?.[k]) gtins.push(String(o[k]));
            }
            if (x["@graph"]) walk(x["@graph"]);
          };
          for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
            try { walk(JSON.parse(el.textContent)); } catch {}
          }
          const meta = (k) => document.querySelector(`meta[property="${k}"],meta[name="${k}"]`)?.content ?? "";
          return { names: names.slice(0, 3), gtins: gtins.slice(0, 10), og: meta("og:title"), h1: document.querySelector("h1")?.textContent?.trim().slice(0, 200) ?? "" };
        },
      });
      return r?.result ?? null;
    } catch {
      return null; // a page the browser will not let extensions read (the Web Store, settings, PDFs)
    }
  }

  async function findOnPage(fromButton) {
    if (!matcher) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const id = tab?.url?.match(/tcgplayer\.com\/product\/(\d{3,9})/i)?.[1];
    if (id && feed.items[id]) {
      show([{ id, it: feed.items[id] }], "", "On this page");
      return status("Tap it to compare every store, or Buy to go to the cheapest.");
    }
    if (!/^https?:/.test(tab?.url ?? "")) return fromButton && status("Open a product page in a store, then press the button.");
    const page = (await readPage(tab)) ?? {};
    const market = $("market").value;
    const texts = [...(page.names ?? []), page.og, page.h1, tab.title].filter((t) => t && t.trim().length > 3);
    let res = null;
    for (const t of texts) {
      const r = matcher(t, market, page.gtins ?? []);
      if (r.sure) { res = r; break; }
      res ??= r;
      if (r.single) break;
    }
    if (res?.sure) {
      show([{ id: res.sure, it: feed.items[res.sure] }], "", "On this page");
      return status(res.by === "barcode" ? "Matched by the barcode on the page. Tap to compare every store." : "Tap it to compare every store, or Buy to go to the cheapest.");
    }
    if (res?.single) {
      if (!fromButton) return;
      show([], "");
      return status("This looks like a single card. We compare sealed product only: boxes, packs, bundles, decks and tins.");
    }
    // Closest matches only when the page names a kind of sealed product (a box, a pack, a deck…): a card, an
    // accessory or an event has no near match worth showing.
    const rows = res?.kind ? (res.top ?? []).slice(0, 6).map((i) => ({ id: i, it: feed.items[i] })) : [];
    if (!rows.length) return fromButton && status("We couldn't tell which sealed product this page is. We compare sealed product only; try searching for it above.");
    show(rows, "", res.foreign ? "Closest English products" : "Closest matches");
    status(res.foreign ? "This page looks like a foreign-language product; we price English product. Pick the one you mean." : "Not sure which one this page is. Pick the one you mean.");
  }

  $("page").addEventListener("click", () => findOnPage(true));
  deals();
  $("q").focus();
  // Opening the popup on a product page shows that product straight away.
  findOnPage(false);
})();
