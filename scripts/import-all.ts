// The daily import (GitHub Actions, .github/workflows/refresh-prices.yml):
//
//   TCGCSV catalogue + TCGplayer prices → every Shopify store we track →
//   eBay (budgeted, see src/lib/import/ebay.ts) → price history → data/public
//
// It writes ONLY public data, and only to data/. The workflow commits data/ to
// main and then dispatches production-deploy, so the site's data and its
// deployment change once a day, together.
//
// Env: EBAY_CLIENT_ID / EBAY_CLIENT_SECRET (optional; no eBay without them),
// EBAY_REFRESH=false to skip eBay, IMPORT_SKIP_STORES=1 to skip stores (local testing).
import fs from "node:fs";
import path from "node:path";
import { SITE } from "@/site.config";
import type { Catalog, EbayPick, Market, Meta, Offer, PriceEntry, Prices, StoreConfig, StoreStatus } from "@/lib/site-types";
import { CURRENCY } from "@/lib/site-types";
import { loadTcgcsv, referenceCents } from "@/lib/import/tcgcsv";
import { fetchStore, storeCurrency } from "@/lib/import/shopify";
import { readDemandSlugs } from "@/lib/import/demand";
import { focusCatalog } from "@/lib/import/focus";
import { loadSisterOffers, MAX_AGE_H as SISTER_MAX_AGE_H } from "@/lib/import/sisters";
import { carryDownSisters, groupsToKeep, heldForDownSisters, updateCulled, type CulledMap, type SisterMemo } from "@/lib/import/continuity";
import { OFFER_FLOOR, vetStores, type Refusal } from "@/lib/import/vet";
import { carryCrawl, crawlStoreKeys, storeIdentity, takeCrawl, type CrawlRun, type CrawlStore } from "@/lib/import/crawl";
import type { CrawlMeta } from "@/lib/site-types";
import { buildIndex, type MatchIndex, handleOf, isForeign, isPreorder, isUnfitListing, looksSealed, matchCard, matchSealed, printingOf } from "@/lib/import/match";
import {
  ebayCredentials,
  ebayRemaining,
  ebayToken,
  listingMatches,
  planEbayRefresh,
  searchLowest,
  useSetEditions,
  type EbayState,
} from "@/lib/import/ebay";
import { tcgplayerOfferCents } from "@/lib/import/sanity";
import { appendPoint, dayNumber, pctChange, readSetHistory, writeSetHistory } from "@/lib/import/history";
import { fetchJson } from "@/lib/import/http";
import { readAllPrices, writePrices } from "@/lib/price-store";

const PUBLIC = path.join(process.cwd(), "data", "public");
const STATE = path.join(process.cwd(), "data", "state");
const STORE_CARRY_H = 72; // a failed store's previous offers are kept this long

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data) + "\n");
}

async function fxRates(prev: Record<string, number>): Promise<Record<string, number>> {
  try {
    const d = await fetchJson<{ rates: Record<string, number> }>(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP,CAD,AUD,EUR,SGD",
    );
    return { USD: 1, ...d.rates };
  } catch (e) {
    console.warn(`[fx] ${(e as Error).message} — keeping yesterday's rates`);
    return Object.keys(prev).length ? prev : { USD: 1, GBP: 0.75, CAD: 1.4, AUD: 1.42, EUR: 0.89, SGD: 1.28 };
  }
}

/** A product keeps yesterday's slug (its URL never changes), unless another product now holds that slug. */
function keepSlugs(products: Catalog["products"], prev: Catalog | null) {
  if (!prev) return;
  const was = new Map(prev.products.map((p) => [p.id, p.slug]));
  const taken = new Set(products.map((p) => p.slug));
  for (const p of products) {
    const old = was.get(p.id);
    if (!old || old === p.slug || taken.has(old)) continue;
    console.log(`[slug] ${p.id} keeps ${old} (today's listing reads ${p.slug})`);
    taken.delete(p.slug);
    p.slug = old;
    taken.add(old);
  }
}

async function main() {
  const now = new Date();
  const today = dayNumber(now);
  const prevPrices: Prices = { generatedAt: "", byId: readAllPrices() };
  const prevMeta = readJson<Meta | null>(path.join(PUBLIC, "meta.json"), null);

  // 1. Catalogue + TCGplayer
  console.log(`[tcgcsv] category ${SITE.tcgcsvCategoryId}`);
  const prevCatalog = readJson<Catalog | null>(path.join(PUBLIC, "catalog.json"), null);
  // A group the last catalogue still has a page in is read whatever its age (lib/import/continuity.ts).
  const loaded = await loadTcgcsv(now, groupsToKeep(prevCatalog, SITE.catalogFocus?.evergreenGroups));
  // A game or a set TCGCSV could not serve today would drop its products (and 301 their pages) for a day: keep
  // yesterday's data instead and let the next run try again.
  if (loaded.failedLines.length || loaded.failedSets) throw new Error(`TCGCSV: ${loaded.failedLines.length} games and ${loaded.failedSets} sets could not be read; keeping yesterday's data`);
  const { tcg } = loaded;
  let { sets, products } = loaded;
  console.log(`[tcgcsv] ${sets.length} sets, ${products.length} products`);
  keepSlugs(products, prevCatalog);
  const demand = SITE.catalogFocus ? readDemandSlugs() : new Set<string>();
  const prevKept = prevMeta?.sealedFocused ? new Set(prevCatalog?.products.map((p) => p.id) ?? []) : new Set<number>();
  // Before release TCGplayer carries placeholder listings ($9,999 boxes) with
  // no market price. For upcoming sets, only a real market price counts.
  const upcomingIds = new Set(sets.filter((s) => s.upcoming).map((s) => s.id));
  for (const p of products)
    if (upcomingIds.has(p.setId) && tcg[p.id])
      for (const [k, v] of Object.entries(tcg[p.id])) if (v.market == null) delete tcg[p.id][k];
  const byId = new Map(products.map((p) => [p.id, p]));
  const fx = await fxRates(prevMeta?.fx ?? {});

  // 2. Stores
  const idx = buildIndex(products, sets, SITE.numberStyle, { rarityMustAgree: SITE.rarityMustAgree, rarityAliases: SITE.rarityAliases, setEditions: SITE.setEditions });
  useSetEditions(sets);
  const storeOffers = new Map<number, Offer[]>();
  const storeStatus: Record<string, StoreStatus> = {};
  const addOffer = (id: number, o: Offer) => {
    if (!storeOffers.has(id)) storeOffers.set(id, []);
    storeOffers.get(id)!.push(o);
  };
  let sisterStatus: Meta["sisters"];
  let sisterStores: (typeof SITE.stores) | null = null;
  let refused: Refusal[] = [];
  let downStores = new Set<string>();
  let crawlMeta: CrawlMeta | undefined;
  const crawlOffers = new WeakSet<Offer>();
  if (process.env.SISTER_DIR) {
    // Store rows come from our sister sites' published data, by TCGplayer product id (lib/import/sisters.ts).
    const res = loadSisterOffers(process.env.SISTER_DIR, now);
    // A sister that is down: its stores' rows from the previous import, for at most 72 hours after its data was last
    // fresh (lib/import/continuity.ts). They go through the same vetting and price band as live rows.
    const carry = carryDownSisters({
      status: res.status,
      prevStatus: prevMeta?.sisters,
      prevById: prevPrices.byId,
      live: res.offers,
      liveStores: res.stores,
      prevStores: readJson<StoreConfig[]>(path.join(PUBLIC, "stores.json"), []),
      now,
      maxAgeH: SISTER_MAX_AGE_H,
    });
    for (const [id, list] of carry.offers) res.offers.set(id, [...(res.offers.get(id) ?? []), ...list]);
    res.stores.push(...carry.stores);
    res.stores.sort((a, b) => a.key.localeCompare(b.key));
    downStores = carry.downStores;
    for (const [id, st] of Object.entries(carry.status)) if (!st.ok) console.warn(`[sister] ${id} down: ${st.carried ?? 0} rows carried from the previous import (data of ${st.at ?? "unknown"})`);
    sisterStatus = carry.status;
    // Our own crawl of the games no sister covers (lib/import/crawl.ts): scripts/crawl-uncovered.ts ran just before
    // and left its listings in data/crawl/listings.json. Each is taken only by the TCGplayer id it carries, then goes
    // through the same vetting and price band as a sister's row below.
    crawlMeta = mergeOwnCrawl({
      res, products, sets, prevMeta, prevById: prevPrices.byId, now, crawlOffers,
      // An own-list shop's listing taken by title must sit at 60-160% of TCGplayer's market price (lib/import/crawl.ts pickByTitle).
      inBand: (id, cents, market) => {
        const ref = byId.has(id) ? referenceCents(tcg[id]) : null;
        if (ref == null || ref <= 0) return false;
        const usd = cents / (fx[CURRENCY[market]] ?? 1);
        return usd >= ref * 0.6 && usd <= ref * 1.6;
      },
    });
    sisterStores = res.stores;
    // Store vetting (lib/import/vet.ts): a blocked, domain-less or too-cheap-to-be-true store shows no row at all.
    const blocklist = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "store-blocklist.json"), "utf8")) as Record<string, string>;
    refused = vetStores({ stores: res.stores, offers: res.offers, refCents: (id) => (byId.has(id) ? referenceCents(tcg[id]) : null), fx, blocklist });
    const out = new Set(refused.map((r) => r.key));
    for (const r of refused) console.log(`[vet] ${r.key} (${r.host}) refused: ${r.why}`);
    let dropped = 0;
    for (const [id, list] of res.offers) {
      if (!byId.has(id)) continue;
      const ref = referenceCents(tcg[id]);
      for (const o of list) {
        if (out.has(o.source)) continue;
        // The same sanity band as a store pass: under half or over four times TCGplayer's market price is
        // likelier another product than a deal.
        const usd = o.cents / (fx[o.currency] ?? 1);
        if (ref != null && ref >= 300 && (usd < ref * OFFER_FLOOR || usd > ref * 4)) { dropped++; continue; }
        addOffer(id, o);
        if (crawlMeta && crawlOffers.has(o)) crawlMeta.offers++;
        const st = (storeStatus[o.source] ??= { ok: true, products: 0, matched: 0, at: now.toISOString() });
        st.products++;
        st.matched++;
      }
    }
    console.log(`[sister] ${[...storeOffers.values()].reduce((a, l) => a + l.length, 0)} offers kept on ${storeOffers.size} products, ${dropped} outside the price band`);
  } else if (process.env.IMPORT_SKIP_STORES !== "1") {
    // Stores in parallel (each one still paginates politely, one page at a
    // time): ~200 stores one after another would not fit the Actions timeout.
    const queue = SITE.stores.slice();
    const runStore = async (store: (typeof SITE.stores)[number]) => {
      try {
        const cur = await storeCurrency(store);
        if (cur && cur !== CURRENCY[store.market])
          throw new Error(`store charges ${cur}, but is configured for ${store.market} (${CURRENCY[store.market]}) — fix its market in src/content/stores.ts`);
        const items = await fetchStore(store);
        let matched = 0;
        // Several listings can match one product (NM / foil / pre-order rows):
        // keep the cheapest in-stock one per printing.
        const best = new Map<string, Offer>();
        for (const it of items) {
          if (isUnfitListing(it.title)) continue;
          if (isForeign(handleOf(it.url))) continue;
          const sealed = looksSealed(it.title, it.productType, SITE.numberStyle);
          const m = sealed ? matchSealed(it.title, idx) : matchCard(it.title, idx, `${it.productType} | ${it.tags.join(" | ")}`);
          if (!m) continue;
          matched++;
          // Price sanity: a store price under half or over four times the
          // TCGplayer reference is far likelier a bad match (or a damaged /
          // graded copy) than a real deal. Leave it out.
          const ref = referenceCents(tcg[m.product.id]);
          const usd = it.cents / (fx[CURRENCY[store.market]] ?? 1);
          if (ref != null && ref >= 300 && (usd < ref * OFFER_FLOOR || usd > ref * 4)) continue;
          const offer: Offer = {
            source: store.key,
            market: store.market,
            currency: CURRENCY[store.market],
            cents: it.cents,
            inStock: it.inStock,
            url: it.url,
            title: it.title,
            printing: m.product.kind === "card" ? printingOf(it.title, it.variantTitle, m.product.printings) : undefined,
            preorder: isPreorder(it.title, it.tags) || undefined,
          };
          const k = `${m.product.id}|${offer.printing ?? ""}`;
          const cur = best.get(k);
          if (!cur || (offer.inStock && !cur.inStock) || (offer.inStock === cur.inStock && offer.cents < cur.cents))
            best.set(k, offer);
        }
        for (const [k, o] of best) addOffer(Number(k.split("|")[0]), o);
        storeStatus[store.key] = { ok: true, products: items.length, matched, at: now.toISOString() };
        console.log(`[store] ${store.key}: ${items.length} listings, ${matched} matched, ${best.size} offers`);
      } catch (e) {
        const msg = (e as Error).message.slice(0, 300);
        console.warn(`[store] ${store.key} FAILED: ${msg}`);
        const prev = prevMeta?.stores[store.key];
        storeStatus[store.key] = { ok: false, products: 0, matched: 0, at: prev?.at ?? now.toISOString(), error: msg };
        // Carry yesterday's offers for a short outage rather than blanking the store.
        if (prev?.ok !== false && prev && now.getTime() - new Date(prev.at).getTime() < STORE_CARRY_H * 3_600_000) {
          for (const [id, entry] of Object.entries(prevPrices.byId))
            for (const o of entry.offers) if (o.source === store.key) addOffer(Number(id), o);
        }
      }
    };
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (queue.length) await runStore(queue.shift()!);
      }),
    );
  } else {
    for (const [id, entry] of Object.entries(prevPrices.byId))
      for (const o of entry.offers) if (o.source !== "ebay" && o.source !== "tcgplayer") addOffer(Number(id), o);
  }

  // 2b. The sealed focus (SITE.catalogFocus, lib/import/focus.ts): only sealed product with real demand keeps a page.
  if (SITE.catalogFocus) {
    const kept = focusCatalog({ products, sets, offers: storeOffers, tcg, rule: SITE.catalogFocus, now, demand, previous: prevKept });
    const keptIds = new Set(kept.map((p) => p.id));
    // Never culled only because a sister was down this run (lib/import/continuity.ts).
    const held = heldForDownSisters({ products, keptIds, previous: prevKept, prevById: prevPrices.byId, downStores });
    if (held.length) {
      for (const p of held) keptIds.add(p.id);
      kept.splice(0, kept.length, ...products.filter((p) => keptIds.has(p.id)));
      console.warn(`[focus] ${held.length} products held: a sister their store rows came from is down`);
      for (const st of Object.values(sisterStatus ?? {}))
        if (!st.ok) {
          const mine = new Set(st.stores ?? []);
          (st as SisterMemo).held = held.filter((p) => (prevPrices.byId[p.id]?.offers ?? []).some((o) => mine.has(o.source))).length;
        }
    }
    for (const p of products) if (!keptIds.has(p.id)) byId.delete(p.id);
    for (const id of [...storeOffers.keys()]) if (!keptIds.has(id)) storeOffers.delete(id);
    console.log(`[focus] ${kept.length} of ${products.length} sealed products kept (${prevKept.size ? "with" : "without"} yesterday's list)`);
    products = kept;
    for (const s of sets) s.productCount = products.filter((p) => p.setId === s.id).length;
    // A set with nothing kept has no page: it leaves the catalogue (thousands of card-only sets otherwise).
    sets = sets.filter((s) => s.productCount > 0);
    const perLine = new Map<string, number>();
    for (const s of sets) perLine.set(s.line ?? "-", (perLine.get(s.line ?? "-") ?? 0) + s.productCount);
    console.log(`[focus] by game: ${[...perLine].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
    const perType = new Map<string, number>();
    for (const p of products) perType.set(p.sealedType ?? "?", (perType.get(p.sealedType ?? "?") ?? 0) + 1);
    console.log(`[focus] by type: ${[...perType].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
  }
  const catalog: Catalog = { generatedAt: now.toISOString(), sets, products };

  // 3. eBay
  const refUsd = new Map(products.map((p) => [p.id, referenceCents(tcg[p.id])]));
  const ebayState = readJson<EbayState>(path.join(STATE, "ebay.json"), {});
  const usage = readJson<{ day: string; calls: number }>(path.join(STATE, "ebay-usage.json"), { day: "", calls: 0 });
  const dayKey = now.toISOString().slice(0, 10);
  if (usage.day !== dayKey) Object.assign(usage, { day: dayKey, calls: 0 });
  let ebayMeta: Meta["ebay"] = prevMeta?.ebay ?? null;
  if (ebayCredentials() && process.env.EBAY_REFRESH !== "false") {
    try {
      const token = await ebayToken();
      const remaining = await ebayRemaining(token);
      const reserve = Number(process.env.EBAY_RESERVE ?? 100);
      const ownLeft = SITE.ebay.dailyBudget - usage.calls;
      const budget = Math.max(0, Math.min(ownLeft, remaining == null ? ownLeft : remaining - reserve));
      const recentSets = new Set(
        sets
          .filter((s) => s.upcoming || (s.releasedOn && now.getTime() - new Date(s.releasedOn).getTime() < 45 * 86_400_000))
          .map((s) => s.id),
      );
      const plan = planEbayRefresh({
        products,
        refUsdCents: refUsd,
        // No database: demand comes from value, rarity, sealed type and set
        // age only. (The click log that fed it is archived.)
        clicks30d: new Map(),
        newSetIds: recentSets,
        state: ebayState,
        budget,
        now,
      });
      console.log(
        `[ebay] app remaining ${remaining ?? "unknown"}, own ${usage.calls}/${SITE.ebay.dailyBudget} used today → budget ${budget}; ${plan.eligible} products ≥ $${SITE.ebay.minPriceUsd}; ${plan.calls.length} planned`,
      );
      let refreshed = 0;
      let stop = false;
      const queue = plan.calls.slice();
      const worker = async () => {
        while (!stop && queue.length) {
          const c = queue.shift()!;
          const ref = refUsd.get(c.product.id) ?? null;
          try {
            usage.calls++;
            const offer = await searchLowest(token, c.product, c.market, ref, fx[CURRENCY[c.market]] ?? 1);
            (ebayState[c.product.id] ??= {})[c.market] = { at: now.toISOString(), offer };
            refreshed++;
          } catch (e) {
            if ((e as { quota?: boolean }).quota) stop = true;
            console.warn(`[ebay] ${c.product.id} ${c.market}: ${(e as Error).message}`);
          }
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));
      ebayMeta = { day: dayKey, calls: usage.calls, budget: SITE.ebay.dailyBudget, eligible: plan.eligible, refreshed, at: now.toISOString() };
      console.log(`[ebay] refreshed ${refreshed}`);
    } catch (e) {
      console.warn(`[ebay] skipped: ${(e as Error).message}`);
    }
  }
  // Re-check saved eBay results against today's rules (and price floor), so a
  // tightened rule purges old matches without spending calls.
  for (const [id, markets] of Object.entries(ebayState)) {
    const p = byId.get(Number(id));
    const ref = refUsd.get(Number(id));
    for (const [mk, e] of Object.entries(markets ?? {}) as [Market, { at: string; offer: Offer | null }][]) {
      if (!p || !e?.offer) continue;
      const usd = e.offer.cents / (fx[e.offer.currency] ?? 1);
      // A listing read as one printing ("1st Edition") is held to that
      // printing's price: under half of it is a mislabelled or other copy.
      const own = e.offer.printing ? tcg[p.id]?.[e.offer.printing] : undefined;
      const floor = (own && (own.market ?? own.mid ?? own.low)) ?? ref;
      if (!listingMatches(p, e.offer.title) || (floor != null && usd < floor * 0.5)) markets![mk] = { at: e.at, offer: null };
    }
  }
  // Drop state for products that left the catalogue.
  for (const id of Object.keys(ebayState)) if (!byId.has(Number(id))) delete ebayState[id];

  // 4. Prices + history
  const prices: Prices = { generatedAt: now.toISOString(), byId: {} };
  const histories = new Map<number, ReturnType<typeof readSetHistory>>();
  let offerCount = 0;
  for (const p of products) {
    const t = tcg[p.id] ?? {};
    const offers: Offer[] = [...(storeOffers.get(p.id) ?? [])];
    const ref = refUsd.get(p.id);
    // No eBay price is ever an offer here (owner, 2026-11-14): eBay is the pinned tagged search row only, never a
    // price, a "Best price" or a "Cheapest in" box. Neither our own eBay state nor a sister's eBay listing is used.
    const tcgLow = Object.values(t).map((x) => x.low).filter((x): x is number => x != null);
    const tcgCents = tcgplayerOfferCents(tcgLow, ref);
    if (tcgCents != null) {
      offers.push({
        source: "tcgplayer",
        market: "US",
        currency: "USD",
        cents: tcgCents,
        inStock: tcgLow.length > 0,
        url: p.tcgUrl,
        title: `${p.name} on TCGplayer`,
      });
    }
    offers.sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.cents - b.cents);
    offerCount += offers.length;

    if (!histories.has(p.setId)) histories.set(p.setId, readSetHistory(p.setId));
    const h = histories.get(p.setId)!;
    if (ref != null) h[p.id] = appendPoint(h[p.id] ?? [], today, ref);
    const entry: PriceEntry = {
      tcg: t,
      offers,
      change7d: pctChange(h[p.id], today, 7),
      change30d: pctChange(h[p.id], today, 30),
    };
    prices.byId[p.id] = entry;
  }
  for (const [setId, h] of histories) writeSetHistory(setId, h);

  // 5. eBay Picks (the homepage banner): the most valuable cards (sealed products on a sealed-only site) with a fresh
  // US listing, newest sets first. No extra calls: reuses step 3's results.
  const setRank = new Map(sets.map((s, i) => [s.id, i]));
  const picks: EbayPick[] = products
    .filter((p) => (SITE.sealedOnly ? p.kind === "sealed" && p.sealedType !== "Insert" : p.kind === "card"))
    .map((p) => ({ p, e: prices.byId[p.id].offers.find((o) => o.source === "ebay" && o.market === "US") }))
    .filter((x) => x.e)
    .sort(
      (a, b) =>
        (setRank.get(a.p.setId)! < 3 ? 0 : 1) - (setRank.get(b.p.setId)! < 3 ? 0 : 1) ||
        (refUsd.get(b.p.id) ?? 0) - (refUsd.get(a.p.id) ?? 0),
    )
    .slice(0, 12)
    .map(({ p, e }) => ({
      productId: p.id,
      name: p.name,
      image: p.image,
      cents: e!.cents,
      currency: e!.currency,
      url: e!.url,
      title: e!.title,
      marketCents: refUsd.get(p.id) ?? null,
    }));

  const meta: Meta = {
    updatedAt: now.toISOString(),
    fx,
    stores: storeStatus,
    ebay: ebayMeta,
    ...(SITE.catalogFocus ? { sealedFocused: true } : {}),
    ...(sisterStatus ? { sisters: sisterStatus } : {}),
    ...(crawlMeta ? { crawl: crawlMeta } : {}),
    counts: {
      cards: products.filter((p) => p.kind === "card").length,
      sealed: products.filter((p) => p.kind === "sealed").length,
      offers: offerCount,
      sets: sets.length,
    },
  };

  writeJson(path.join(PUBLIC, "catalog.json"), catalog);
  // The store directory (src/content/stores.ts reads it): every sister store with an offer on a kept product.
  if (sisterStores) {
    writeJson(path.join(PUBLIC, "store-vetting.json"), { at: now.toISOString(), refused });
    const live = new Set([...storeOffers.values()].flatMap((l) => l.map((o) => o.source)));
    writeJson(path.join(PUBLIC, "stores.json"), sisterStores.filter((st) => live.has(st.key)).map(({ key, name, base, market }) => ({ key, name, base, market })));
  }
  // A product that had a page and lost it, for any reason (the focus, its group's age, TCGCSV no longer listing it),
  // 301s to its set or its game (lib/culled.ts, lib/import/continuity.ts); one that is back leaves the list.
  if (SITE.catalogFocus) {
    const culled = updateCulled({ existing: readJson<CulledMap>(path.join(PUBLIC, "culled.json"), {}), prev: prevCatalog, kept: products, setsToday: loaded.sets });
    writeJson(path.join(PUBLIC, "culled.json"), culled);
  }
  writePrices(prices.byId, products);
  fs.rmSync(path.join(PUBLIC, "prices.json"), { force: true });
  writeJson(path.join(PUBLIC, "meta.json"), meta);
  writeJson(path.join(PUBLIC, "ebay-picks.json"), picks);
  writeJson(path.join(STATE, "ebay.json"), ebayState);
  writeJson(path.join(STATE, "ebay-usage.json"), usage);
  console.log(`[done] ${meta.counts.cards} cards, ${meta.counts.sealed} sealed, ${offerCount} offers`);
}

const CRAWL_RUN_MAX_AGE_H = 6; // a listings file older than this is not today's crawl
const CRAWL_CARRY_H = 72;

/** Adds our own crawl's offers (and the rows carried for its stores not read this run) to the sisters' result. */
function mergeOwnCrawl(a: {
  res: { offers: Map<number, Offer[]>; stores: StoreConfig[] };
  products: Catalog["products"];
  sets: Catalog["sets"];
  prevMeta: Meta | null;
  prevById: Prices["byId"];
  now: Date;
  crawlOffers: WeakSet<Offer>;
  inBand: (id: number, cents: number, market: Market) => boolean;
}): CrawlMeta {
  const { res, products, sets, prevMeta, now } = a;
  const entries = readJson<CrawlStore[]>(path.join(process.cwd(), "data", "crawl", "stores.json"), []);
  let run = readJson<CrawlRun | null>(path.join(process.cwd(), "data", "crawl", "listings.json"), null);
  if (run && !(now.getTime() - Date.parse(run.at) <= CRAWL_RUN_MAX_AGE_H * 3_600_000)) {
    console.warn(`[crawl] data/crawl/listings.json is from ${run.at}: not this run's, ignored`);
    run = null;
  }
  const crawlLines = new Set((SITE.lines ?? []).filter((l) => l.crawl).map((l) => l.id));
  // Own stores (data/crawl/own-stores.json) are read for every game; one a sister now lists is left to the sister.
  const sisterIdents = new Set(res.stores.map((s) => storeIdentity(s.base, s.market)));
  const ownIdents = new Set(entries.filter((e) => e.own).map((e) => storeIdentity(e.base, e.market)).filter((id) => !sisterIdents.has(id)));
  const ownLines = new Set((SITE.lines ?? []).filter((l) => l.crawl || l.ownCrawl).map((l) => l.id));
  const lineOfSet = new Map(sets.map((st) => [st.id, st.line]));
  const all = new Map(products.map((p) => [p.id, p]));
  const lineOf = (p: { setId: number }) => lineOfSet.get(p.setId);
  const indexes = new Map<string, MatchIndex>();
  const indexOf = (line: string) => {
    if (!indexes.has(line)) {
      const ss = sets.filter((st) => st.line === line);
      const ids = new Set(ss.map((st) => st.id));
      indexes.set(line, buildIndex(products.filter((p) => ids.has(p.setId)), ss, SITE.numberStyle, { rarityMustAgree: SITE.rarityMustAgree, rarityAliases: SITE.rarityAliases, setEditions: SITE.setEditions }));
    }
    return indexes.get(line)!;
  };
  const storesOf = [...new Map([...entries, ...(run?.stores ?? [])].map((s) => [storeIdentity(s.base, s.market), s])).values()];
  const { keyOf, added } = crawlStoreKeys(res.stores, storesOf);
  const got = run ? takeCrawl(run, { products: all, lineOf, indexOf, inBand: a.inBand }, keyOf) : { offers: new Map<number, Offer[]>(), fresh: new Map<string, Set<number>>(), taken: 0, refused: {}, listings: 0 };
  const readOk = new Set((run?.stores ?? []).filter((s) => s.ok).map((s) => storeIdentity(s.base, s.market)));
  const seen: Record<string, string> = { ...(prevMeta?.crawl?.seen ?? {}) };
  for (const id of readOk) seen[id] = run!.at;
  // Every store this run asked anything, read or not: the next run starts with the stores tried longest ago, so one
  // that keeps hitting its cap does not go first on every run.
  const tried: Record<string, string> = { ...(prevMeta?.crawl?.tried ?? {}) };
  for (const s of run?.stores ?? []) if (s.requests > 0) tried[storeIdentity(s.base, s.market)] = run!.at;
  // Forget stores no longer in the probe's list.
  const listed = new Set(storesOf.map((s) => storeIdentity(s.base, s.market)));
  for (const id of Object.keys(seen)) if (!listed.has(id)) delete seen[id];
  for (const id of Object.keys(tried)) if (!listed.has(id)) delete tried[id];
  const prevKeyOf = new Map(readJson<StoreConfig[]>(path.join(PUBLIC, "stores.json"), []).map((s) => [storeIdentity(s.base, s.market), s.key]));
  const carry = carryCrawl({
    stores: storesOf,
    readOk,
    seen,
    keyOf,
    prevById: a.prevById,
    prevKeyOf,
    crawledProduct: (id, ident) => {
      const p = all.get(id);
      const line = p && lineOf(p);
      return !!line && (ownIdents.has(ident) ? ownLines : crawlLines).has(line);
    },
    fresh: got.fresh,
    now,
    maxAgeH: CRAWL_CARRY_H,
  });
  const used = new Set<string>();
  for (const src of [got.offers, carry.offers])
    for (const [id, list] of src) {
      if (!res.offers.has(id)) res.offers.set(id, []);
      for (const o of list) {
        a.crawlOffers.add(o);
        used.add(o.source);
        res.offers.get(id)!.push(o);
      }
    }
  for (const st of added) if (used.has(st.key)) res.stores.push(st);
  res.stores.sort((x, y) => x.key.localeCompare(y.key));
  const stopped: Record<string, number> = {};
  for (const s of run?.stores ?? []) if (!s.ok) { const r = (s.reason ?? "unknown").split(":")[0]; stopped[r] = (stopped[r] ?? 0) + 1; }
  const meta: CrawlMeta = {
    at: run?.at ?? prevMeta?.crawl?.at ?? null,
    ran: !!run,
    listed: entries.length,
    stores: storesOf.length,
    read: readOk.size,
    partial: (run?.stores ?? []).filter((s) => !s.ok && s.partial).length,
    stopped,
    requests: run?.requests ?? 0,
    budget: run?.budget ?? 0,
    listings: got.listings,
    taken: got.taken,
    titled: got.titled ?? 0,
    refused: got.refused,
    offers: 0,
    carried: carry.carried,
    seen,
    tried,
  };
  console.log(`[crawl] ${run ? `run of ${run.at}: ${meta.read} of ${meta.stores} stores read, ${meta.requests} requests, ${got.listings} listings, ${got.taken} taken` : "no crawl run this import"}; ${carry.carried} rows carried; refused ${JSON.stringify(got.refused)}`);
  return meta;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
