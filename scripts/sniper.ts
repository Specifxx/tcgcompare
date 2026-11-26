// Sealed Sniper (lib/sniper.ts): after the import and scripts/restocks.ts, before the data commit, post this run's
// verified restocks and price drops of sealed product of every game in SNIPER_LINES to Discord through an
// incoming webhook (the DISCORD_SNIPER_WEBHOOK secret). A no-op until the secret exists; never fatal.
//
// Every candidate is checked once at the store itself (Shopify /products/<handle>.js through lib/import/polite-http.ts)
// right before it is posted: sold out, dearer, no answer, robots.txt or a block means no post. At most MAX_POSTS a run,
// so at most MAX_POSTS + a few store requests a run, all in ONE message (one drop; at most 3 drops a day across the hub) (DECISIONS.md 2026-11-19, "Sealed Sniper").
// SNIPER_DRY=1 checks the stores and prints the posts without sending or saving anything.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { SITE } from "../src/site.config";
import { PRICES_DIR, SUMMARY_FILE } from "../src/lib/price-store";
import { readRestocks } from "../src/lib/restocks";
import { SITE_URL } from "../src/lib/site";
import { RequestBudget, StopStore, StoreSession } from "../src/lib/import/polite-http";
import { DROP_LOG_FILE, appendDrops, type DropLog } from "../src/lib/sniper-board";
import {
  dropEvents,
  preorderEvents,
  dropId,
  dropMessage,
  biggestGap,
  gapLine,
  priceGap,
  PRICE_GAP_UNTIL,
  type PriceGap,
  type DiscordEmbed,
  embedFor,
  emptySniperState,
  judgeLive,
  MAX_POSTS,
  MAX_RESTOCKS,
  productPath,
  rankEvents,
  recordPosted,
  sniperKey,
  restockEvents,
  type ShopifyJs,
  type SniperEvent,
  type SniperProduct,
  type SniperState,
  type SniperStore,
  type Tuple,
  telegramText,
  TELEGRAM_CHANNEL,
} from "../src/lib/sniper";

const STATE_FILE = path.join(process.cwd(), "data", "state", "sniper.json");
const CATALOG_FILE = path.join(process.cwd(), "data", "public", "catalog.json");
const META_FILE = path.join(process.cwd(), "data", "public", "meta.json");
const DEMAND_FILE = path.join(process.cwd(), "data", "demand.json");

const readJson = <T>(f: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")) as T;
  } catch {
    return null;
  }
};
// SNIPER_BASE (a commit) is for a dry run against an older data commit; the workflow compares with HEAD, the last commit.
const BASE = process.env.SNIPER_BASE || "HEAD";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(hook: string, embeds: DiscordEmbed[], lead: string | null): Promise<boolean> {
  const body = JSON.stringify(dropMessage(embeds, Date.now(), lead));
  for (let i = 0; i < 2; i++) {
    const r = await fetch(`${hook}?wait=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (r.status === 429) {
      const j = (await r.json().catch(() => ({}))) as { retry_after?: number };
      await sleep(Math.min(30, Number(j.retry_after) || 2) * 1000 + 250);
      continue;
    }
    if (!r.ok) console.log(`sniper: Discord answered HTTP ${r.status}`);
    return r.ok;
  }
  return false;
}

/** One message to the Telegram channel (TELEGRAM_BOT_TOKEN; the bot is an admin of t.me/tcgdealsrestocks). */
async function postTelegram(token: string, chat: string, text: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) console.log(`sniper: Telegram answered HTTP ${r.status}`);
    return r.ok;
  } catch (e) {
    console.log(`sniper: Telegram ${(e as Error).message}`);
    return false;
  }
}

async function main() {
  // Discord's "Copy Webhook URL" can give discordapp.com or a ptb./canary. host: all are the same API, so normalise to discord.com.
  const hook = process.env.DISCORD_SNIPER_WEBHOOK?.trim().replace(/^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\//, "https://discord.com/api/webhooks/");
  const dry = process.env.SNIPER_DRY === "1";
  const tgToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  const tgChat = process.env.TELEGRAM_CHAT_ID?.trim() || TELEGRAM_CHANNEL;
  const discordOk = !!hook?.startsWith("https://discord.com/api/webhooks/");
  if (hook && !discordOk) console.log(`sniper: DISCORD_SNIPER_WEBHOOK is set but is not a Discord webhook URL (starts ${JSON.stringify(hook.slice(0, 24))})`);
  if (!dry && !discordOk && !tgToken) {
    console.log("sniper: no Discord webhook and no Telegram bot, nothing posted");
    return;
  }
  const catalog = readJson<{ sets: { id: number; line?: string }[]; products: { id: number; slug: string; name: string; setId: number; sealedType?: string | null; image?: string | null; kind: string }[] }>(CATALOG_FILE);
  const summary = readJson<Record<string, { t?: Record<string, { market?: number | null }> }>>(SUMMARY_FILE);
  const meta = readJson<{ fx?: Record<string, number> }>(META_FILE);
  const restocks = readRestocks();
  if (!catalog || !summary || !meta?.fx) {
    console.log("sniper: catalog, summary or fx missing, nothing posted");
    return;
  }
  const lineOf = new Map(catalog.sets.map((s) => [s.id, s.line ?? null]));
  const products = new Map<number, SniperProduct>();
  for (const p of catalog.products) {
    if (p.kind !== "sealed") continue;
    products.set(p.id, { id: p.id, slug: p.slug, name: p.name, sealedType: p.sealedType ?? null, image: p.image ?? null, line: lineOf.get(p.setId) ?? null, marketCents: summary[String(p.id)]?.t?.Normal?.market ?? null });
  }
  const stores = new Map<string, SniperStore>(SITE.stores.map((s) => [s.key, { key: s.key, name: s.name, base: s.base, market: s.market }]));
  const demand = readJson<{ views?: Record<string, [number, number]> }>(DEMAND_FILE)?.views ?? {};
  const views = (id: number) => {
    const p = products.get(id);
    return p ? demand[`/card/${p.slug}`]?.[0] ?? 0 : 0;
  };

  // this run's shards and the last commit's
  const events: SniperEvent[] = [];
  const cur: Record<string, { o: Tuple[] }> = {};
  for (const f of fs.readdirSync(PRICES_DIR).filter((n) => n.endsWith(".json"))) {
    const now = readJson<Record<string, { o: Tuple[] }>>(path.join(PRICES_DIR, f));
    if (!now) continue;
    Object.assign(cur, now);
    let prev: Record<string, { o: Tuple[] }> | undefined;
    try {
      prev = JSON.parse(execFileSync("git", ["show", `${BASE}:data/public/prices/${f}`], { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).toString());
    } catch {
      prev = undefined;
    }
    events.push(...dropEvents({ prev, cur: now, products, stores, fx: meta.fx }));
    events.push(...preorderEvents({ prev, cur: now, products, stores, fx: meta.fx }));
  }
  // only this run's restocks: a Restocks step that failed leaves an old file, never re-posted
  const fresh = restocks && (dry || Date.now() - Date.parse(restocks.updatedAt) < 3 * 3_600_000);
  if (restocks && fresh) events.push(...restockEvents({ events: restocks.events, at: restocks.updatedAt, products, stores, fx: meta.fx, offers: (id) => cur[String(id)]?.o ?? [] }));

  const state = readJson<SniperState>(STATE_FILE) ?? emptySniperState();
  const ranked = rankEvents(events, state, Date.now(), views);
  console.log(`sniper: ${events.length} candidates, ${ranked.length} new`);

  // check at the store, then post, one at a time, until MAX_POSTS are out (at most 3 checks per post slot)
  const budget = new RequestBudget(MAX_POSTS * 3 * 2 + 10);
  const sessions = new Map<string, StoreSession>();
  const posted: SniperEvent[] = [];
  const embeds: DiscordEmbed[] = [];
  const drop = dropId(Date.now());
  const why: Record<string, number> = {};
  const gaps: (PriceGap | null)[] = [];
  // restocks first, but a few slots kept for drops: at most MAX_RESTOCKS restocks, the rest drops (or restocks, when no drop)
  const drops = ranked.filter((e) => e.kind === "drop").length;
  const restockCap = Math.max(MAX_RESTOCKS, MAX_POSTS - drops);
  for (const e of ranked) {
    if (posted.length >= MAX_POSTS || budget.left < 2) break;
    if (e.kind === "restock" && posted.filter((x) => x.kind === "restock").length >= restockCap) continue;
    const at = productPath(e.ref, e.store.base);
    if (!at) {
      if (dry) console.log(`[dry] no product path: ${e.store.key} ${e.ref}`);
      why["not a Shopify product path"] = (why["not a Shopify product path"] ?? 0) + 1;
      continue;
    }
    let s = sessions.get(e.store.base);
    if (!s) sessions.set(e.store.base, (s = new StoreSession(e.store.base, { budget, perStoreCap: 4, deadline: Date.now() + 10 * 60_000 })));
    let js: ShopifyJs | null = null;
    // SNIPER_NOCHECK=1 (dry runs only, where stores cannot be reached): pretend the store agreed, to read the posts
    if (dry && process.env.SNIPER_NOCHECK === "1") js = { variants: [{ id: Number(at.variant) || 0, available: true, price: e.cents }] };
    else try {
      js = await s.getJson<ShopifyJs>(`/products/${encodeURIComponent(at.handle)}.js`);
    } catch (err) {
      if (!(err instanceof StopStore)) throw err;
    }
    const checkedAt = Date.now();
    const v = judgeLive(js, at.variant, e.cents);
    if (!v.ok) {
      why[v.why.replace(/ \(.*/, "")] = (why[v.why.replace(/ \(.*/, "")] ?? 0) + 1;
      continue;
    }
    const embed = embedFor(e, v.cents, checkedAt, SITE_URL, drop);
    if (dry) console.log(`[dry] ${embed.title}\n${embed.description}\n`);
    embeds.push(embed);
    posted.push({ ...e, cents: v.cents });
    gaps.push(priceGap(e, v.cents, cur[String(e.product.id)]?.o ?? [], stores, meta.fx));
  }
  // one run, one message (one drop) to each channel: nothing is recorded as posted unless one of them took it
  // the price-gap hook (lib/sniper.ts): the biggest real spread among this drop's posts, only through the sale
  const gap = Date.now() < PRICE_GAP_UNTIL ? biggestGap(gaps) : null;
  const lead = gap ? gapLine(gap, SITE_URL, drop, Date.now()) : null;
  console.log(`sniper: price-gap hook ${lead ?? "none (no spread worth leading with)"}`);
  if (dry && embeds.length) console.log(`[dry] telegram:\n${telegramText(embeds, Date.now(), lead)}\n`);
  if (!dry && embeds.length) {
    const sentDiscord = discordOk ? await post(hook!, embeds, lead) : false;
    const sentTelegram = tgToken ? await postTelegram(tgToken, tgChat, telegramText(embeds, Date.now(), lead)) : false;
    if (!sentDiscord && !sentTelegram) posted.length = 0;
  }
  console.log(`sniper: ${posted.length} posted${dry ? " (dry run)" : ""}; not posted: ${JSON.stringify(why)}`);
  if (dry) return;
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const next = recordPosted(state, posted, Date.now());
  next.lastRun = { at: new Date().toISOString(), candidates: events.length, fresh: ranked.length, posted: posted.length, skipped: why };
  fs.writeFileSync(STATE_FILE, JSON.stringify(next));
  // the public drop log /restocks shows with its votes (lib/sniper-board.ts): only what was really posted
  if (posted.length) fs.writeFileSync(DROP_LOG_FILE, JSON.stringify(appendDrops(readJson<DropLog>(DROP_LOG_FILE), posted, sniperKey, Date.now())));
}

main().catch((e) => console.log(`sniper: ${(e as Error).message}`));
