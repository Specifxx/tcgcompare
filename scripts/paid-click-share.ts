// Summarises the outbound-click log by visitor country: how many clicks, and what share went to a PAID row (eBay,
// TCGplayer, Amazon) rather than a store, for AU vs US vs EU vs the rest (Grok growth report, item 1, 2026-11-17).
//
// There is no database. /go writes one JSON line per real click to the Vercel runtime log
//   {"evt":"buy_click_geo","country":"AU","market":"AU","retailer_key":"ebay","paid":true,"position":1,"price_gap_pct":-1,...}
// and the same event to Vercel Analytics ("buy_click_geo"). Feed this script any text file that contains those lines:
//   vercel logs <deployment-url> --json > clicks.ndjson   (or a log-drain export; other lines are ignored)
//   npx tsx scripts/paid-click-share.ts clicks.ndjson [more files...]
// A line may be wrapped in another JSON object ("message": "{...}"); the first buy_click_geo object found is used.
import fs from "node:fs";

export interface ClickRow { country: string; market?: string; retailer_key?: string; paid: boolean; position?: number; price_gap_pct?: number }

const EU = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" "));
export const regionOf = (c: string): string => (c === "AU" ? "AU" : c === "US" ? "US" : c === "GB" ? "UK" : c === "CA" ? "CA" : c === "NZ" ? "NZ" : c === "SG" ? "SG" : EU.has(c) ? "EU" : "Other");

export function parse(text: string): ClickRow[] {
  const out: ClickRow[] = [];
  for (const line of text.split("\n")) {
    const i = line.indexOf("buy_click_geo");
    if (i < 0) continue;
    // The object holding the marker: the nearest "{" before it that parses, allowing a JSON-escaped wrapper.
    for (const l of [line, line.replace(/\\"/g, '"')]) {
      const j = l.indexOf("buy_click_geo");
      let start = l.lastIndexOf("{", j);
      let got: ClickRow | null = null;
      while (start >= 0 && !got) {
        const end = l.indexOf("}", j);
        try {
          const o = JSON.parse(l.slice(start, end + 1));
          if (o && typeof o === "object" && "country" in o) got = o as ClickRow;
        } catch {}
        start = start > 0 ? l.lastIndexOf("{", start - 1) : -1;
      }
      if (got) { out.push(got); break; }
    }
  }
  return out;
}

export function summarise(rows: ClickRow[]) {
  const by = new Map<string, { clicks: number; paid: number; top: number }>();
  for (const r of rows) {
    const k = regionOf(String(r.country ?? "").toUpperCase());
    const e = by.get(k) ?? { clicks: 0, paid: 0, top: 0 };
    e.clicks++;
    if (r.paid) e.paid++;
    if ((r.position ?? 0) > 0 && (r.position ?? 0) <= 2) e.top++;
    by.set(k, e);
  }
  return [...by.entries()].map(([region, e]) => ({ region, ...e, paidShare: e.clicks ? e.paid / e.clicks : 0 })).sort((a, b) => b.clicks - a.clicks);
}

if (process.argv[1]?.endsWith("paid-click-share.ts")) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("usage: npx tsx scripts/paid-click-share.ts clicks.ndjson [...]"); process.exit(1); }
  const rows = files.flatMap((f) => parse(fs.readFileSync(f, "utf8")));
  console.log(`${rows.length} clicks`);
  console.log("region   clicks   paid   paid share   in top 2 rows");
  for (const s of summarise(rows)) console.log(`${s.region.padEnd(8)} ${String(s.clicks).padStart(6)} ${String(s.paid).padStart(6)} ${(s.paidShare * 100).toFixed(1).padStart(9)}% ${String(s.top).padStart(10)}`);
}
