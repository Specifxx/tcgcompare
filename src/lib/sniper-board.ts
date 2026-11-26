import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { SniperEvent } from "./sniper";

// THE SNIPER DROP LOG (deal board, phase one; COO's OzBargain study, 2026-11-26). Every drop the Sealed Sniper
// actually posts to Discord or Telegram is appended to data/public/sniper-drops.json, kept DROP_LOG_DAYS and at most
// DROP_LOG_MAX entries, so /restocks can show the same drops with hot / cold / expired votes
// (components/DropVotes.tsx; votes live at riftcompare.com/api/deal-votes). Display only: votes order nothing.

export const DROP_LOG_DAYS = 14;
export const DROP_LOG_MAX = 120;

export interface LoggedDrop {
  /** 12 hex characters, stable for this post (riftcompare's DROP_ID pattern) */
  id: string;
  /** when it was posted (ISO) */
  at: string;
  kind: SniperEvent["kind"];
  /** product id, store key, live price in the store's own currency (cents) */
  p: number;
  s: string;
  c: number;
  /** a drop's previous price and percentage */
  was?: number;
  pct?: number;
}
export interface DropLog {
  v: 1;
  updatedAt: string;
  drops: LoggedDrop[];
}

export const dropLogId = (key: string, at: string): string => createHash("sha1").update(`${key}|${at}`).digest("hex").slice(0, 12);

/** The log with this run's posted events added (newest first), old and surplus entries dropped. */
export function appendDrops(log: DropLog | null, posted: readonly SniperEvent[], key: (e: SniperEvent) => string, now: number): DropLog {
  const at = new Date(now).toISOString();
  const fresh: LoggedDrop[] = posted.map((e) => ({
    id: dropLogId(key(e), at),
    at,
    kind: e.kind,
    p: e.product.id,
    s: e.store.key,
    c: e.cents,
    ...(e.kind === "drop" ? { was: e.was, pct: e.pct } : {}),
  }));
  const cut = now - DROP_LOG_DAYS * 86_400_000;
  const seen = new Set<string>();
  const drops = [...fresh, ...(log?.drops ?? [])]
    .filter((d) => Date.parse(d.at) >= cut && !seen.has(d.id) && seen.add(d.id))
    .slice(0, DROP_LOG_MAX);
  return { v: 1, updatedAt: at, drops };
}

export const DROP_LOG_FILE = path.join(process.cwd(), "data", "public", "sniper-drops.json");

/** The published log, or null when it has not been written yet. */
export function readDropLog(): DropLog | null {
  try {
    const f = JSON.parse(fs.readFileSync(DROP_LOG_FILE, "utf8")) as DropLog;
    return f && f.v === 1 && Array.isArray(f.drops) ? f : null;
  } catch {
    return null;
  }
}
