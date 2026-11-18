// The card page's share image (owner, 2026-11-02, word of mouth): the card's
// name and the real price gap in the US (the page's baseline market) — cheapest
// in-stock price, the dearest, and how much less — from lib/share.ts. With no
// spread it shows the TCGplayer market price. Drawn on first request, kept a
// day like the page (empty generateStaticParams: nothing drawn at build).
// Text only, no card art (2026-11-08, the Vercel cost cap): with the art each
// PNG was ~580 KB, and every one Vercel caches is billed as ISR writes by the
// 8 KB unit, so these images were most of the sites' ISR bill. Flat colour
// and text compress to a few dozen KB. Don't put a photo back in.
// 2026-11-18 (owner: "enough detail for someone to process", "insights"): a
// right-hand panel adds the last 30 days of TCGplayer's market price as a thin
// line, the week's or month's move in words and how many stores have it in
// stock. A line is a few hundred bytes of vector, not a photo.
import { ImageResponse } from "next/og";
import { SITE } from "@/site.config";
import { historyOf, priceOf, productBySlug, refCents, setById, summaryOf } from "@/lib/data";
import { money } from "@/lib/format";
import { shortName } from "@/lib/names";
import { moveNote, priceGap, sparkPath, storeName } from "@/lib/share";

export const revalidate = 86400;
export const generateStaticParams = () => [];
export const alt = `Price comparison on ${SITE.name}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image({ params }: { params: { slug: string } }) {
  const p = productBySlug(params.slug);
  const t = SITE.theme;
  const name = p ? shortName(p.name) : SITE.name;
  const gap = p ? priceGap(priceOf(p.id).offers, "US") : null;
  const ref = p ? refCents(p.id) : null;
  const sm = p ? summaryOf(p.id) : null;
  const hist = p ? historyOf(p) : [];
  const spark = sparkPath(hist, 300, 120);
  const span = hist.length ? Math.min(30, hist[hist.length - 1][0] - hist.filter(([d]) => d > hist[hist.length - 1][0] - 30)[0][0] + 1) : 0;
  const move = sm ? moveNote(sm.change7d, sm.change30d) : null;
  const up = (sm?.change7d ?? sm?.change30d ?? 0) >= 0;
  const stores = sm?.inStockSources ?? 0;
  const side = !!(spark || move || stores);
  const sub = p ? [setById(p.setId)?.name, p.number].filter(Boolean).join(" · ") : SITE.tagline;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: t.pageDark, color: "#fff", padding: "48px 64px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: 30, color: t.brandLight, fontWeight: 700 }}>{SITE.name}</div>
          <div style={{ fontSize: name.length > 40 ? 50 : name.length > 24 ? 60 : 70, fontWeight: 800, lineHeight: 1.08, marginTop: 14 }}>{name}</div>
          {sub && <div style={{ fontSize: 28, color: "#a9b4cc", marginTop: 10 }}>{sub}</div>}
          {gap ? (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span style={{ fontSize: 76, fontWeight: 800, color: "#4ade80" }}>{money(gap.low.cents, gap.low.currency)}</span>
                <span style={{ fontSize: 30, color: "#cfd6e6", marginLeft: 18 }}>at {storeName(gap.low)}</span>
              </div>
              <div style={{ fontSize: 34, color: "#cfd6e6", marginTop: 6 }}>
                {`up to ${money(gap.high.cents, gap.high.currency)} elsewhere`}
              </div>
              <div style={{ display: "flex", marginTop: 22 }}>
                <span style={{ fontSize: 34, fontWeight: 800, background: t.accent, color: "#fff", padding: "8px 20px", borderRadius: 12 }}>{`${gap.pct}% less · ${gap.sellers} sellers compared`}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>
              <span style={{ fontSize: 72, fontWeight: 800, color: "#4ade80" }}>{ref ? money(ref) : "Compare prices"}</span>
              <span style={{ fontSize: 30, color: "#cfd6e6", marginTop: 6 }}>{ref ? "TCGplayer market · every store compared" : `TCGplayer, eBay and ${SITE.gameShort} stores`}</span>
            </div>
          )}
        </div>
        {side && (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 340, marginLeft: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "22px 20px" }}>
              <div style={{ fontSize: 22, color: "#a9b4cc" }}>{`Market price, ${span >= 30 ? "30" : span} days`}</div>
              {spark ? (
                <svg width="300" height="120" viewBox="0 0 300 120" style={{ marginTop: 12 }}>
                  <path d={spark} fill="none" stroke={up ? "#4ade80" : "#f87171"} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              ) : (
                <div style={{ fontSize: 24, color: "#cfd6e6", marginTop: 12 }}>History starting</div>
              )}
              {move && <div style={{ fontSize: 30, fontWeight: 800, marginTop: 12, color: move.startsWith("Up") ? "#4ade80" : move.startsWith("Down") ? "#f87171" : "#fff" }}>{move}</div>}
              {stores > 0 && <div style={{ fontSize: 24, color: "#cfd6e6", marginTop: 8 }}>{`${stores} ${stores === 1 ? "seller" : "sellers"} in stock worldwide`}</div>}
            </div>
          </div>
        )}
      </div>
    ),
    { ...size, headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
