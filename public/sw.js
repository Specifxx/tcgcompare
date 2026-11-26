// TCG Prices app service worker (DECISIONS.md, 2026-11-26 "The collection app"). It does ONE thing: My collection opens with no
// signal (on a train, in a card shop's basement) from the last copy this phone saw. It touches nothing else: every other request
// goes straight to the network as if this file did not exist. No push, no background sync, no tracking.
const CACHE = "ce-app-v1";
const SHELL = "/collection";
const CARD_API = "https://tcgsinglesdb.com/api/open/";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(SHELL, { credentials: "same-origin" }))).catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ce-app-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Network first; the last good answer when the network fails. */
async function networkFirst(req, key) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key || req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key || req);
    if (hit) return hit;
    throw err;
  }
}

/** Build files never change under one name: the cache first. */
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

const fromCollection = (req) => {
  try {
    return new URL(req.referrer).pathname.startsWith("/collection");
  } catch {
    return false;
  }
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === "navigate" && url.pathname === SHELL) return e.respondWith(networkFirst(req, SHELL));
    if (url.pathname === "/prices.json" && fromCollection(req)) return e.respondWith(networkFirst(req));
    if (url.pathname.startsWith("/_next/static/") && fromCollection(req)) return e.respondWith(cacheFirst(req));
    return;
  }
  if (url.href.startsWith(`${CARD_API}set/`)) return e.respondWith(networkFirst(req));
});
