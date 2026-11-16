// THE DEAL AGENT'S JUDGEMENT (prototype, 2026-11-16; owner approved "an AI deal agent that tells a user when a price on
// their wishlist is genuinely low"). PURE and DETERMINISTIC: no model call, no network, no cost. The verdict is made
// of numbers we already hold (today's store prices, TCGplayer's market, our own daily history) and each reason it
// gives is one of those numbers. A model may later WORD the reasons; it never decides the verdict.
//
// "Genuinely low" means: the cheapest in-stock store price today is at or under everything we saw it cost in the last
// 60 days AND clearly under its usual price AND not a data glitch. We never read a store's own "was" or "compare at"
// price, so a fake discount cannot make a verdict. With under MIN_HISTORY days of history the best verdict is "good":
// we say how little history there is instead of calling a low we cannot back.
//
// Prices are in one market's own currency and are never converted. Item price only, shipping excluded, like the site.

export const MIN_HISTORY_DAYS = 14;
export const WINDOW_DAYS = 60;
/** A price this far under the usual one is treated as a possible glitch, not a deal. */
export const GLITCH_BELOW_HISTORY = 0.6;
export const GLITCH_BELOW_STORES = 0.4; // the import's own band: under 40% of the median is dropped
export const GLITCH_BELOW_TCG = 0.5;
/** A standout low is at least this far (percent) under the 60-day median price. */
export const DEEP_PCT = 15;

export type Verdict = "genuine-low" | "good" | "typical" | "high" | "unclear";

export interface DealInput {
  /** Cheapest in-stock store price now (never eBay, Amazon or TCGplayer), smallest currency unit. */
  nowCents: number;
  /** In-stock stores in this market. */
  stores: number;
  /** Median in-stock store price in this market; null when unknown. */
  medianCents: number | null;
  /** TCGplayer's market price in the same currency (US only); null when unknown. */
  tcgCents?: number | null;
  /** The cheapest in-stock price on each earlier day, oldest first, today excluded. */
  history: number[];
}

export interface DealResult {
  verdict: Verdict;
  confidence: "high" | "medium" | "low";
  /** Plain statements, each backed by a number above. */
  reasons: string[];
  historyDays: number;
  /** Today's price against the 60-day median, percent (negative = cheaper); null without enough history. */
  vsUsualPct: number | null;
  /** The lowest price in the window, if there is any history. */
  windowLowCents: number | null;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const pct = (a: number, b: number) => Math.round(((a - b) / b) * 100);

export function judge(i: DealInput): DealResult {
  const hist = i.history.filter((x) => x > 0).slice(-WINDOW_DAYS);
  const days = hist.length;
  const base = { historyDays: days, vsUsualPct: null as number | null, windowLowCents: days ? Math.min(...hist) : null };
  const out = (verdict: Verdict, confidence: DealResult["confidence"], reasons: string[], extra: Partial<DealResult> = {}): DealResult => ({ verdict, confidence, reasons, ...base, ...extra });

  if (!(i.nowCents > 0)) return out("unclear", "low", ["No store has it in stock right now."]);
  if (i.stores < 2) return out("unclear", "low", ["Only one store has it in stock, so there is nothing to check its price against."]);

  // Data-quality guards come first: a price that is too good to be true is a question, not a deal.
  if (i.medianCents && i.stores >= 3 && i.nowCents < i.medianCents * GLITCH_BELOW_STORES) {
    return out("unclear", "low", [`The cheapest price is ${100 - Math.round((i.nowCents / i.medianCents) * 100)}% under what the other stores charge, which is more likely a wrong listing than a deal.`]);
  }
  if (i.tcgCents && i.nowCents < i.tcgCents * GLITCH_BELOW_TCG) {
    return out("unclear", "low", ["It is under half of TCGplayer's market price, which is more likely a wrong listing than a deal."]);
  }

  const reasons: string[] = [];
  const vsStores = i.medianCents ? pct(i.nowCents, i.medianCents) : null;
  if (vsStores != null && i.stores >= 3) reasons.push(vsStores < 0 ? `${-vsStores}% under the middle price of the ${i.stores} stores that have it.` : vsStores > 0 ? `${vsStores}% over the middle price of the ${i.stores} stores that have it.` : `Level with the middle price of the ${i.stores} stores that have it.`);
  const vsTcg = i.tcgCents ? pct(i.nowCents, i.tcgCents) : null;
  if (vsTcg != null) reasons.push(vsTcg < 0 ? `${-vsTcg}% under TCGplayer's market price.` : vsTcg > 0 ? `${vsTcg}% over TCGplayer's market price.` : `Level with TCGplayer's market price.`);

  if (days < MIN_HISTORY_DAYS) {
    reasons.push(`We have only ${days} day${days === 1 ? "" : "s"} of its price history, so we can't yet say whether this is its lowest.`);
    const underStores = vsStores != null && i.stores >= 3 && vsStores <= -15;
    const overTcg = vsTcg != null && vsTcg >= 10;
    return out(overTcg ? "high" : underStores ? "good" : "typical", "low", reasons);
  }

  const usual = median(hist);
  const low = Math.min(...hist);
  const vsUsual = pct(i.nowCents, usual);
  const extra = { vsUsualPct: vsUsual };
  if (i.nowCents < usual * GLITCH_BELOW_HISTORY) {
    return out("unclear", "low", [`It is ${-vsUsual}% under its usual price, far more than prices here normally move, so we are not calling it a deal until a second day confirms it.`], extra);
  }
  const confidence: DealResult["confidence"] = days >= 30 && i.stores >= 3 ? "high" : "medium";
  const underUsual = vsUsual <= -8;
  const atLow = i.nowCents <= low * 1.01;
  reasons.unshift(vsUsual < 0 ? `${-vsUsual}% under its usual price over the last ${days} days.` : vsUsual > 0 ? `${vsUsual}% over its usual price over the last ${days} days.` : `Right at its usual price over the last ${days} days.`);
  if (atLow) reasons.splice(1, 0, `The lowest we have seen in ${days} days.`);
  else reasons.splice(1, 0, `Its lowest in ${days} days was ${Math.abs(pct(low, i.nowCents))}% below today's price.`);

  // Backtest on 55 days of RiftCompare sealed history (scripts/deal-agent-backtest.ts): a first-day dip was followed by a
  // lower price within two weeks 57% of the time against 38% when it had already held a day, and a shallow dip (8-15%)
  // 56% against 34% for 15% or more. So a "genuine low" must be deep AND must have held for a second day.
  const held = hist[hist.length - 1] <= i.nowCents * 1.02;
  const deep = vsUsual <= -DEEP_PCT;
  if (atLow && deep && held) return out("genuine-low", confidence, reasons, extra);
  if (atLow && underUsual) {
    reasons.push(!held ? "It only dropped today; we'll call it genuinely low if it is still this price tomorrow." : `It is under its usual price but by less than ${DEEP_PCT}%, so not a standout.`);
    return out("good", confidence, reasons, extra);
  }
  if (vsUsual <= -3) return out("good", confidence, reasons, extra);
  if (vsUsual >= 10) return out("high", confidence, reasons, extra);
  return out("typical", confidence, reasons, extra);
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  "genuine-low": "Genuinely low",
  good: "Good price",
  typical: "Usual price",
  high: "Pricey right now",
  unclear: "Can't tell yet",
};
