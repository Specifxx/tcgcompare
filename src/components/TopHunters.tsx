"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { PREMIUM_SERVICE } from "@/lib/premium-member";

// This month's Top deal hunters (community plan move 3, owner 2026-11-26): the named members whose votes and "Gone?"
// flags helped most here, from the shared account's public list (handles and points only; CDN-cached six hours).
// Below the board, never above a deal; renders nothing until someone with a name has helped this month.

type Hunter = { handle: string; points: number };

export function TopHunters({ site }: { site: string }) {
  const [top, setTop] = useState<Hunter[] | null>(null);
  useEffect(() => {
    fetch(`${PREMIUM_SERVICE}/api/community/top?site=${encodeURIComponent(site)}`, { credentials: "omit" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { top?: Hunter[] } | null) => setTop(Array.isArray(j?.top) ? j!.top!.slice(0, 10) : []))
      .catch(() => setTop([]));
  }, [site]);
  if (!top || top.length === 0) return null;
  const month = new Date().toLocaleString("en-US", { month: "long", timeZone: "Australia/Sydney" });
  return (
    <section aria-labelledby="th-h" className="card p-4 sm:p-5">
      <h2 id="th-h" className="text-base font-bold">Top deal hunters · {month}</h2>
      <p className="mt-1 text-sm text-muted">Named collectors whose votes and flags kept this board honest. <Link className="link" href="/account">Pick your name</Link> to join them.</p>
      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {top.map((h, i) => (
          <li key={h.handle} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-right font-display font-black tabular-nums text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">@{h.handle}</span>
            <span className="text-xs text-muted tabular-nums">{h.points} {h.points === 1 ? "pt" : "pts"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
