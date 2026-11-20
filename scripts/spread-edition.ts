// The Spread (lib/spread.ts, DECISIONS.md "The Spread"): writes one frozen edition to data/spread/<id>.json from the
// committed store-lows series and today's committed offers. Run by hand (or `spread-edition.yml`) after the data release
// that holds the edition's last day:
//   npx tsx scripts/spread-edition.ts --id 2026-11 --from 2026-11-16 --to 2026-12-01 [--title "..."] [--dry]
// It refuses to overwrite a published edition (pass --force only to re-cut an edition before it is published).
import fs from "node:fs";
import path from "node:path";
import { meta, priceOf, products, setById } from "@/lib/data";
import { lineOfSet } from "@/lib/lines";
import { dayNumber, dayToDate } from "@/lib/import/history";
import { readSetLows, LOWS_DIR } from "@/lib/import/store-lows";
import { buildEdition, type ProductInfo } from "@/lib/spread";
import type { Market, Offer } from "@/lib/site-types";
import type { Series } from "@/lib/series";

const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const flag = (k: string) => process.argv.includes(`--${k}`);
const day = (s: string) => dayNumber(new Date(`${s}T00:00:00Z`));

const id = arg("id");
const from = arg("from");
const to = arg("to");
if (!id || !/^\d{4}-\d{2}$/.test(id) || !from || !to) {
  console.error("usage: spread-edition.ts --id yyyy-mm --from yyyy-mm-dd --to yyyy-mm-dd [--title t] [--dry] [--force]");
  process.exit(2);
}
const [y, mo] = id.split("-").map(Number);
const monthName = new Date(Date.UTC(y, mo - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
const title = arg("title") ?? `The Spread, ${monthName} ${y}`;
const out = path.join(process.cwd(), "data", "spread", `${id}.json`);
if (fs.existsSync(out) && !flag("force") && !flag("dry")) {
  console.error(`${out} exists: an edition is frozen once written (--force only before it is published)`);
  process.exit(1);
}

const info = new Map<number, ProductInfo>();
const offers = new Map<number, readonly Offer[]>();
for (const p of products()) {
  if (p.kind !== "sealed" || p.sealedType === "Insert") continue;
  const set = setById(p.setId);
  const line = lineOfSet(set);
  if (!set || !line) continue;
  info.set(p.id, { id: p.id, name: p.name, slug: p.slug, type: p.sealedType ?? "Other", game: line.name, gameSlug: line.slug, set: set.name });
}
const lows = new Map<number, Partial<Record<Market, Series>>>();
for (const f of fs.readdirSync(LOWS_DIR)) {
  const setId = Number(f.replace(/\.json$/, ""));
  if (!Number.isFinite(setId)) continue;
  for (const [pid, s] of Object.entries(readSetLows(setId))) {
    const n = Number(pid);
    if (!info.has(n)) continue;
    lows.set(n, s as Partial<Record<Market, Series>>);
    offers.set(n, priceOf(n).offers);
  }
}

// Fixed sale days of the year, each against the same weekday a week before (DECISIONS.md "The Spread").
const EVENTS: { label: string; date: string }[] = [
  { label: "Black Friday", date: "2026-11-27" },
  { label: "Cyber Monday", date: "2026-11-30" },
];
const fromDay = day(from), toDay = day(to);
const events = EVENTS.map((e) => ({ label: e.label, day: day(e.date), vs: day(e.date) - 7 })).filter((e) => e.vs >= fromDay && e.day <= toDay);

const gapDate = (meta()?.updatedAt ?? new Date().toISOString()).slice(0, 10);
const ed = buildEdition({ id, title, published: new Date().toISOString().slice(0, 10), gapDate, fromDay, toDay, dayToDate, lows, info, offers, events });
const summary = ed.markets.map((m) => `${m.market} ${m.change ? `${m.change.median}% (n=${m.change.n})` : "-"} gap ${m.gap ? `${m.gap.toMedian}%/${m.gap.toDearest}% (n=${m.gap.n})` : "-"}`).join("; ");
console.log(`spread ${id} ${ed.from}..${ed.to}: ${summary}`);
if (flag("dry")) {
  console.log(JSON.stringify(ed, null, 1));
} else {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(ed, null, 1) + "\n");
  console.log(`wrote ${out}`);
}
