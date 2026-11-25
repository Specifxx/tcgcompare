// Sealed Sniper (boardroom move N2, 2026-11-19): restocks and price drops of sealed product of every game in SNIPER_LINES,
// posted to the Compare Empire Discord by scripts/sniper.ts after each import (refresh-prices.yml).
// This file is pure and tested (tests/sniper.test.ts); the script reads the files, checks the store, posts and saves state.
//
// ACCURACY FIRST: a wrong "in stock" post costs the channel its trust.
//   • Candidates come only from our own data: an offer sold out in the last commit and in stock now (lib/restocks.ts), or a
//     market's cheapest in-stock store price down 10%+ on the last commit.
//   • Sanity: headline sealed types only, TCGplayer market of US$25+, and the store's price inside a band of that market
//     (converted for the check only, never shown converted). A price far under market is a wrong match or a scam, not a deal.
//   • Before anything is posted the store's own product (Shopify /products/<handle>.js) is asked once, through
//     polite-http (robots.txt, our User-Agent, a 401/403/429 or challenge stops the store): the variant must be available
//     and its live price must be the one we post. No answer, no post. The post carries that check's time as a Discord
//     timestamp (<t:…:R>), which every reader sees as "N minutes ago", counting up.
//   • Dedupe in data/state/sniper.json: a store's restock of a product once per RESTOCK_COOLDOWN_DAYS, a market's drop once
//     per DROP_COOLDOWN_DAYS unless the price falls a further DROP_REPOST_PCT. At most MAX_POSTS a run, restocks first.
// Links: our product page, tagged utm_source=discord&utm_medium=social&utm_campaign=sealed-sniper; the page's eBay and
// TCGplayer rows carry the affiliate tags (lib/affiliate.ts). No eBay API call, no eBay price.
import { CURRENCY, type Market } from "./site-types";
import { money } from "./format";

/** The games the Sniper covers (SITE.lines ids): every game one of our sites covers, plus Star Wars: Unlimited and Flesh
 * and Blood (owner, 2026-11-23: "cover all the tcgs we have"). Pokémon Japan stays out: its prices are in yen. */
export const SNIPER_LINES = ["pkm", "op", "rb", "mtg", "lor", "ygo", "gun", "ua", "fw", "dg", "swu", "fab", "cp"] as const;
export const GAME_LABEL: Record<string, string> = {
  pkm: "Pokémon", op: "One Piece", rb: "Riftbound", mtg: "Magic", lor: "Lorcana", ygo: "Yu-Gi-Oh!", gun: "Gundam",
  ua: "Union Arena", fw: "Fusion World", dg: "Digimon", swu: "Star Wars: Unlimited", fab: "Flesh and Blood", cp: "Cyberpunk",
};
/** Headline sealed types only: no loose packs, blisters or prerelease kits. */
export const SNIPER_TYPES = new Set(["Booster Box", "Elite Trainer Box", "Bundle", "Case", "Collection", "Illumineer's Trove", "Commander Deck"]);
export const MIN_MARKET_USD_CENTS = 2500;
/** A restock's price, as a share of TCGplayer's market. */
export const RESTOCK_BAND = [0.6, 1.25] as const;
/** A drop's new price, as a share of TCGplayer's market. */
export const DROP_BAND = [0.6, 1.05] as const;
export const DROP_MIN_PCT = 10;
export const DROP_MIN_CENTS = 500;
export const MAX_POSTS = 8;
/** Restocks a run when there are drops to post too. */
export const MAX_RESTOCKS = 5;
export const RESTOCK_COOLDOWN_DAYS = 3;
export const DROP_COOLDOWN_DAYS = 7;
export const DROP_REPOST_PCT = 5;
/** The live price may differ from our data by this much (a cent of rounding, a small change); a dearer one is not posted. */
export const LIVE_PRICE_TOLERANCE = 0.02;
export const UTM = "utm_source=discord&utm_medium=social&utm_campaign=sealed-sniper";

export const FLAG: Record<Market, string> = { US: "🇺🇸", UK: "🇬🇧", CA: "🇨🇦", AU: "🇦🇺", EU: "🇪🇺", SG: "🇸🇬" };
export const MARKET_NAME: Record<Market, string> = { US: "US", UK: "UK", CA: "Canadian", AU: "Australian", EU: "European", SG: "Singapore" };

export interface SniperProduct {
  id: number;
  slug: string;
  name: string;
  sealedType: string | null;
  image?: string | null;
  line: string | null;
  /** TCGplayer market, US cents (Normal printing) */
  marketCents: number | null;
}
export interface SniperStore {
  key: string;
  name: string;
  base: string;
  market: Market;
}
/** offer tuple (lib/offer-codec.ts): [source, cents, flags, ref, …]; flags 1 = in stock, 2 = pre-order */
export type Tuple = [string, number, number, string, ...unknown[]];

export type SniperEvent =
  | { kind: "restock"; product: SniperProduct; store: SniperStore; cents: number; ref: string }
  | { kind: "drop"; product: SniperProduct; store: SniperStore; cents: number; ref: string; was: number; pct: number }
  /** the first pre-order in a market: no store we track there listed the product at all on the previous commit */
  | { kind: "preorder"; product: SniperProduct; store: SniperStore; cents: number; ref: string };

/** USD cents of a price in a market's own currency (fx: units per USD), for the sanity band only. */
export const toUsd = (cents: number, market: Market, fx: Record<string, number>): number | null => {
  const r = fx[CURRENCY[market]];
  return r && r > 0 ? cents / r : null;
};

export function eligible(p: SniperProduct | null | undefined): p is SniperProduct {
  return !!p && !!p.line && (SNIPER_LINES as readonly string[]).includes(p.line) && !!p.sealedType && SNIPER_TYPES.has(p.sealedType) && (p.marketCents ?? 0) >= MIN_MARKET_USD_CENTS;
}

export function inBand(cents: number, market: Market, p: SniperProduct, band: readonly [number, number], fx: Record<string, number>): boolean {
  const usd = toUsd(cents, market, fx);
  if (usd == null || !p.marketCents) return false;
  const r = usd / p.marketCents;
  return r >= band[0] && r <= band[1];
}

const plainRef = (ref: string) => ref.split("#")[0];

/** Restocks of this import (lib/restocks.ts events stamped with this run's time) that pass the Sniper's filters. */
export function restockEvents(o: {
  events: readonly { p: number; s: string; c: number; r: string; t: string }[];
  at: string;
  products: ReadonlyMap<number, SniperProduct>;
  stores: ReadonlyMap<string, SniperStore>;
  fx: Record<string, number>;
  /** the current shards' offers, to find the ref with its variant id */
  offers: (pid: number) => readonly Tuple[];
}): SniperEvent[] {
  const out: SniperEvent[] = [];
  for (const e of o.events) {
    if (e.t !== o.at) continue;
    const product = o.products.get(e.p);
    const store = o.stores.get(e.s);
    if (!eligible(product) || !store) continue;
    if (!inBand(e.c, store.market, product, RESTOCK_BAND, o.fx)) continue;
    const t = o.offers(e.p).find((x) => x[0] === e.s && x[2] === 1 && String(x[3]).split("?")[0] === e.r);
    out.push({ kind: "restock", product, store, cents: e.c, ref: t ? plainRef(String(t[3])) : e.r });
  }
  return out;
}

/** The cheapest in-stock (never pre-order) independent-store offer of a product in each market. */
export function cheapestByMarket(tuples: readonly Tuple[], stores: ReadonlyMap<string, SniperStore>): Map<Market, { t: Tuple; store: SniperStore }> {
  const best = new Map<Market, { t: Tuple; store: SniperStore }>();
  for (const t of tuples) {
    if (t[2] !== 1 || !(t[1] > 0)) continue;
    const store = stores.get(t[0]);
    if (!store) continue; // eBay, TCGplayer, Amazon, a removed store
    const cur = best.get(store.market);
    if (!cur || t[1] < cur.t[1]) best.set(store.market, { t, store });
  }
  return best;
}

/** Markets where the cheapest in-stock store price fell DROP_MIN_PCT+ (and DROP_MIN_CENTS+) on the previous commit. */
export function dropEvents(o: {
  prev: Record<string, { o: Tuple[] }> | undefined;
  cur: Record<string, { o: Tuple[] }>;
  products: ReadonlyMap<number, SniperProduct>;
  stores: ReadonlyMap<string, SniperStore>;
  fx: Record<string, number>;
}): SniperEvent[] {
  const out: SniperEvent[] = [];
  if (!o.prev) return out;
  for (const [pid, entry] of Object.entries(o.cur)) {
    const product = o.products.get(Number(pid));
    if (!eligible(product)) continue;
    const before = o.prev[pid];
    if (!before) continue;
    const was = cheapestByMarket(before.o, o.stores);
    for (const [market, now] of cheapestByMarket(entry.o, o.stores)) {
      const old = was.get(market);
      if (!old) continue; // nothing in stock before: a restock, not a drop
      const cents = now.t[1];
      const pct = Math.round((1 - cents / old.t[1]) * 100);
      if (pct < DROP_MIN_PCT || old.t[1] - cents < DROP_MIN_CENTS) continue;
      if (!inBand(cents, market, product, DROP_BAND, o.fx)) continue;
      out.push({ kind: "drop", product, store: now.store, cents, ref: plainRef(String(now.t[3])), was: old.t[1], pct });
    }
  }
  return out;
}

/**
 * New pre-orders (2026-11-22: a Canadian store's ETB pre-order sold 10 in 41 minutes through a restock chat): in each market,
 * a product that no tracked store listed on the previous commit (in stock, pre-order or sold out) and that a store now takes
 * pre-orders for. The cheapest such offer; the same price band as a restock.
 */
export function preorderEvents(o: {
  prev: Record<string, { o: Tuple[] }> | undefined;
  cur: Record<string, { o: Tuple[] }>;
  products: ReadonlyMap<number, SniperProduct>;
  stores: ReadonlyMap<string, SniperStore>;
  fx: Record<string, number>;
}): SniperEvent[] {
  const out: SniperEvent[] = [];
  if (!o.prev) return out;
  // a market with no offer at all in the previous shard was not read then (a stale sister): nothing there is "first"
  const read = new Set<Market>();
  for (const e of Object.values(o.prev)) for (const t of e.o) {
    const st = o.stores.get(t[0]);
    if (st) read.add(st.market);
  }
  for (const [pid, entry] of Object.entries(o.cur)) {
    const product = o.products.get(Number(pid));
    if (!eligible(product)) continue;
    const before = new Set<Market>();
    for (const t of o.prev[pid]?.o ?? []) {
      const st = o.stores.get(t[0]);
      if (st) before.add(st.market);
    }
    const best = new Map<Market, { t: Tuple; store: SniperStore }>();
    for (const t of entry.o) {
      if (t[2] !== 2 || !(t[1] > 0)) continue;
      const store = o.stores.get(t[0]);
      if (!store || before.has(store.market) || !read.has(store.market)) continue;
      const cur = best.get(store.market);
      if (!cur || t[1] < cur.t[1]) best.set(store.market, { t, store });
    }
    for (const [market, b] of best) {
      if (!inBand(b.t[1], market, product, RESTOCK_BAND, o.fx)) continue;
      out.push({ kind: "preorder", product, store: b.store, cents: b.t[1], ref: plainRef(String(b.t[3])) });
    }
  }
  return out;
}

// ── dedupe ─────────────────────────────────────────────────────────────────

export interface SniperState {
  v: 1;
  /** key → when it was last posted (ISO) and at what price */
  posted: Record<string, { at: string; cents: number }>;
  /** the last run's counts, for the ops monitor's "Sealed Sniper" check */
  lastRun?: { at: string; candidates: number; fresh: number; posted: number; skipped: Record<string, number> };
}
export const emptySniperState = (): SniperState => ({ v: 1, posted: {} });
export const sniperKey = (e: SniperEvent): string =>
  e.kind === "restock" ? `restock|${e.product.id}|${e.store.key}` : `${e.kind}|${e.product.id}|${e.store.market}`;

const DAY = 86_400_000;

/** Not posted within its cooldown (a drop: unless the price is a further DROP_REPOST_PCT lower). */
export function isNew(e: SniperEvent, state: SniperState, now: number): boolean {
  const last = state.posted[sniperKey(e)];
  if (!last) return true;
  const age = now - Date.parse(last.at);
  if (e.kind === "restock") return age >= RESTOCK_COOLDOWN_DAYS * DAY;
  if (e.kind === "preorder") return false; // the first pre-order in a market is news once
  return age >= DROP_COOLDOWN_DAYS * DAY || e.cents <= last.cents * (1 - DROP_REPOST_PCT / 100);
}

/** One post per product a run (its best event), new pre-orders first, then restocks, then drops, the most viewed and valued first; new events only. */
export function rankEvents(events: readonly SniperEvent[], state: SniperState, now: number, demand: (id: number) => number = () => 0): SniperEvent[] {
  const score = (e: SniperEvent) => (e.kind === "preorder" ? 2e9 : e.kind === "restock" ? 1e9 : 0) + demand(e.product.id) * 1e4 + (e.kind === "drop" ? e.pct * 100 : 0) + (e.product.marketCents ?? 0) / 100;
  const seen = new Set<string>();
  const ranked = events
    .filter((e) => isNew(e, state, now))
    .sort((a, b) => score(b) - score(a) || sniperKey(a).localeCompare(sniperKey(b)))
    .filter((e) => {
      const k = String(e.product.id);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return spreadGames(ranked);
}

/** At most this many posts of one game lead a run while other games have news; the rest follow (owner, 2026-11-23). */
export const MAX_PER_GAME = 3;

/** The ranked list with each game's first MAX_PER_GAME events in front, in rank order, and every other event after them. */
export function spreadGames(ranked: readonly SniperEvent[]): SniperEvent[] {
  const count = new Map<string, number>();
  const front: SniperEvent[] = [];
  const back: SniperEvent[] = [];
  for (const e of ranked) {
    const g = e.product.line ?? "";
    const n = count.get(g) ?? 0;
    count.set(g, n + 1);
    (n < MAX_PER_GAME ? front : back).push(e);
  }
  return [...front, ...back];
}

/** The state after posting: posted events stamped, entries past both cooldowns forgotten. */
export function recordPosted(state: SniperState, posted: readonly SniperEvent[], now: number): SniperState {
  const keep: SniperState["posted"] = {};
  for (const [k, v] of Object.entries(state.posted)) if (now - Date.parse(v.at) < 30 * DAY) keep[k] = v;
  for (const e of posted) keep[sniperKey(e)] = { at: new Date(now).toISOString(), cents: e.cents };
  return { v: 1, posted: keep, ...(state.lastRun ? { lastRun: state.lastRun } : {}) };
}

// ── the live check ─────────────────────────────────────────────────────────

/** The store path of an offer ref: "handle?variant=1" or a full URL on the store's own host; null for anything else. */
export function productPath(ref: string, base: string): { handle: string; variant: string | null } | null {
  let u: URL;
  try {
    u = /^https?:\/\//.test(ref) ? new URL(ref) : new URL(`${base}/products/${ref}`);
  } catch {
    return null;
  }
  if (u.host.replace(/^www\./, "") !== new URL(base).host.replace(/^www\./, "")) return null;
  const m = u.pathname.match(/\/products\/([^/?#]+)\/?$/);
  if (!m) return null;
  return { handle: decodeURIComponent(m[1]), variant: u.searchParams.get("variant") };
}

/** Shopify's /products/<handle>.js: prices in the shop's cents. */
export interface ShopifyJs {
  available?: boolean;
  variants?: { id: number; available?: boolean; price?: number }[];
}

/**
 * What the store says now: the variant we list (or, with no variant in the ref, the cheapest available one) must be
 * available, and its price no dearer than ours by more than LIVE_PRICE_TOLERANCE. Returns the live price, or why not.
 */
export function judgeLive(js: ShopifyJs | null, variant: string | null, cents: number): { ok: true; cents: number } | { ok: false; why: string } {
  if (!js || !Array.isArray(js.variants) || !js.variants.length) return { ok: false, why: "no product answer" };
  const vs = variant ? js.variants.filter((v) => String(v.id) === variant) : js.variants.filter((v) => v.available);
  if (!vs.length) return { ok: false, why: variant ? "variant gone" : "nothing available" };
  const v = vs.reduce((a, b) => ((b.price ?? Infinity) < (a.price ?? Infinity) ? b : a));
  if (v.available !== true) return { ok: false, why: "sold out now" };
  if (typeof v.price !== "number" || !(v.price > 0)) return { ok: false, why: "no price" };
  if (v.price > cents * (1 + LIVE_PRICE_TOLERANCE)) return { ok: false, why: `dearer now (${v.price} vs ${cents})` };
  return { ok: true, cents: v.price };
}

// ── the message ────────────────────────────────────────────────────────────

export interface DiscordEmbed {
  title: string;
  url: string;
  description: string;
  color: number;
  thumbnail?: { url: string };
  footer: { text: string };
}

export function productUrl(siteUrl: string, slug: string, drop?: string): string {
  return `${siteUrl}/card/${slug}?${UTM}${drop ? `&utm_content=${drop}` : ""}`;
}

/** Riftbound drops name RiftCompare and link it (Rift Google plan, 2026-11-25, item 4: brand searches back to 170+ a week by
 * 15 Dec). The Legacy pre-order page until 13 Dec, then the sealed hub; campaign "brand" so the plan reads these apart. */
export const RIFT_LEGACY_UNTIL = Date.UTC(2026, 11, 14, 0, 0);
export function riftCompareUrl(now: number, drop?: string): string {
  const path = now < RIFT_LEGACY_UNTIL ? "/legacy-preorders" : "/sealed";
  return `https://riftcompare.com${path}?utm_source=discord&utm_medium=social&utm_campaign=brand${drop ? `&utm_content=${drop}` : ""}`;
}

/** One run is one drop: ONE Discord message holding every checked post (owner's cap: at most 3 drops a day across the
 * hub; this feed runs twice a day). The id tags each link (utm_content) so clicks can be read per drop. */
export const dropId = (ms: number): string => `sniper-${new Date(ms).toISOString().slice(0, 13).replace(/[-T]/g, "")}`;
/** The Chrome extension's launch line (owner's ask via the extension thread, 2026-11-22): under every drop for 7 days,
 * then gone by itself. Tagged per channel so clicks are read apart. */
export const EXTENSION_PROMO_UNTIL = Date.UTC(2026, 11, 21, 12, 0);
export function extensionPromo(source: "discord" | "telegram", now: number): string | null {
  if (now >= EXTENSION_PROMO_UNTIL) return null;
  return `🧩 See what you'd save on TCGplayer and other shops: free Chrome extension https://chromewebstore.google.com/detail/fdhpgledimoadpaokiipficepklogmha?utm_source=${source}&utm_medium=social&utm_campaign=extension`;
}

export function dropMessage(embeds: DiscordEmbed[], now = Date.now()): { username: string; content: string; embeds: DiscordEmbed[]; allowed_mentions: { parse: never[] } } {
  const n = embeds.length;
  const promo = extensionPromo("discord", now);
  return {
    username: "Sealed Sniper",
    content: `**Sealed Sniper drop:** ${n} ${n === 1 ? "deal" : "deals"}, each checked at the store just before posting.${promo ? `\n${promo.replace(/(https:\S+)/, "<$1>")}` : ""}`,
    embeds: embeds.slice(0, 10),
    allowed_mentions: { parse: [] },
  };
}

/** Telegram's channel name for the drops (t.me/tcgdealsrestocks, created 2026-11-21). */
export const TELEGRAM_CHANNEL = "@tcgdealsrestocks";

/**
 * The same drop as one plain-text Telegram message: Discord's bold, links and relative timestamps turned into plain text
 * ("HH:MM UTC"), every link tagged utm_source=telegram, kept under Telegram's 4,096 characters (whole deals only).
 */
export function telegramText(embeds: DiscordEmbed[], now = Date.now()): string {
  const plain = (t: string) =>
    t
      .replace(/<t:(\d+):R>/g, (_, s: string) => `at ${new Date(Number(s) * 1000).toISOString().slice(11, 16)} UTC`)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")
      .replace(/\*\*/g, "")
      .replace(/utm_source=discord/g, "utm_source=telegram");
  const parts: string[] = [];
  const promo = extensionPromo("telegram", now);
  const head = (n: number) => `Sealed Sniper drop: ${n} ${n === 1 ? "deal" : "deals"}, each checked at the store just before posting.${promo ? `\n${promo}` : ""}`;
  for (const e of embeds.slice(0, 10)) {
    const part = `${plain(e.title)}\n${plain(e.description)}`;
    if ([head(parts.length + 1), ...parts, part].join("\n\n").length > 4096) break;
    parts.push(part);
  }
  return parts.length ? [head(parts.length), ...parts].join("\n\n") : "";
}

/** One Discord embed for a checked event. `checkedAt` is the live check's time (ms), shown as a live relative timestamp. */
export function embedFor(e: SniperEvent, liveCents: number, checkedAt: number, siteUrl: string, drop?: string): DiscordEmbed {
  const cur = CURRENCY[e.store.market];
  const game = GAME_LABEL[e.product.line ?? ""] ?? "";
  const ts = Math.floor(checkedAt / 1000);
  const lines = [
    `${FLAG[e.store.market]} **${money(liveCents, cur)}** at **${e.store.name}**`,
    e.kind === "preorder"
      ? `The first ${MARKET_NAME[e.store.market]} store we track to take pre-orders for it.`
      : e.kind === "restock" ? "Sold out at our previous check, in stock now." : `Cheapest ${e.store.market} store price was ${money(e.was, cur)} at our previous check (${e.pct}% lower now).`,
    e.product.marketCents ? `TCGplayer market: ${money(e.product.marketCents, "USD")}` : null,
    `${e.kind === "preorder" ? "Open for pre-order" : "In stock"} at the store when checked <t:${ts}:R>. Stock can sell out fast; the store's page has the final word.`,
    `[Compare every store](${productUrl(siteUrl, e.product.slug, drop)})`,
    e.product.line === "rb" ? `Every Riftbound price, every day, on [RiftCompare](${riftCompareUrl(checkedAt, drop)})` : null,
  ].filter(Boolean);
  return {
    title: `${e.kind === "preorder" ? `${FLAG[e.store.market]} First pre-order` : e.kind === "restock" ? "Back in stock" : "Price drop"}: ${e.product.name}`.slice(0, 250),
    url: productUrl(siteUrl, e.product.slug, drop),
    description: lines.join("\n"),
    color: e.kind === "preorder" ? 0xf59e0b : e.kind === "restock" ? 0x22c55e : 0x3b82f6,
    ...(e.product.image ? { thumbnail: { url: e.product.image } } : {}),
    footer: { text: `Sealed Sniper · ${game}${e.product.sealedType ? ` · ${e.product.sealedType}` : ""} · tcgprices.app` },
  };
}
