import { meta } from "@/lib/data";
import { openRows, toCsv, OPEN_LICENCE } from "@/lib/open-data";

// The open dataset (lib/open-data.ts): one row per sealed product and market, the cheapest in-stock STORE price. Built
// with the deploy and served as a file; no function runs for it. Open to every origin.
export const dynamic = "force-static";

export function GET() {
  const date = (meta()?.updatedAt ?? new Date().toISOString()).slice(0, 10);
  return new Response(toCsv(openRows(), date), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="tcgprices-sealed-store-prices.csv"',
      "Cache-Control": "public, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
      "X-Data-Licence": OPEN_LICENCE,
    },
  });
}
