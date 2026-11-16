// Store vetting (owner, 2026-11-14: "need a system in place to remove scam sites or sites that seem suspicious").
//
// A scam shop looks like a shop: real product names, real photos, prices nobody else can match. Every import judges
// every store again from the day's own data, and a store that fails any rule shows no row anywhere on the site:
//
// 1. BLOCKED: its host is in data/store-blocklist.json (the owner's and visitors' reports; a line per shop, with why).
// 2. (Retired 2026-11-16, owner: "as many stores and listings as possible, don't be too strict on which stores are
//    legit".) A shop on a platform's free address (shop.myshopify.com) used to be refused as having no domain of its
//    own. Many small real shops trade there; a scam one still falls to the blocklist or rule 3.
// 3. TOO CHEAP TO BE TRUE: across at least MIN_PRICED in-stock products worth US$20 or more, its median price is
//    under CHEAP_MEDIAN of TCGplayer's market price. Sealed product has thin margins: the median real shop in every
//    market sits ABOVE market (1.13 to 1.42 on the 2026-11-14 data, 1,063 stores), and no real shop sells its whole
//    shelf at 30% off.
//
// And one offer rule (import-all.ts): a single in-stock price under OFFER_FLOOR of market is left out whoever sells it.
//
// A rule may only refuse. A refused store comes back by itself the day it passes; nothing here is a judgment shown to
// visitors (a refused store is simply absent), and data/public/store-vetting.json lists who was refused and why.
import type { Offer, StoreConfig } from "@/lib/site-types";

export const CHEAP_MEDIAN = 0.7;
export const MIN_PRICED = 5;
export const MIN_REF_CENTS = 2000;
export const OFFER_FLOOR = 0.5;

export interface Refusal { key: string; name: string; host: string; rule: "blocked" | "no-domain" | "too-cheap"; why: string }

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export function vetStores(args: {
  stores: readonly StoreConfig[];
  offers: ReadonlyMap<number, readonly Offer[]>;
  /** TCGplayer's market price in US cents, or null. */
  refCents: (productId: number) => number | null;
  /** Units of a currency per US dollar. */
  fx: Readonly<Record<string, number>>;
  /** Hosts never shown (no "www."), each with the reason it was reported. */
  blocklist?: Readonly<Record<string, string>>;
}): Refusal[] {
  const { stores, offers, refCents, fx, blocklist = {} } = args;
  const ratios = new Map<string, number[]>();
  for (const [id, list] of offers) {
    const ref = refCents(id);
    if (ref == null || ref < MIN_REF_CENTS) continue;
    for (const o of list) {
      if (!o.inStock) continue;
      const usd = o.cents / (fx[o.currency] ?? 1);
      if (!ratios.has(o.source)) ratios.set(o.source, []);
      ratios.get(o.source)!.push(usd / ref);
    }
  }
  const out: Refusal[] = [];
  for (const s of stores) {
    const host = hostOf(s.base);
    const refuse = (rule: Refusal["rule"], why: string) => out.push({ key: s.key, name: s.name, host, rule, why });
    if (!host) refuse("blocked", "no readable address");
    else if (blocklist[host] != null) refuse("blocked", blocklist[host] || "reported");
    else {
      const r = ratios.get(s.key) ?? [];
      if (r.length >= MIN_PRICED && median(r) < CHEAP_MEDIAN)
        refuse("too-cheap", `median price is ${Math.round(median(r) * 100)}% of TCGplayer's market across ${r.length} products`);
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}
