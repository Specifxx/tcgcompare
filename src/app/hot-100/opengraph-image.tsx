// The Hot 100's share image: the week's five biggest rises beside its five biggest drops (2026-11-20), text only like the other share
// images (the Vercel cost cap, 2026-11-08), kept a day. This is what a Reddit link post shows, so it states the
// week and the method. Before a week of history it says so instead of inventing a chart.
import { ImageResponse } from "next/og";
import { SITE } from "@/site.config";
import { hotInputs } from "@/lib/data";
import { money, pct } from "@/lib/format";
import { shortName } from "@/lib/names";
import { dayLabel, hotChart, hotDrops, hotName, latestDay } from "@/lib/hot100";

export const revalidate = 86400;
export const alt = `${SITE.gameShort} Hot 100: this week's biggest price rises and drops on ${SITE.name}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

type Mover = { item: { id: string | number; name: string }; cents: number; change: number };

// Since 2026-11-20 (owner, from a Reddit reply asking for "the biggest drops"): half the week's biggest rises, half its
// biggest drops, five each, from the same hotChart and hotDrops the page lists. Still text only.
function Column({ title, rows, up }: { title: string; rows: Mover[]; up: boolean }) {
  const color = up ? "#4ade80" : "#f87171";
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 520 }}>
      <span style={{ fontSize: 30, fontWeight: 800, color }}>{title}</span>
      {rows.length ? (
        rows.map((r) => (
          <div key={r.item.id} style={{ display: "flex", alignItems: "baseline", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <span style={{ display: "flex", flexDirection: "column", width: 380 }}>
              <span style={{ fontSize: 25, color: "#f8fafc" }}>{clip(shortName(r.item.name), 28)}</span>
              <span style={{ fontSize: 19, color: "#a9b4cc" }}>{`now ${money(r.cents)}`}</span>
            </span>
            <span style={{ width: 140, textAlign: "right", fontSize: 30, fontWeight: 800, color }}>{pct(r.change).replace("-", "−")}</span>
          </div>
        ))
      ) : (
        <span style={{ fontSize: 22, color: "#cfd6e6", marginTop: 12 }}>{up ? "No product rose this week." : "No product fell this week."}</span>
      )}
    </div>
  );
}

export default function Image() {
  const t = SITE.theme;
  const inputs = hotInputs();
  const day = latestDay(inputs);
  const c = day == null ? null : hotChart(inputs, day);
  const ups: Mover[] = c?.rows.slice(0, 5) ?? [];
  const downs: Mover[] = day == null ? [] : hotDrops(inputs, day, { max: 5 });
  const n = c?.rows.length ?? 0;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: t.pageDark, color: "#fff", padding: "36px 60px 32px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 48, fontWeight: 800 }}>{`${SITE.gameShort} ${n ? hotName(n) : "Hot 100"}: rises & drops`}</span>
          <span style={{ fontSize: 26, color: t.brandLight, fontWeight: 700 }}>{SITE.name}</span>
        </div>
        {c && <div style={{ display: "flex", fontSize: 24, color: "#cfd6e6", marginTop: 4 }}>{`Sealed products, week to ${dayLabel(c.day)}`}</div>}
        {ups.length || downs.length ? (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <Column title="Biggest rises" rows={ups} up />
            <Column title="Biggest drops" rows={downs} up={false} />
          </div>
        ) : (
          <div style={{ fontSize: 34, color: "#cfd6e6", marginTop: 40 }}>{`The ${SITE.gameShort} products whose price rose and fell most this week, from daily TCGplayer market prices.`}</div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", fontSize: 21, color: "#a9b4cc" }}>
          <span>7-day change in TCGplayer market price · products worth $3 or more</span>
          <span style={{ color: "#f8fafc" }}>{`${SITE.domain}/hot-100`}</span>
        </div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
