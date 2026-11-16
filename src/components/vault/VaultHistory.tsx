"use client";

// The collection's value history (lib/vault-history.ts): backfilled from the site's own price history, so it has a real
// past on the first visit. TCGplayer market price in US$, labelled as such; a different number from the headline total.
import { useEffect, useMemo, useState } from "react";
import { collectionSeries, idsToFetch, type HistoryHolding } from "@/lib/vault-history";
import { formatMoney, pctChange, type ValuedItem } from "@/lib/vault";
import { dayToDate, type Series } from "@/lib/series";

const W = 640, H = 180, P = 28;
const RANGES = [
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
];

export function VaultHistory({ items }: { items: ValuedItem[] }) {
  const [series, setSeries] = useState<Record<string, Series | undefined>>({});
  const [range, setRange] = useState(60);
  const [done, setDone] = useState(false);

  // One holding per product, however many markets it was added in; weight is any positive value to rank by.
  const holdings: HistoryHolding[] = useMemo(() => {
    const by = new Map<string, HistoryHolding>();
    for (const i of items) {
      const h = by.get(i.id) ?? { id: i.id, qty: 0, weight: i.nowCents ?? i.addedCents ?? 0 };
      h.qty += i.qty;
      by.set(i.id, h);
    }
    return [...by.values()];
  }, [items]);
  const key = idsToFetch(holdings).join(",");

  useEffect(() => {
    let live = true;
    setDone(false);
    const ids = key ? key.split(",") : [];
    Promise.all(
      ids.map((id) =>
        fetch(`/api/history/${encodeURIComponent(id)}`, { credentials: "omit" })
          .then((r) => (r.ok ? r.json() : null))
          .then((j: { series?: Series } | null) => [id, j?.series] as const)
          .catch(() => [id, undefined] as const),
      ),
    ).then((rows) => {
      if (!live) return;
      setSeries(Object.fromEntries(rows));
      setDone(true);
    });
    return () => {
      live = false;
    };
  }, [key]);

  const today = Math.floor(Date.now() / 86_400_000);
  const r = useMemo(() => collectionSeries(holdings, series, today, range), [holdings, series, today, range]);

  if (!done) return null;
  const pts = r.points;
  if (pts.length < 2)
    return (
      <section className="ce-vault-hist" aria-label="Collection value history">
        <div className="ce-vault-label">Value history · TCGplayer market price, US$</div>
        <p className="ce-vault-muted">History for your items starts building with the daily price import; the chart appears once there are two days of prices to compare.</p>
      </section>
    );
  const last: [number, number] = [today, pts[pts.length - 1][1]];
  const all = [...pts, last];
  const minX = all[0][0], maxX = today;
  const ys = all.map((p) => p[1]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = (hi - lo || hi || 1) * 0.1;
  const x = (d: number) => P + ((d - minX) / Math.max(1, maxX - minX)) * (W - 2 * P);
  const y = (c: number) => H - P - ((c - (lo - pad)) / (hi + pad - (lo - pad))) * (H - 2 * P);
  let d = `M${x(all[0][0])},${y(all[0][1])}`;
  for (let i = 1; i < all.length; i++) d += ` H${x(all[i][0])} V${y(all[i][1])}`;
  const pct = pctChange(all[0][1], last[1]);
  const up = last[1] >= all[0][1];
  return (
    <section className="ce-vault-hist" aria-label="Collection value history">
      <div className="ce-vault-histhead">
        <div className="ce-vault-label">Value history · TCGplayer market price, US$</div>
        <span role="group" aria-label="Range" className="ce-vault-ranges">
          {RANGES.map((o) => (
            <button key={o.days} type="button" aria-pressed={range === o.days} onClick={() => setRange(o.days)}>
              {o.label}
            </button>
          ))}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="ce-vault-chart" role="img" aria-label={`Collection value from ${formatMoney(all[0][1], "USD")} to ${formatMoney(last[1], "USD")}`}>
        <line x1={P} x2={W - P} y1={y(hi)} y2={y(hi)} stroke="currentColor" strokeOpacity="0.1" />
        <line x1={P} x2={W - P} y1={y(lo)} y2={y(lo)} stroke="currentColor" strokeOpacity="0.1" />
        <path d={d} fill="none" stroke={up ? "#16a34a" : "#dc2626"} strokeWidth="2.5" />
        <text x={P} y={14} fontSize="11" fill="currentColor" opacity="0.65">{formatMoney(hi, "USD")}</text>
        <text x={P} y={H - 6} fontSize="11" fill="currentColor" opacity="0.65">{dayToDate(minX)}</text>
        <text x={W - P} y={H - 6} fontSize="11" fill="currentColor" opacity="0.65" textAnchor="end">{dayToDate(maxX)}</text>
      </svg>
      <p className="ce-vault-muted">
        What the {r.used === 1 ? "1 product" : `${r.used} products`} in your collection today would have been worth on each day{pct != null ? ` (${pct > 0 ? "+" : ""}${pct}% over the chart)` : ""}.
        {r.left ? ` ${r.left} left out (no price history yet${holdings.length > 60 ? ", or beyond the 60 most valuable" : ""}).` : ""} This is TCGplayer&apos;s market price in US dollars, so it differs from the store-price total above.
      </p>
    </section>
  );
}
