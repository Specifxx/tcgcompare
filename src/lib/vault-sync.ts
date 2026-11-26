// MY COLLECTION FOLLOWS A SIGNED-IN MEMBER (2026-11-26, owner: the sealed stash tracker, move 5 of the deal-site study;
// DECISIONS.md "A signed-in member's collection follows them, and a weekly stash email").
//
// The list still lives in this browser (lib/vault.ts) and every page still reads it from there. When the visitor is signed in, it is
// ALSO kept with their account on RiftCompare's /api/sister-premium/stash (the same token as their watches), so it follows them to
// another phone or computer, and the weekly value email they can switch on is built from it.
//
// Sync is a three-way merge against the last list both sides agreed on (`base`), and every write names the server revision it was
// built on; a stale write comes back 409 with the current list and is merged again. So an item added on the phone and another removed
// on the laptop both survive, a quantity changed on one side only takes that side's number, and a quantity changed on both keeps the
// larger (never a sum: a sync never doubles a box). Pure apart from the guarded storage and fetch helpers at the bottom.
import { CURRENCY, type Market } from "./site-types";
import { itemKey, parseVault, readVault, writeVault, VAULT_MAX_ITEMS, type VaultItem } from "./vault";
import { PREMIUM_SERVICE, readStored } from "./premium-member";

export const STASH_API = `${PREMIUM_SERVICE}/api/sister-premium/stash`;
export const SYNC_KEY = "ce_vault_sync_v1";
export const SYNC_EVENT = "ce-vault-sync";

/** One item as RiftCompare stores it (lib/sister-stash.ts there): short keys, display fields for this browser only. */
export interface WireItem {
  id: string;
  m: string;
  q: number;
  a: number;
  at: string;
  n?: string;
  h?: string;
  img?: string;
}

export function toWire(i: VaultItem): WireItem {
  const w: WireItem = { id: i.id, m: i.market, q: i.qty, a: i.addedCents > 0 ? Math.round(i.addedCents) : 0, at: i.addedAt };
  if (i.name) w.n = i.name.slice(0, 200);
  if (i.href?.startsWith("/")) w.h = i.href;
  if (i.image?.startsWith("https://")) w.img = i.image;
  return w;
}

export function fromWire(w: WireItem): VaultItem | null {
  const currency = CURRENCY[w.m as Market];
  if (!currency || typeof w.id !== "string" || !(w.q > 0)) return null;
  return {
    id: w.id,
    name: w.n || "A product you own",
    href: w.h || "/sealed",
    image: w.img ?? null,
    market: w.m,
    currency,
    addedCents: w.a > 0 ? w.a : 0,
    qty: w.q,
    addedAt: w.at || new Date(0).toISOString(),
  };
}

const fromWireList = (list: WireItem[]) => parseVault(JSON.stringify(list.map(fromWire).filter((x): x is VaultItem => !!x)));

/**
 * The three-way merge. `base` is the list both sides last agreed on (empty the first time this browser syncs, which makes it a
 * union). Local order first, then anything only the server has.
 */
export function mergeThreeWay(base: VaultItem[], local: VaultItem[], remote: VaultItem[]): VaultItem[] {
  const B = new Map(base.map((i) => [itemKey(i), i]));
  const R = new Map(remote.map((i) => [itemKey(i), i]));
  const out: VaultItem[] = [];
  const done = new Set<string>();
  const pick = (k: string, l: VaultItem | undefined, r: VaultItem | undefined): VaultItem | null => {
    const b = B.get(k);
    if (l && r) {
      const qty = b && l.qty === b.qty ? r.qty : b && r.qty === b.qty ? l.qty : Math.max(l.qty, r.qty);
      return {
        ...r,
        ...l,
        qty,
        addedCents: l.addedCents || r.addedCents,
        addedAt: l.addedAt < r.addedAt ? l.addedAt : r.addedAt,
        image: l.image ?? r.image ?? null,
      };
    }
    const only = (l ?? r)!;
    // In the base and gone from one side: that side removed it. Keep it only if the other side changed it since.
    if (b) return only.qty === b.qty ? null : only;
    return only; // new on one side
  };
  for (const l of local) {
    const k = itemKey(l);
    if (done.has(k)) continue;
    done.add(k);
    const v = pick(k, l, R.get(k));
    if (v) out.push(v);
  }
  for (const r of remote) {
    const k = itemKey(r);
    if (done.has(k)) continue;
    done.add(k);
    const v = pick(k, undefined, r);
    if (v) out.push(v);
  }
  return out.slice(0, VAULT_MAX_ITEMS);
}

/** Same items, same quantities (order and display fields aside): nothing to write. */
export function sameList(a: VaultItem[], b: VaultItem[]): boolean {
  if (a.length !== b.length) return false;
  const m = new Map(a.map((i) => [itemKey(i), i.qty]));
  return b.every((i) => m.get(itemKey(i)) === i.qty);
}

export interface SyncState {
  /** whose list this browser last synced (a different account starts again from an empty base) */
  who: string;
  rev: number;
  base: WireItem[];
  weekly: boolean;
  lastSentAt: string | null;
  at: number;
}

export function parseSyncState(raw: string | null): SyncState | null {
  try {
    const v = JSON.parse(raw || "null") as Partial<SyncState> | null;
    if (!v || typeof v.who !== "string" || !Number.isInteger(v.rev) || !Array.isArray(v.base)) return null;
    return { who: v.who, rev: v.rev as number, base: v.base as WireItem[], weekly: v.weekly === true, lastSentAt: typeof v.lastSentAt === "string" ? v.lastSentAt : null, at: Number(v.at) || 0 };
  } catch {
    return null;
  }
}

// ── The server ─────────────────────────────────────────────────────────────────────────────────────────────────────────

type Answer = { ok?: boolean; conflict?: boolean; rev?: number; items?: WireItem[]; weekly?: boolean; lastSentAt?: string | null; error?: string };
export type Post = (body: Record<string, unknown>) => Promise<{ status: number; json: Answer }>;

const realPost: Post = async (body) => {
  const r = await fetch(STASH_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "omit" });
  return { status: r.status, json: ((await r.json().catch(() => ({}))) ?? {}) as Answer };
};

export type SyncResult = { kind: "synced"; state: SyncState; items: VaultItem[] } | { kind: "signed-out" } | { kind: "offline"; message: string };

/**
 * One sync: read the server, merge, write back if anything differs. Pure given `post`, `local` and `prev`; the caller stores
 * the answer (runSync below). Retries a conflict twice, then reports it.
 */
export async function syncOnce(token: string, who: string, local: VaultItem[], prev: SyncState | null, post: Post = realPost): Promise<SyncResult> {
  const base = prev && prev.who === who ? fromWireList(prev.base) : [];
  // This browser last synced ANOTHER account: its list is that account's, so this one takes its own from the server and never
  // inherits the other's items.
  if (prev && prev.who !== who) local = [];
  let got = await post({ token, op: "get" });
  for (let attempt = 0; attempt < 3; attempt++) {
    if (got.status === 401) return { kind: "signed-out" };
    if (!got.json.ok && !got.json.conflict) return { kind: "offline", message: got.json.error || "Couldn't reach your account." };
    const rev = got.json.rev ?? 0;
    const remote = fromWireList(got.json.items ?? []);
    const merged = mergeThreeWay(base, local, remote);
    const state = (r: number, list: VaultItem[]): SyncState => ({ who, rev: r, base: list.map(toWire), weekly: got.json.weekly === true || (got.json.weekly == null && !!prev?.weekly), lastSentAt: got.json.lastSentAt ?? prev?.lastSentAt ?? null, at: Date.now() });
    if (sameList(merged, remote) && rev > 0) return { kind: "synced", state: state(rev, merged), items: merged };
    if (!merged.length && rev === 0) return { kind: "synced", state: state(0, merged), items: merged };
    const put = await post({ token, op: "put", baseRev: rev, items: merged.map(toWire) });
    if (put.status === 401) return { kind: "signed-out" };
    if (put.json.ok && typeof put.json.rev === "number") return { kind: "synced", state: state(put.json.rev, merged), items: merged };
    if (put.status !== 409) return { kind: "offline", message: put.json.error || "Couldn't save to your account." };
    got = put; // the conflict carries the current list: merge again on top of it
  }
  return { kind: "offline", message: "Your list changed on another device at the same moment. It will sync again shortly." };
}

/** The account a token names (its `sub`), read without checking it: only to tell one signed-in account from another here. */
export function accountOf(token: string, fallback: string): string {
  try {
    const part = token.split(".")[1] ?? "";
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.sub === "string" && json.sub ? json.sub : fallback;
  } catch {
    return fallback;
  }
}

// ── In the browser ─────────────────────────────────────────────────────────────────────────────────────────────────────

export function readSyncState(): SyncState | null {
  try {
    return parseSyncState(localStorage.getItem(SYNC_KEY));
  } catch {
    return null;
  }
}

function writeSyncState(s: SyncState | null): void {
  try {
    if (s) localStorage.setItem(SYNC_KEY, JSON.stringify(s));
    else localStorage.removeItem(SYNC_KEY);
  } catch {
    /* private window: the next visit syncs again from scratch, which is a union, never a loss */
  }
}

export type SyncStatus = { phase: "idle" | "syncing" | "synced" | "offline" | "signed-out"; at: number; message?: string; weekly: boolean; lastSentAt: string | null };
let status: SyncStatus = { phase: "idle", at: 0, weekly: false, lastSentAt: null };
const emit = (s: Partial<SyncStatus>) => {
  status = { ...status, ...s };
  try {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  } catch {
    /* no window */
  }
};
export const syncStatus = () => status;

let running: Promise<void> | null = null;
let again = false;

/** Sync now (single flight: a call while one runs queues exactly one more). Does nothing signed out. */
export function runSync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      const member = readStored();
      if (!member) {
        emit({ phase: "signed-out" });
        break;
      }
      const prev = readSyncState();
      if (prev) emit({ weekly: prev.weekly, lastSentAt: prev.lastSentAt });
      emit({ phase: "syncing" });
      const local = readVault();
      const res = await syncOnce(member.t, accountOf(member.t, member.who), local, prev);
      if (res.kind === "synced") {
        // Merge in anything changed here while the request was out (base = what we sent), and write only a real difference.
        const now = readVault();
        const next = mergeThreeWay(local, now, res.items);
        if (!sameList(now, next)) writeVault(next);
        writeSyncState(res.state);
        emit({ phase: "synced", at: Date.now(), weekly: res.state.weekly, lastSentAt: res.state.lastSentAt, message: undefined });
      } else if (res.kind === "signed-out") emit({ phase: "signed-out" });
      else emit({ phase: "offline", message: res.message });
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let started = false;

/** Keep the account copy current on this page: once now, then shortly after every change, and when the tab comes back online. */
export function startVaultSync(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  let lastRun = 0;
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      lastRun = Date.now();
      void runSync();
    }, 1200);
  };
  window.addEventListener("ce-vault-change", () => {
    // A change while a sync is out (ours included) runs one more pass; that pass writes nothing when nothing differs.
    if (running) again = true;
    else soon();
  });
  window.addEventListener("online", soon);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastRun > 60_000) soon();
  });
  lastRun = Date.now();
  void runSync();
}

/** Switch the weekly value email on or off for the signed-in member. */
export async function setWeekly(on: boolean, post: Post = realPost): Promise<{ ok: true } | { ok: false; message: string }> {
  const member = readStored();
  if (!member) return { ok: false, message: "Sign in again to change your emails." };
  try {
    const r = await post({ token: member.t, op: "weekly", on });
    if (!r.json.ok) return { ok: false, message: r.status === 401 ? "Sign in again to change your emails." : r.json.error || "Couldn't save that. Try again." };
    const s = readSyncState();
    if (s) writeSyncState({ ...s, weekly: on });
    emit({ weekly: on });
    return { ok: true };
  } catch {
    return { ok: false, message: "Couldn't save that. Check your connection and try again." };
  }
}
