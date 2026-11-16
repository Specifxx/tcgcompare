"use client";
import { useEffect, useMemo, useState } from "react";
import { VERDICT_LABEL } from "@/lib/deal-agent";
import type { SignalFile } from "@/lib/deal-signals";
import { money } from "@/lib/format";
import { CURRENCY, type Market } from "@/lib/site-types";
import { useMarket } from "@/components/ClientPrefs";

// The wishlist is `ce_wants_v1` in localStorage: product ids only. Everything else comes from the static signal file.
const KEY = "ce_wants_v1";
const MAX = 50;
const read = (): string[] => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX) : []; } catch { return []; } };
const write = (ids: string[]) => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private window: the list lasts this visit */ } };

export function DealAgent() {
  const { market } = useMarket();
  const [sig, setSig] = useState<SignalFile | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => { setIds(read()); fetch("/deal-signals.json").then((r) => (r.ok ? r.json() : Promise.reject())).then(setSig, () => setFailed(true)); }, []);
  const found = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!sig || t.length < 3) return [];
    return Object.entries(sig.items).filter(([id, it]) => !ids.includes(id) && it.m[market as Market] && it.n.toLowerCase().includes(t)).slice(0, 8);
  }, [sig, q, ids, market]);
  const set = (next: string[]) => { setIds(next); write(next); };
  const cur = CURRENCY[market as Market];
  if (failed) return <p className="mt-6 text-sm">The deal agent is not switched on.</p>;
  return (
    <div className="mt-5">
      <input className="w-full rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm" placeholder="Search a booster box, tin or deck to add" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products to add" />
      {found.length > 0 && (
        <ul className="mt-2 divide-y divide-ink-700 rounded-md border border-ink-700">
          {found.map(([id, it]) => (
            <li key={id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>{it.n}</span>
              <button className="rounded-md border border-ink-700 px-2 py-1" onClick={() => { set([...ids, id].slice(0, MAX)); setQ(""); }}>Add</button>
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-6 space-y-3">
        {ids.map((id) => {
          const it = sig?.items[id];
          const m = it?.m[market as Market];
          return (
            <li key={id} className="rounded-md border border-ink-700 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <a className="font-semibold" href={it?.u ?? "#"}>{it?.n ?? "Loading…"}</a>
                <button className="opacity-60" onClick={() => set(ids.filter((x) => x !== id))} aria-label="Remove from list">Remove</button>
              </div>
              {m ? (
                <>
                  <p className="mt-1"><span className="font-semibold">{VERDICT_LABEL[m.verdict]}</span> · {money(m.c, cur)} · {m.confidence} confidence</p>
                  <ul className="mt-1 list-disc pl-5 opacity-80">{m.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                </>
              ) : it ? <p className="mt-1 opacity-75">No store has this in stock in {market} right now.</p> : null}
            </li>
          );
        })}
      </ul>
      {!ids.length && <p className="mt-6 text-sm opacity-75">Your list is empty.</p>}
    </div>
  );
}
