// Service worker. Keeps one copy of the site's static price file (CONFIG.feed) for 12 hours and answers the content
// script and the popup from it: product lookups, page matching (match.js), search, deals and the watchlist. It sends
// nothing about the visitor anywhere: the only request it makes is a plain GET of that public file, with no cookies.
// Matching happens here, against that file, so what a page says never leaves the browser.
importScripts("config.js", "shared.js", "match.js");

const TTL_MS = 12 * 60 * 60 * 1000;
let memo = null; // { at, feed }
let inflight = null;

async function loadFeed(force = false) {
  if (!force && memo && Date.now() - memo.at < TTL_MS) return memo.feed;
  if (!force) {
    const stored = await chrome.storage.local.get("feedCache");
    const c = stored.feedCache;
    if (c && c.feed && Date.now() - c.at < TTL_MS) {
      memo = c;
      return c.feed;
    }
  }
  inflight ??= (async () => {
    try {
      const r = await fetch(CONFIG.feed, { credentials: "omit", cache: "no-cache" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const feed = await r.json();
      if (!feed || feed.v !== 1 || typeof feed.items !== "object") throw new Error("bad feed");
      memo = { at: Date.now(), feed };
      await chrome.storage.local.set({ feedCache: memo });
      checkWatches(feed).catch(() => {}); // a new day's prices: tell the visitor about any watched drop
      return feed;
    } catch (e) {
      // Offline or the site is down: an old copy is better than nothing, and it says how old it is.
      const stored = await chrome.storage.local.get("feedCache");
      if (stored.feedCache?.feed) return (memo = stored.feedCache).feed;
      throw e;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// ── Per-feed indexes, built once per feed ──────────────────────────────────────────────────────────────────────
let built = null; // { feed, match, index, own }
function indexes(feed) {
  if (built?.feed === feed) return built;
  const sfold = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/elite trainer box/g, "etb").replace(/[^a-z0-9]+/g, " ").trim();
  const index = Object.entries(feed.items).map(([id, it]) => ({ id, it, hay: sfold(`${it.n} ${feed.lines[it.g]?.name ?? ""} ${it.t ?? ""} ${it.k ?? ""}`) }));
  const own = new Set([feed.home, ...(feed.sites ?? []).map((s) => s.url)].map((u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } }));
  built = { feed, match: makeMatcher(feed), index, own, sfold };
  return built;
}

/** One product with what a card needs: its game and the names of the stores it lists. */
function pack(feed, id) {
  const it = feed.items[String(id)];
  if (!it) return null;
  const keys = new Set([...Object.values(it.b ?? {}).map((x) => x[0]), ...Object.values(it.r ?? {}).flatMap((l) => l.map((x) => x[0]))]);
  return { id: String(id), it, line: it.g ? feed.lines[it.g] ?? null : null, stores: Object.fromEntries([...keys].map((k) => [k, feed.stores?.[k] ?? k])) };
}
const base = (feed) => ({ currency: feed.currency, home: feed.home, generatedAt: feed.generatedAt });

/** Which product a page is: the first of its own names, share title, heading and tab title that decides it. */
function matchInfo(feed, info, market) {
  const { match } = indexes(feed);
  const texts = [...(info.names ?? []), info.og, info.h1, info.title].filter((t) => t && String(t).trim().length > 3);
  let res = null;
  for (const t of texts) {
    const r = match(String(t), market, info.gtins ?? []);
    if (r.sure) return r;
    res ??= r;
    if (r.single) break;
  }
  return res ?? { sure: null, top: [] };
}

function search(feed, q, market) {
  const { index, sfold } = indexes(feed);
  const words = sfold(q).split(" ").filter((w) => w.length > 1 || /\d/.test(w));
  if (!words.length) return [];
  const scored = [];
  for (const row of index) {
    let hit = 0;
    for (const w of words) if (row.hay.includes(w)) hit++;
    if (hit < Math.max(1, Math.ceil(words.length * 0.6))) continue;
    // Fewer words the visitor did not type ranks first: "destined rivals etb" puts the ETB above the ETB case.
    const extra = row.hay.split(" ").filter((h) => !words.some((w) => h.startsWith(w))).length;
    scored.push({ row, s: hit * 10 - extra * 1.5 + (row.it.p[market] != null ? 3 : 0) + Math.log10(1 + (row.it.m ?? 0)) * 0.5 });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, 25).map((x) => x.row.id);
}

/** Today's best store prices under TCGplayer's market (US); elsewhere the most stocked products. */
function deals(feed, market) {
  const { index } = indexes(feed);
  if (market === "US") {
    return index
      .filter(({ it }) => it.p.US != null && it.m && it.m >= 2000 && it.s >= 3 && !it.pre && it.p.US < it.m * 0.9 && it.p.US > it.m * 0.4)
      .sort((a, b) => a.it.p.US / a.it.m - b.it.p.US / b.it.m)
      .slice(0, 15)
      .map((x) => x.id);
  }
  return index.filter(({ it }) => it.p[market] != null && !it.pre).sort((a, b) => b.it.s - a.it.s).slice(0, 15).map((x) => x.id);
}

// ── Watchlist: { [id]: { m: market, c: price when added, low: lowest seen since, at, drop?: { from, to, at } } } ───
async function getWatch() {
  return (await chrome.storage.local.get("watch")).watch ?? {};
}
async function setWatch(w) {
  await chrome.storage.local.set({ watch: w });
  await refreshDropBadge(w);
}
async function refreshDropBadge(w) {
  const drops = Object.values(w ?? (await getWatch())).filter((x) => x.drop && !x.drop.seen).length;
  await chrome.action.setBadgeText({ text: drops ? "↓" + (drops > 1 ? drops : "") : "" });
  if (drops) await chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
}

/** After each price update: a watched price that fell 3%+ under the lowest we had seen, or came back in stock. */
async function checkWatches(feed) {
  const w = await getWatch();
  const notify = await chrome.permissions.contains({ permissions: ["notifications"] }).catch(() => false);
  let changed = false;
  for (const [id, x] of Object.entries(w)) {
    const now = feed.items[id]?.p?.[x.m];
    if (now == null) continue;
    const was = x.low;
    if (was == null || (now <= was * 0.97 && was - now >= 100)) {
      x.drop = { from: was, to: now, at: Date.now() };
      changed = true;
      if (notify && chrome.notifications) {
        const cur = feed.currency[x.m] ?? "USD";
        const it = feed.items[id];
        chrome.notifications.create(`w:${id}`, {
          type: "basic",
          iconUrl: "icons/128.png",
          title: was == null ? "Back in stock" : `Price drop: ${money(now, cur)}`,
          message: `${it.n}${was == null ? ` is in stock at ${money(now, cur)}` : `, was ${money(was, cur)}`} (${MARKET_LABEL[x.m]}).`,
        });
      }
    }
    if (x.low == null || now < x.low) (x.low = now), (changed = true);
  }
  if (changed) await setWatch(w);
}

chrome.notifications?.onClicked?.addListener(async (nid) => {
  const id = nid.startsWith("w:") ? nid.slice(2) : null;
  if (!id) return;
  const feed = await loadFeed().catch(() => null);
  const it = feed?.items[id];
  if (it) chrome.tabs.create({ url: tagged(feed.home + it.u, "notification") });
  chrome.notifications.clear(nid);
});

// ── The price check on other shops (opt in: the visitor turns it on in the popup and grants the permission) ─────
const SHOPS = "shops";
async function syncShops() {
  const { shops } = await getSettings();
  const granted = await chrome.permissions.contains({ origins: ["https://*/*"] }).catch(() => false);
  const have = (await chrome.scripting.getRegisteredContentScripts({ ids: [SHOPS] }).catch(() => [])).length > 0;
  if (shops && granted && !have) {
    await chrome.scripting.registerContentScripts([
      {
        id: SHOPS,
        matches: ["https://*/*"],
        excludeMatches: ["https://*.tcgplayer.com/*", "https://tcgplayer.com/*"],
        js: ["config.js", "shared.js", "pageinfo.js", "content.js"],
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    ]);
  } else if ((!shops || !granted) && have) {
    await chrome.scripting.unregisterContentScripts({ ids: [SHOPS] });
  }
  if (shops && !granted) await chrome.storage.sync.set({ shops: false });
}
chrome.permissions.onRemoved.addListener(syncShops);
chrome.storage.onChanged.addListener((c, area) => {
  if (area === "sync" && "shops" in c) syncShops();
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    try {
      const feed = await loadFeed(!!msg?.force);
      switch (msg?.type) {
        case "lookup": // 1.2.x content script
        case "item": {
          const p = pack(feed, msg.id);
          return reply({ ok: true, ...base(feed), pack: p, item: p?.it ?? null, line: p?.line ?? null, stores: p?.stores ?? {} });
        }
        case "match": {
          const host = sender.tab?.url ? new URL(sender.tab.url).hostname.replace(/^www\./, "") : "";
          if (host && indexes(feed).own.has(host)) return reply({ ok: true, res: null });
          const res = matchInfo(feed, msg.info ?? {}, msg.market);
          return reply({ ok: true, ...base(feed), res, pack: res.sure ? pack(feed, res.sure) : null, top: (res.kind ? res.top : []).slice(0, 6).map((id) => pack(feed, id)) });
        }
        case "search":
          return reply({ ok: true, ...base(feed), rows: search(feed, msg.q ?? "", msg.market).map((id) => pack(feed, id)) });
        case "deals":
          return reply({ ok: true, ...base(feed), rows: deals(feed, msg.market).map((id) => pack(feed, id)) });
        case "meta":
          return reply({ ok: true, ...base(feed), count: Object.keys(feed.items).length, sites: feed.sites ?? [] });
        case "watched": {
          const w = await getWatch();
          const rows = Object.entries(w).map(([id, x]) => ({ ...pack(feed, id), w: x })).filter((r) => r.it).sort((a, b) => (b.w.drop?.at ?? 0) - (a.w.drop?.at ?? 0) || b.w.at - a.w.at);
          return reply({ ok: true, ...base(feed), rows });
        }
        case "watch": {
          const w = await getWatch();
          if (msg.on) w[msg.id] = { m: msg.market, c: feed.items[msg.id]?.p?.[msg.market] ?? null, low: feed.items[msg.id]?.p?.[msg.market] ?? null, at: Date.now() };
          else delete w[msg.id];
          await setWatch(w);
          return reply({ ok: true, on: !!msg.on });
        }
        case "stat": {
          // Two local counters for the rating ask: savings shown and Buy clicks. Never sent anywhere.
          const { stats = {} } = await chrome.storage.local.get("stats");
          if (msg.k === "buys" || msg.k === "saves") stats[msg.k] = (stats[msg.k] ?? 0) + 1;
          await chrome.storage.local.set({ stats });
          return reply({ ok: true });
        }
        case "seen": {
          const w = await getWatch();
          for (const x of Object.values(w)) if (x.drop) x.drop.seen = true;
          await setWatch(w);
          return reply({ ok: true });
        }
        case "badge": {
          // The page's own toolbar badge: the saving on this tab, or a mark that we know the product.
          const tabId = sender.tab?.id;
          if (tabId != null) {
            await chrome.action.setBadgeText({ tabId, text: msg.text ?? "" });
            await chrome.action.setBadgeBackgroundColor({ tabId, color: msg.tone === "save" ? "#16a34a" : msg.tone === "ok" ? "#047857" : CONFIG.brand });
          }
          return reply({ ok: true });
        }
        case "feed": // 1.2.x popup
          return reply({ ok: true, feed });
        default:
          return reply({ ok: false });
      }
    } catch (e) {
      reply({ ok: false, error: String(e?.message ?? e) });
    }
  })();
  return true;
});

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== "refresh") return;
  try {
    await checkWatches(await loadFeed());
  } catch {}
});

function setup() {
  chrome.alarms.create("refresh", { periodInMinutes: 360, delayInMinutes: 1 });
  syncShops().catch(() => {});
  refreshDropBadge().catch(() => {});
}
chrome.runtime.onStartup.addListener(setup);

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({ id: "search", title: `Search ${CONFIG.short} for “%s”`, contexts: ["selection"] });
  setup();
  chrome.storage.local.get("installedAt").then((x) => x.installedAt || chrome.storage.local.set({ installedAt: Date.now() }));
  if (details.reason === "install") chrome.tabs.create({ url: tagged(CONFIG.page + "?installed=1", "installed") });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== "search" || !info.selectionText) return;
  const q = info.selectionText.trim().slice(0, 120);
  chrome.tabs.create({ url: tagged(CONFIG.search.replace("{q}", encodeURIComponent(q)), "context-menu") });
});
