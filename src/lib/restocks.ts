// "Back in stock" events: an independent store's offer that was sold out in the previous committed prices and is in
// stock now. Built by scripts/restocks.ts after each import by diffing the shards against the last commit, kept for
// 7 days in data/public/restocks.json (public data: product id, store key, price, time; nothing private). Display only:
// never a sort, deal, alert or price claim; the store row on the product page stays the price's home.
import fs from "node:fs";
import path from "node:path";

export const RESTOCKS_FILE = path.join(process.cwd(), "data", "public", "restocks.json");
export const KEEP_DAYS = 7;
export const MAX_EVENTS = 800;

export interface RestockEvent {
  /** product id */
  p: number;
  /** store key */
  s: string;
  /** price in the store's own cents */
  c: number;
  /** variant ref, so one restock is one event */
  r: string;
  /** ISO time of the import that saw it back */
  t: string;
}
export interface RestockFile { v: 1; updatedAt: string; events: RestockEvent[] }

/** offer tuple shape (lib/offer-codec.ts): [source, cents, flags, ref]; flags 1 = in stock, 2 = pre-order */
type Tuple = [string, number, number, string, ...unknown[]];
const SKIP = new Set(["tcgplayer", "ebay", "amazon"]);
const key = (t: Tuple) => `${t[0]}|${String(t[3]).split("?")[0]}`;

/** Offers in stock now (flag 1 exactly, never a pre-order) that the previous run listed as sold out (flag 0). A new listing is not a restock. */
export function diffRestocks(prev: Record<string, { o: Tuple[] }> | undefined, cur: Record<string, { o: Tuple[] }>, at: string): RestockEvent[] {
  const out: RestockEvent[] = [];
  if (!prev) return out;
  for (const [pid, e] of Object.entries(cur)) {
    const before = prev[pid];
    if (!before) continue;
    const was = new Map<string, number>();
    for (const t of before.o) if (!SKIP.has(t[0])) was.set(key(t), t[2]);
    for (const t of e.o) {
      if (SKIP.has(t[0]) || t[2] !== 1 || !(t[1] > 0)) continue;
      if (was.get(key(t)) === 0) out.push({ p: Number(pid), s: t[0], c: t[1], r: String(t[3]).split("?")[0], t: at });
    }
  }
  return out;
}

/** Fold new events into the kept list: drop anything older than KEEP_DAYS, never repeat a product + store + variant seen in the last 24 h. */
export function mergeRestocks(old: RestockEvent[], fresh: RestockEvent[], now: Date): RestockEvent[] {
  const cutoff = now.getTime() - KEEP_DAYS * 86_400_000;
  const kept = old.filter((e) => Date.parse(e.t) >= cutoff);
  const recent = new Set(kept.filter((e) => Date.parse(e.t) >= now.getTime() - 86_400_000).map((e) => `${e.p}|${e.s}|${e.r}`));
  const add = fresh.filter((e) => !recent.has(`${e.p}|${e.s}|${e.r}`));
  return [...add, ...kept].sort((a, b) => Date.parse(b.t) - Date.parse(a.t)).slice(0, MAX_EVENTS);
}

export function readRestocks(): RestockFile | null {
  try {
    const f = JSON.parse(fs.readFileSync(RESTOCKS_FILE, "utf8")) as RestockFile;
    return f && f.v === 1 && Array.isArray(f.events) ? f : null;
  } catch {
    return null;
  }
}
