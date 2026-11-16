// One product's price history for the collection chart (lib/vault-history.ts): [day, TCGplayer market US cents] from
// the committed data/history files, the last 400 days. A function response kept by Vercel's CDN for 24 hours (the data
// only changes with a release and a day's price is one point), so a collection of 40 items costs the CDN, not us.
import { NextResponse } from "next/server";
import { historyOf, productById } from "@/lib/data";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" };

export function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const p = Number.isInteger(id) ? productById(id) : null;
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404, headers: HEADERS });
  const series = historyOf(p);
  const from = Math.floor(Date.now() / 86_400_000) - 400;
  return NextResponse.json({ id: p.id, currency: "USD", series: series.filter((x) => x[0] >= from) }, { headers: HEADERS });
}
