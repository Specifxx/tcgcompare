"use client";

// Today's TCGplayer market price for every single card in the collection (lib/card-collection.ts), read in this browser from
// TCG Singles DB's open card API: one CDN-cached request per set the cards come from, kept for the visit in sessionStorage so
// moving between pages doesn't ask again.
import { useEffect, useState } from "react";
import { cardPriceMap, isCardId, setsToFetch, SINGLES_API, type OpenSetFile } from "@/lib/card-collection";

const memo = new Map<string, Promise<OpenSetFile | null>>();
const SESSION = "ce_card_sets_v1";

function cached(key: string): OpenSetFile | null {
  try {
    const all = JSON.parse(sessionStorage.getItem(SESSION) ?? "{}") as Record<string, OpenSetFile>;
    return all[key] ?? null;
  } catch {
    return null;
  }
}
function keep(key: string, f: OpenSetFile) {
  try {
    const all = JSON.parse(sessionStorage.getItem(SESSION) ?? "{}") as Record<string, OpenSetFile>;
    all[key] = f;
    sessionStorage.setItem(SESSION, JSON.stringify(all));
  } catch {
    /* full or blocked: it is only a cache */
  }
}

/** One set's cards and prices, or null when Singles DB doesn't answer. */
export function fetchSet(key: string): Promise<OpenSetFile | null> {
  const hit = typeof window !== "undefined" ? cached(key) : null;
  if (hit) return Promise.resolve(hit);
  if (!memo.has(key)) {
    memo.set(
      key,
      fetch(`${SINGLES_API}/set/${key}`, { credentials: "omit" })
        .then((r) => (r.ok ? (r.json() as Promise<OpenSetFile>) : null))
        .then((f) => {
          if (f?.cards) keep(key, f);
          return f?.cards ? f : null;
        })
        .catch(() => {
          memo.delete(key);
          return null;
        }),
    );
  }
  return memo.get(key)!;
}

export function useCardPrices(ids: readonly string[]): { prices: Record<string, number>; sets: Record<string, OpenSetFile | null>; ready: boolean; failed: boolean } {
  const cardIds = ids.filter(isCardId);
  const key = setsToFetch(cardIds).join(",");
  const [sets, setSets] = useState<Record<string, OpenSetFile | null>>({});
  const [ready, setReady] = useState(!key);
  useEffect(() => {
    let live = true;
    const want = key ? key.split(",") : [];
    if (!want.length) {
      setReady(true);
      return;
    }
    Promise.all(want.map((k) => fetchSet(k).then((f) => [k, f] as const))).then((rows) => {
      if (!live) return;
      setSets(Object.fromEntries(rows));
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [key]);
  const failed = ready && !!key && Object.values(sets).every((f) => !f);
  return { prices: cardPriceMap(cardIds, sets), sets, ready, failed };
}
