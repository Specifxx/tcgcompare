// Every outbound buy link goes through here: the destination is checked
// against known shop hosts (so /go is not an open redirect), tagged with the
// affiliate parameters, and the visitor is sent on. The click itself is
// recorded by the "buy_click" Vercel Analytics event (BuyClickTracker); there
// is no database.
import { NextResponse } from "next/server";
import { SITE } from "@/site.config";
import { isPaidSource, subId, tagged } from "@/lib/affiliate";
import { track } from "@vercel/analytics/server";
import { looksLikeBot, suspectClick } from "@/lib/bot-click";

export const dynamic = "force-dynamic";

const ALLOWED = [
  /(^|\.)ebay\.(com|co\.uk|com\.au|ca|de|fr|it|es)$/i,
  /(^|\.)tcgplayer\.com$/i,
  /(^|\.)amazon\.(com|co\.uk|ca|com\.au|de)$/i,
  ...[...SITE.stores, ...(SITE.kits?.stores ?? [])].map((s) => new RegExp(`(^|\\.)${new URL(s.base).hostname.replace(/^www\./, "").replace(/\./g, "\\.")}$`, "i")),
];

export async function GET(req: Request) {
  const u = new URL(req.url);
  const dest = u.searchParams.get("u") ?? "";
  let host = "";
  try {
    host = new URL(dest).hostname;
  } catch {}
  if (!host || !ALLOWED.some((r) => r.test(host)) || !/^https:\/\//.test(dest)) return NextResponse.redirect(new URL("/", req.url));
  const pid = Number(u.searchParams.get("p")) || null;
  const page = (u.searchParams.get("from") ?? "").slice(0, 40) || null;
  const market = (u.searchParams.get("m") ?? "").slice(0, 4) || null;
  // c=1: an in-stock Shopify store row, sent straight to its checkout (lib/checkout-link.ts).
  // A bot still reaches the shop, untagged, so the affiliate network never counts it as our click (lib/bot-click.ts).
  const target = looksLikeBot(req.headers) ? dest : tagged(dest, subId(market, page, pid), { checkout: u.searchParams.get("c") === "1" });
  // The click log's server half (DECISIONS.md, 2026-11-17): the visitor's country, which the browser does not know. No database:
  // a Vercel Analytics event and one runtime-log line (scripts/paid-click-share.ts reads either). Bots are not logged.
  // Only the server-side log skips a suspect click; its link stays tagged (owner, 2026-11-22: never untag a real person).
  if (!suspectClick(req.headers)) {
    const source = (u.searchParams.get("s") ?? "").slice(0, 24);
    const country = (req.headers.get("x-vercel-ip-country") ?? "").slice(0, 2).toUpperCase() || "XX";
    const evt = {
      country,
      market,
      retailer_key: source,
      paid: isPaidSource(source),
      position: Number(u.searchParams.get("r")) || 0,
      price_gap_pct: u.searchParams.has("g") ? Number(u.searchParams.get("g")) : -1,
      page,
      product: pid ?? 0,
      link_type: u.searchParams.get("c") === "1" ? "checkout" : "product",
    };
    console.log(JSON.stringify({ evt: "buy_click_geo", ...evt }));
    try {
      await track("buy_click_geo", evt);
    } catch {}
  }
  const res = NextResponse.redirect(target, 302);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  // Affiliate links must be non-indexed and non-cacheable (Amazon Associates Operating Agreement, 2026-11-02).
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
