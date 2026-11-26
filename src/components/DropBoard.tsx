"use client";

// THE DEAL BOARD'S CARDS (owner, 2026-11-26; lib/drop-board.ts has the rules). The server sends the rows, newest first, and the
// page is complete without this script: every card, price, store and link is in the HTML. The browser then adds the votes:
// ONE tally request for the whole board (riftcompare.com/api/deal-votes, held six hours by the CDN), a POST per tap that
// answers with that drop's fresh count, and this browser's own taps remembered in localStorage (the key phase one's
// DropVotes.tsx uses, so a vote cast on /restocks shows here). A tap shows at once and is undone if the service refuses it.
// "Hot" re-orders these rows only. No prompt, no sign-in, nothing typed.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/Link";
import { LiveAgo } from "@/components/LiveAgo";
import { DropViewBeacon, DEAL_VOTES_API } from "@/components/DropVotes";
import { ago } from "@/lib/format";
import { track } from "@/lib/vault";
import { readStored } from "@/lib/premium-member";
import { GONE_FLAGS, KIND_LABEL, NO_TALLY, NO_VOTE, applyVote, score, sortHot, type BoardRow, type Mine, type Tally, type VoteAction } from "@/lib/drop-board";

const MINE_KEY = "dv_mine";
function readMine(): Record<string, Mine> {
  try {
    return JSON.parse(window.localStorage.getItem(MINE_KEY) ?? "{}") as Record<string, Mine>;
  } catch {
    return {};
  }
}
function writeMine(all: Record<string, Mine>) {
  try {
    window.localStorage.setItem(MINE_KEY, JSON.stringify(all));
  } catch {
    /* private mode: the vote still counts */
  }
}

function useVotes(ids: readonly string[]) {
  const [tallies, setTallies] = useState<Record<string, Tally>>({});
  const [mine, setMine] = useState<Record<string, Mine>>({});
  const [failed, setFailed] = useState<string | null>(null);
  // Community plan move 3 (RiftCompare lib/contributions.ts): the first named member to vouch for each drop, and the
  // points a signed-in vote just earned. Anonymous votes count exactly as before; a name is only ever shown, never asked.
  const [by, setBy] = useState<Record<string, string>>({});
  const [earned, setEarned] = useState<{ id: string; n: number; named: boolean } | null>(null);
  const busy = useRef(new Set<string>());
  const state = useRef({ tallies, mine });
  state.current = { tallies, mine };
  const key = ids.join(",");

  useEffect(() => {
    let live = true;
    setMine(readMine());
    if (!key) return;
    fetch(`${DEAL_VOTES_API}?site=tcgprices&ids=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { tallies?: Record<string, Tally>; by?: Record<string, string> } | null) => {
        // Our own taps since the request left stay on top of what it brings back.
        if (live && j?.tallies && typeof j.tallies === "object") setTallies((cur) => ({ ...j.tallies, ...cur }));
        if (live && j?.by && typeof j.by === "object") setBy(j.by);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key]);

  const vote = useCallback(async (id: string, action: VoteAction) => {
    if (busy.current.has(id)) return;
    busy.current.add(id);
    const before = { tally: state.current.tallies[id] ?? NO_TALLY, mine: state.current.mine[id] ?? NO_VOTE };
    const put = (t: Tally, m: Mine) => {
      setTallies((cur) => ({ ...cur, [id]: t }));
      setMine((cur) => ({ ...cur, [id]: m }));
    };
    const next = applyVote(before.tally, before.mine, action);
    put(next.tally, next.mine);
    setFailed(null);
    setEarned(null);
    track("drop_vote", { drop: id, action });
    const token = readStored()?.t;
    try {
      const r = await fetch(DEAL_VOTES_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(token ? { drop: id, action, token } : { drop: id, action }) });
      const j = (await r.json().catch(() => null)) as { mine?: Mine; tally?: Tally; earned?: number; handle?: string | null } | null;
      if (!r.ok || !j?.mine || !j.tally) throw new Error("refused");
      put(j.tally, j.mine);
      if (token && typeof j.earned === "number" && j.earned > 0) setEarned({ id, n: j.earned, named: !!j.handle });
      const all = readMine();
      if (j.mine.vote === 0 && !j.mine.expired) delete all[id];
      else all[id] = j.mine;
      writeMine(all);
    } catch {
      put(before.tally, before.mine);
      setFailed(id);
    } finally {
      busy.current.delete(id);
    }
  }, []);

  return { tallies, mine, vote, failed, by, earned };
}

const Chevron = ({ down = false }: { down?: boolean }) => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={down ? "rotate-180" : undefined}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);

/** The score with its two arrows: the board's one loud control, the same on every card. */
function VoteRail({ tally, mine, onVote, name }: { tally: Tally; mine: Mine; onVote: (a: VoteAction) => void; name: string }) {
  const s = score(tally);
  const arrow = "flex h-9 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink motion-reduce:transition-none";
  return (
    <div className="flex w-10 shrink-0 flex-col items-center">
      <button type="button" aria-pressed={mine.vote === 1} aria-label={`Good deal: vote ${name} hot`} title="A good deal" onClick={() => onVote("hot")} className={`${arrow} ${mine.vote === 1 ? "!bg-orange-500/15 !text-orange-500" : ""}`}>
        <Chevron />
      </button>
      <span aria-label={`Score ${s}: ${tally.hot} hot, ${tally.cold} cold`} title={`${tally.hot} hot · ${tally.cold} cold`} className={`min-w-[2ch] text-center font-display text-lg font-black leading-6 tabular-nums ${s > 0 ? "text-orange-500" : s < 0 ? "text-sky-500" : "text-ink"}`}>
        {s > 0 ? `+${s}` : s}
      </span>
      <button type="button" aria-pressed={mine.vote === -1} aria-label={`Not a good deal: vote ${name} cold`} title="Not a good deal" onClick={() => onVote("cold")} className={`${arrow} ${mine.vote === -1 ? "!bg-sky-500/15 !text-sky-500" : ""}`}>
        <Chevron down />
      </button>
    </div>
  );
}

function StateLine({ r, flags }: { r: BoardRow; flags: number }) {
  const dot = "mr-1.5 inline-block h-2 w-2 rounded-full align-middle";
  return (
    <p className="text-sm text-muted">
      <span className="font-medium text-ink">{r.store}</span>
      {r.market !== "US" && <span> · {r.market}</span>}
      <span aria-hidden="true"> · </span>
      {r.state === "live" && <span className="text-open"><span className={`${dot} bg-open`} />In stock at this price at our last check</span>}
      {r.state === "moved" && <span className="text-stale"><span className={`${dot} bg-stale`} />Now {r.now} at the store</span>}
      {r.state === "gone" && <span><span className={`${dot} bg-sold`} />Sold out at our last check</span>}
      {r.state !== "gone" && flags >= GONE_FLAGS && <span className="text-stale"> · {flags} visitors say it has gone</span>}
    </p>
  );
}

function DropCard({ r, tally, mine, onVote, failed, by, earned, big = false }: { r: BoardRow; tally: Tally; mine: Mine; onVote: (a: VoteAction) => void; failed: boolean; by?: string; earned?: { n: number; named: boolean } | null; big?: boolean }) {
  const over = r.state === "gone" || tally.expired >= GONE_FLAGS;
  const Name = big ? "h1" : "h3";
  return (
    <li data-drop-card={r.id} className="card flex gap-3 p-3 sm:gap-4 sm:p-4">
      <VoteRail tally={tally} mine={mine} onVote={onVote} name={r.name} />
      <Link href={`/card/${r.slug}`} tabIndex={-1} className={`plate shrink-0 self-start ${big ? "h-24 w-24 sm:h-36 sm:w-36" : "h-16 w-16 sm:h-24 sm:w-24"} ${over ? "opacity-60" : ""}`}>
        {r.img && <img src={r.img} alt={r.name} loading={big ? "eager" : "lazy"} decoding="async" width={200} height={200} className="h-full w-full object-contain p-1.5 mix-blend-multiply" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="font-semibold uppercase tracking-wide text-brand-strong">{KIND_LABEL[r.kind]}</span>
          {r.game && <span className="game-chip text-[11px] leading-[18px]" style={{ ["--game" as string]: r.game.color }}>{r.game.short}</span>}
          {big ? <LiveAgo iso={r.at} initial={ago(r.at)} /> : <Link href={`/drops/${r.id}`} className="hover:text-ink hover:underline"><LiveAgo iso={r.at} initial={ago(r.at)} /></Link>}
        </p>
        <Name className={`${big ? "font-display text-2xl font-black sm:text-3xl" : "text-base font-semibold sm:text-lg"} leading-snug [text-wrap:balance]`}>
          <Link href={`/card/${r.slug}`} className="hover:underline">{r.name}</Link>
        </Name>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`font-display font-black tabular-nums ${big ? "text-3xl" : "text-xl"} ${over ? "text-muted line-through decoration-1" : "text-ink"}`}>{r.price}</span>
          {r.was && <s className="text-sm text-muted tabular-nums">{r.was}</s>}
          {r.pct != null && !over && <span className="rounded-full bg-open-soft px-2 py-0.5 text-xs font-bold text-open">{r.pct}% lower</span>}
          {r.under != null && !over && <span className="tag" title="Under TCGplayer's market price: what this product sold for recently on TCGplayer, in US dollars">{r.under}% under market</span>}
        </p>
        <StateLine r={r} flags={tally.expired} />
        {by && <p className="text-xs text-muted">First vouched by <span className="font-semibold text-ink">@{by}</span></p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          {r.go && <a href={r.go} target="_blank" rel="sponsored nofollow noopener" className={`${r.state === "live" ? "btn-primary" : "btn-soft"} min-h-10 px-4`}>Go to {r.store}</a>}
          <Link href={`/card/${r.slug}`} className="inline-flex min-h-10 items-center text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">Compare every store</Link>
          <button type="button" aria-pressed={mine.expired} onClick={() => onVote("expired")} title="Sold out, or the price went back up? Tell the next person" className={`inline-flex min-h-10 items-center text-sm underline underline-offset-4 hover:text-ink ${mine.expired ? "font-semibold text-ink" : "text-muted"}`}>
            {mine.expired ? "You said it has gone" : "Gone?"}
            {tally.expired > 0 && <span className="ml-1 tabular-nums no-underline">({tally.expired})</span>}
          </button>
          <span role="status" aria-live="polite" className={`text-xs ${failed ? "text-down" : "text-open"}`}>
            {failed ? "Couldn’t save that vote. Try again in a minute." : earned ? <>+{earned.n} community {earned.n === 1 ? "point" : "points"}{earned.named ? "" : <> · <Link href="/account" className="underline underline-offset-2">pick a name</Link> to show on deals</>}</> : ""}
          </span>
        </div>
      </div>
      <DropViewBeacon id={r.id} />
    </li>
  );
}

type Sort = "new" | "hot";

export function DropBoard({ rows, single = false, bare = false }: { rows: BoardRow[]; single?: boolean; /** the cards alone, no order or game controls */ bare?: boolean }) {
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const { tallies, mine, vote, failed, by, earned } = useVotes(ids);
  const [sort, setSort] = useState<Sort>("new");
  const [game, setGame] = useState<string | null>(null);
  // "Hot" is worked out when it is picked, so a vote does not make the card under the visitor's thumb jump away.
  const [hotOrder, setHotOrder] = useState<string[] | null>(null);
  const games = useMemo(() => {
    const seen = new Map<string, { id: string; short: string; n: number }>();
    for (const r of rows) if (r.game) seen.set(r.game.id, { id: r.game.id, short: r.game.short, n: (seen.get(r.game.id)?.n ?? 0) + 1 });
    return [...seen.values()].sort((a, b) => b.n - a.n);
  }, [rows]);

  const pick = (s: Sort) => {
    setSort(s);
    setHotOrder(s === "hot" ? sortHot(rows, tallies, Date.now()).map((r) => r.id) : null);
    track("drop_sort", { sort: s });
  };
  const ordered = sort === "hot" && hotOrder ? hotOrder.map((id) => rows.find((r) => r.id === id)).filter((r): r is BoardRow => !!r) : rows;
  const shown = game ? ordered.filter((r) => r.game?.id === game) : ordered;

  const cards = (
    <ol className="flex flex-col gap-3">
      {shown.map((r) => (
        <DropCard key={r.id} r={r} tally={tallies[r.id] ?? NO_TALLY} mine={mine[r.id] ?? NO_VOTE} onVote={(a) => vote(r.id, a)} failed={failed === r.id} by={by[r.id]} earned={earned?.id === r.id ? earned : null} big={single} />
      ))}
    </ol>
  );
  if (single || bare) return cards;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Order" className="flex gap-2">
          <button type="button" aria-pressed={sort === "new"} onClick={() => pick("new")} className={`chip ${sort === "new" ? "chip-on" : ""}`}>Newest</button>
          <button type="button" aria-pressed={sort === "hot"} onClick={() => pick("hot")} className={`chip ${sort === "hot" ? "chip-on" : ""}`}>Hot</button>
        </div>
        {games.length > 1 && (
          <div role="group" aria-label="Game" className="flex flex-wrap gap-2 sm:border-l sm:border-line sm:pl-2">
            <button type="button" aria-pressed={game === null} onClick={() => setGame(null)} className={`chip ${game === null ? "chip-on" : ""}`}>All games</button>
            {games.map((g) => (
              <button key={g.id} type="button" aria-pressed={game === g.id} onClick={() => setGame(g.id)} className={`chip ${game === g.id ? "chip-on" : ""}`}>
                {g.short}
              </button>
            ))}
          </div>
        )}
      </div>
      {cards}
    </div>
  );
}
