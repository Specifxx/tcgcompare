// Backtest of the deal agent's judgement (src/lib/deal-agent.ts) against real daily price history. Read-only: it writes
// out/deal-agent-backtest.json and prints a table. No model, no network, no cost.
//
// The question: when the agent says "genuinely low", how often does the price fall further within the next HORIZON days
// (a wrong call: the user would have done better waiting)? Compared with the same rate for every other verdict and for a
// naive "dropped since yesterday" rule, which is what most deal feeds use.
//
//   npx tsx scripts/deal-agent-backtest.ts <dir of YYYY-MM-DD.json files> [more dirs]
// Each file: { "day": "2026-11-16", "prices": { "<id>": { "<MARKET>": cents } } }  (RiftCompare's sealed history layout)
//          or { "prices": { "<id>": cents } } (its card layout, one series per id).
// TCG Prices' own history (data/history) is 2 days deep at first release; point this at it as it grows.
import fs from "node:fs";
import path from "node:path";
import { judge, WINDOW_DAYS, type Verdict } from "../src/lib/deal-agent";

const HORIZON = Number(process.env.HORIZON ?? 14);
const WORSE = 0.03; // a "regret" is a later price 3% or more under the price at the call
const START = 14; // first day a series can be judged with history

type Series = number[];
const series = new Map<string, Series>();
for (const dir of process.argv.slice(2)) {
  const files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { prices: Record<string, number | Record<string, number>> };
    for (const [id, v] of Object.entries(j.prices)) {
      if (typeof v === "number") (series.get(`${path.basename(dir)}:${id}`) ?? series.set(`${path.basename(dir)}:${id}`, []).get(`${path.basename(dir)}:${id}`)!).push(v);
      else for (const [m, c] of Object.entries(v)) (series.get(`${path.basename(dir)}:${id}:${m}`) ?? series.set(`${path.basename(dir)}:${id}:${m}`, []).get(`${path.basename(dir)}:${id}:${m}`)!).push(c);
    }
  }
}

interface Tally { calls: number; regret: number; big: number; saved: number }
const empty = (): Tally => ({ calls: 0, regret: 0, big: 0, saved: 0 });
const by: Record<string, Tally> = { "genuine-low": empty(), good: empty(), typical: empty(), high: empty(), unclear: empty(), "naive-drop": empty(), "genuine-low, earlier half": empty(), "genuine-low, later half": empty(), "all-days": empty() };
let usable = 0;

for (const s of series.values()) {
  if (s.length < START + HORIZON + 1) continue;
  usable++;
  for (let t = START; t + HORIZON < s.length; t++) {
    const now = s[t];
    const hist = s.slice(Math.max(0, t - WINDOW_DAYS), t);
    const futureMin = Math.min(...s.slice(t + 1, t + 1 + HORIZON));
    const wrong = futureMin <= now * (1 - WORSE);
    const big = futureMin <= now * 0.9;
    const tally = (k: string) => { const b = by[k]; b.calls++; if (wrong) b.regret++; if (big) b.big++; };
    // Stores and median are unknown in history, so the backtest judges on history alone (stores=3, no median, no TCG).
    const r = judge({ nowCents: now, stores: 3, medianCents: null, history: hist });
    tally(r.verdict as Verdict);
    tally("all-days");
    if (r.verdict === "genuine-low") tally(t < s.length / 2 ? "genuine-low, earlier half" : "genuine-low, later half"); // the rule was tuned on the whole run: a split shows if it holds out of sample
    if (now <= s[t - 1] * 0.95) tally("naive-drop");
  }
}

const rows = Object.entries(by).map(([k, b]) => ({ rule: k, calls: b.calls, laterLower3pct: b.calls ? +(100 * b.regret / b.calls).toFixed(1) : null, laterLower10pct: b.calls ? +(100 * b.big / b.calls).toFixed(1) : null }));
console.log(`series judged: ${usable} of ${series.size} (need ${START + HORIZON + 1}+ days); horizon ${HORIZON} days`);
console.table(rows);
fs.mkdirSync("out", { recursive: true });
fs.writeFileSync("out/deal-agent-backtest.json", JSON.stringify({ horizonDays: HORIZON, seriesJudged: usable, seriesTotal: series.size, rows }, null, 2));
