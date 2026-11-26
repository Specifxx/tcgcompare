"use client";

// HOT, COLD AND EXPIRED ON A SEALED SNIPER DROP (deal board, phase one; COO, 2026-11-26). Inline on the drop card,
// no prompt and no sign-in. RiftCompare keeps the votes (riftcompare.com/api/deal-votes, DealVote): one per drop per
// visitor, where a visitor is a keyed hash it makes of the address, never the address. The tally for every drop on the
// page is ONE request after render (the CDN holds it six hours); a vote's own answer brings that drop's fresh count,
// and this browser remembers its own taps in localStorage. Votes order nothing and never change a price or a drop.

import { useEffect, useState } from "react";
import { track } from "@/lib/vault";

export const DEAL_VOTES_API = "https://riftcompare.com/api/deal-votes";
type Tally = { hot: number; cold: number; expired: number };
type Mine = { vote: number; expired: boolean };
const MINE_KEY = "dv_mine";
const ZERO: Tally = { hot: 0, cold: 0, expired: 0 };

let ids: string[] = [];
let loading: Promise<Record<string, Tally>> | null = null;
function loadTallies(): Promise<Record<string, Tally>> {
  if (loading) return loading;
  // every card registers in its first render; wait a tick so one request covers them all
  loading = new Promise((r) => setTimeout(r, 0))
    .then(() => fetch(`${DEAL_VOTES_API}?site=tcgprices&ids=${encodeURIComponent([...new Set(ids)].slice(0, 60).join(","))}`))
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { tallies?: Record<string, Tally> } | null) => (j?.tallies && typeof j.tallies === "object" ? j.tallies : {}))
    .catch(() => ({}));
  return loading;
}

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

export function DropVotes({ id }: { id: string }) {
  if (!ids.includes(id)) ids.push(id);
  const [tally, setTally] = useState<Tally>(ZERO);
  const [mine, setMine] = useState<Mine>({ vote: 0, expired: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setMine(readMine()[id] ?? { vote: 0, expired: false });
    loadTallies().then((t) => live && setTally(t[id] ?? ZERO));
    return () => {
      live = false;
    };
  }, [id]);

  async function act(action: "hot" | "cold" | "expired") {
    if (busy) return;
    setBusy(true);
    track("drop_vote", { drop: id, action });
    try {
      const r = await fetch(DEAL_VOTES_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ drop: id, action }) });
      const j = (await r.json().catch(() => null)) as { mine?: Mine; tally?: Tally } | null;
      if (r.ok && j?.mine && j.tally) {
        setMine(j.mine);
        setTally(j.tally);
        const all = readMine();
        if (j.mine.vote === 0 && !j.mine.expired) delete all[id];
        else all[id] = j.mine;
        writeMine(all);
      }
    } catch {
      /* offline: nothing changes */
    } finally {
      setBusy(false);
    }
  }

  const base = "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs tabular-nums transition-colors disabled:opacity-60";
  const off = "border-ink-700 text-muted hover:text-fg";
  return (
    <div className="flex shrink-0 items-center gap-1.5" data-drop-votes={id}>
      <button type="button" disabled={busy} aria-pressed={mine.vote === 1} title="A good deal: vote it hot" onClick={() => act("hot")}
        className={`${base} ${mine.vote === 1 ? "border-orange-500 bg-orange-500/15 text-orange-400" : off}`}>
        <span aria-hidden="true">▲</span> Hot{tally.hot > 0 && <span>{tally.hot}</span>}
      </button>
      <button type="button" disabled={busy} aria-pressed={mine.vote === -1} title="Not a good deal: vote it cold" onClick={() => act("cold")}
        className={`${base} ${mine.vote === -1 ? "border-sky-500 bg-sky-500/15 text-sky-400" : off}`}>
        <span aria-hidden="true">▼</span> Cold{tally.cold > 0 && <span>{tally.cold}</span>}
      </button>
      <button type="button" disabled={busy} aria-pressed={mine.expired} title="Sold out or the price went back up? Flag it expired" onClick={() => act("expired")}
        className={`${base} ${mine.expired ? "border-ink-500 bg-ink-800 text-fg" : off}`}>
        Expired{tally.expired > 0 && <span>{tally.expired}</span>}
      </button>
    </div>
  );
}

/** One "drop_view" per drop card that scrolls into view (votes per 100 drop views), and "drop_click" on its links. */
export function DropViewBeacon({ id }: { id: string }) {
  useEffect(() => {
    const el = document.querySelector(`[data-drop-card="${id}"]`);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        track("drop_view", { drop: id });
        io.disconnect();
      }
    }, { threshold: 0.6 });
    io.observe(el);
    const click = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("a")) track("drop_click", { drop: id });
    };
    el.addEventListener("click", click);
    return () => {
      io.disconnect();
      el.removeEventListener("click", click);
    };
  }, [id]);
  return null;
}
