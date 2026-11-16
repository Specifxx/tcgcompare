// The deal agent's per-product verdicts as one static file (/deal-signals.json), built at release from the same files the
// pages read. PROTOTYPE, off unless NEXT_PUBLIC_DEAL_AGENT=1 (lib/deal-agent.ts says what a verdict means). Nothing about a
// visitor is sent or stored: the wishlist lives in the browser, the file is the same for everyone.
import { priceOf, products } from "./data";
import { judge, type DealResult } from "./deal-agent";
import { dayNumber } from "./import/history";
import { dailyBefore, readSetLows } from "./import/store-lows";
import { WINDOW_DAYS as WINDOW } from "./deal-agent";
import type { Market } from "./site-types";

export const dealAgentOn = () => process.env.NEXT_PUBLIC_DEAL_AGENT === "1";

export interface SignalItem { n: string; u: string; m: Partial<Record<Market, { c: number } & Pick<DealResult, "verdict" | "confidence" | "reasons" | "historyDays">>> }
export interface SignalFile { v: 1; generatedAt: string; items: Record<string, SignalItem> }

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function buildSignals(now = new Date()): SignalFile {
  const today = dayNumber(now);
  const lowsBySet = new Map<number, ReturnType<typeof readSetLows>>();
  const items: SignalFile["items"] = {};
  for (const p of products()) {
    const e = priceOf(p.id);
    const byMarket = new Map<Market, number[]>();
    for (const o of e.offers) {
      if (!o.inStock || o.preorder || o.source === "ebay" || o.source === "tcgplayer" || o.source === "amazon" || !(o.cents > 0)) continue;
      byMarket.set(o.market, [...(byMarket.get(o.market) ?? []), o.cents]);
    }
    if (!byMarket.size) continue;
    if (!lowsBySet.has(p.setId)) lowsBySet.set(p.setId, readSetLows(p.setId));
    const lows = lowsBySet.get(p.setId)![p.id] ?? {};
    const m: SignalItem["m"] = {};
    for (const [mk, prices] of byMarket) {
      const nowCents = Math.min(...prices);
      const tcg = mk === "US" ? Object.values(e.tcg)[0]?.market ?? null : null;
      const r = judge({ nowCents, stores: prices.length, medianCents: median(prices), tcgCents: tcg, history: dailyBefore(lows[mk], today, WINDOW) });
      m[mk] = { c: nowCents, verdict: r.verdict, confidence: r.confidence, reasons: r.reasons, historyDays: r.historyDays };
    }
    items[p.id] = { n: p.number ? `${p.name} ${p.number}` : p.name, u: `/card/${p.slug}`, m };
  }
  return { v: 1, generatedAt: now.toISOString(), items };
}
