// THE DEAL BOARD (owner, 2026-11-26: the OzBargain study's move 1, phase two; phase one put the Sniper's drops on /restocks with
// hot / cold / expired buttons). /drops is the board itself and /drops/<id> one drop's own page. This file is the pure part,
// shared by the server (which builds the rows) and the browser (which sorts them and counts the votes); tests/drop-board.test.ts.
//
//   • A drop is only ever one the Sealed Sniper posted after asking the store (lib/sniper.ts). Nobody else can add one yet.
//   • Each row carries what our OWN latest import says about it: still that price, a different price, or gone. A vote never
//     decides that; visitors' "gone" flags only add a label beside it.
//   • "Hot" orders the board's own rows and nothing else: no price, store row, badge, feed or alert reads a vote.
import type { Market } from "./site-types";

export type Tally = { hot: number; cold: number; expired: number };
export type Mine = { vote: number; expired: boolean };
export type VoteAction = "hot" | "cold" | "expired";
export const NO_TALLY: Tally = { hot: 0, cold: 0, expired: 0 };
export const NO_VOTE: Mine = { vote: 0, expired: false };

/** This many "gone" flags from visitors and the card says so (our own stock read always shows, whatever the flags). */
export const GONE_FLAGS = 3;
/** The board's size: one tally request covers them all (riftcompare's MAX_IDS). */
export const BOARD_MAX = 60;

/** "N% under market" is said from this much: a point or two under is noise, not a deal. */
export const UNDER_MIN = 5;

export type DropState = "live" | "moved" | "gone";

export interface BoardRow {
  id: string;
  /** when the Sniper posted it (ISO) */
  at: string;
  kind: "restock" | "drop" | "preorder";
  slug: string;
  name: string;
  img: string | null;
  game: { id: string; short: string; color: string } | null;
  store: string;
  market: Market;
  /** the posted price, in the store's own currency, already formatted */
  price: string;
  was?: string;
  pct?: number;
  /** percent under TCGplayer's market price: US stores only, because that price is in US dollars and nothing is converted */
  under?: number;
  state: DropState;
  /** state "moved": the store's price at our latest check */
  now?: string;
  /** the click out to the store (/go), while it has stock */
  go?: string;
}

/** What our latest import says about a posted drop. `cents` is the store's cheapest in-stock price for the product now. */
export function dropState(posted: number, cents: number | null, tolerance = 0.02): DropState {
  if (cents == null) return "gone";
  return Math.abs(cents - posted) <= posted * tolerance ? "live" : "moved";
}

/** Percent under TCGplayer's market, for a US price only; null when it is not under, or the market is unknown. */
export function underMarket(cents: number, market: Market, marketUsdCents: number | null): number | null {
  if (market !== "US" || !marketUsdCents || marketUsdCents <= 0) return null;
  const pct = Math.round((1 - cents / marketUsdCents) * 100);
  return pct >= UNDER_MIN ? pct : null;
}

export const score = (t: Tally): number => t.hot - t.cold;

/** The tally after this visitor's tap, before the server answers (the server's own rule: lib/deal-votes.ts `apply`). */
export function applyVote(t: Tally, mine: Mine, action: VoteAction): { tally: Tally; mine: Mine } {
  const next: Mine =
    action === "hot" ? { ...mine, vote: mine.vote === 1 ? 0 : 1 }
    : action === "cold" ? { ...mine, vote: mine.vote === -1 ? 0 : -1 }
    : { ...mine, expired: !mine.expired };
  const d = (was: boolean, is: boolean) => (is ? 1 : 0) - (was ? 1 : 0);
  return {
    mine: next,
    tally: {
      hot: Math.max(0, t.hot + d(mine.vote === 1, next.vote === 1)),
      cold: Math.max(0, t.cold + d(mine.vote === -1, next.vote === -1)),
      expired: Math.max(0, t.expired + d(mine.expired, next.expired)),
    },
  };
}

/**
 * How hot a drop is now: its score over its age, so a new drop with a few votes beats an old one with many (the gravity every
 * vote-ranked board uses). A drop with no stock, or one voted below zero, sinks under every live one.
 */
export function heat(t: Tally, at: string, now: number, state: DropState = "live"): number {
  const hours = Math.max(0, (now - Date.parse(at)) / 3_600_000);
  const s = score(t);
  const base = (s >= 0 ? s + 1 : s) / Math.pow(hours + 2, 1.5);
  return state === "gone" || t.expired >= GONE_FLAGS ? base - 1000 : base;
}

/** The board in "Hot" order; ties keep the newest first. */
export function sortHot<T extends Pick<BoardRow, "id" | "at" | "state">>(rows: readonly T[], tallies: Record<string, Tally>, now: number): T[] {
  return [...rows]
    .map((r) => ({ r, h: heat(tallies[r.id] ?? NO_TALLY, r.at, now, r.state) }))
    .sort((a, b) => b.h - a.h || Date.parse(b.r.at) - Date.parse(a.r.at))
    .map((x) => x.r);
}

export const KIND_LABEL: Record<BoardRow["kind"], string> = { drop: "Price drop", restock: "Back in stock", preorder: "First pre-order" };
