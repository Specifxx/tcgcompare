// Service worker. Keeps one copy of the site's static price file (CONFIG.feed) for 12 hours and answers the content
// script and the popup from it. It sends nothing about the visitor anywhere: the only request it makes is a plain
// GET of that public file, with no cookies.
importScripts("config.js", "shared.js");

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

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    try {
      if (msg?.type === "lookup") {
        const feed = await loadFeed();
        const item = feed.items[String(msg.id)] ?? null;
        const buy = item?.b ? Object.values(item.b).map((x) => x[0]) : [];
        const stores = Object.fromEntries(buy.map((k) => [k, feed.stores?.[k] ?? k]));
        reply({ ok: true, item, line: item?.g ? feed.lines[item.g] ?? null : null, stores, currency: feed.currency, home: feed.home, generatedAt: feed.generatedAt });
      } else if (msg?.type === "feed") {
        reply({ ok: true, feed: await loadFeed(!!msg.force) });
      } else reply({ ok: false });
    } catch (e) {
      reply({ ok: false, error: String(e?.message ?? e) });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({ id: "search", title: `Search ${CONFIG.short} for “%s”`, contexts: ["selection"] });
  if (details.reason === "install") chrome.tabs.create({ url: tagged(CONFIG.page + "?installed=1", "installed") });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== "search" || !info.selectionText) return;
  const q = info.selectionText.trim().slice(0, 120);
  chrome.tabs.create({ url: tagged(CONFIG.search.replace("{q}", encodeURIComponent(q)), "context-menu") });
});

