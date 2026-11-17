// Read-only per-game coverage report (site loop, 2026-11-18): for each game, its sealed products, how many have a TCGplayer
// reference price, how many are indexable under the index gate (lib/indexing.ts), and the in-stock store-offer spread.
// Prints a table; writes nothing. Run: npx tsx scripts/coverage-report.ts
import { products, setById, indexSignals, refCents } from "@/lib/data";
import { cardIndexable } from "@/lib/indexing";
import { lineOfSet } from "@/lib/lines";

type Row = { products: number; ref: number; indexable: number; noStore: number; one: number; twoPlus: number; noindexNoRef: number };
const by = new Map<string, Row>();
for (const p of products()) {
  if (p.kind !== "sealed") continue;
  const set = setById(p.setId);
  const g = lineOfSet(set)?.slug ?? "unknown";
  const r = by.get(g) ?? { products: 0, ref: 0, indexable: 0, noStore: 0, one: 0, twoPlus: 0, noindexNoRef: 0 };
  const s = indexSignals(p);
  const idx = cardIndexable(p, s, set);
  r.products++;
  if (refCents(p.id) != null) r.ref++;
  if (idx) r.indexable++;
  if (s.storeOffers === 0) r.noStore++; else if (s.storeOffers === 1) r.one++; else r.twoPlus++;
  if (!idx && refCents(p.id) == null) r.noindexNoRef++;
  by.set(g, r);
}
const rows = [...by.entries()].sort((a, b) => b[1].products - a[1].products);
const tot = rows.reduce((t, [, r]) => { for (const k of Object.keys(r) as (keyof Row)[]) t[k] = (t[k] ?? 0) + r[k]; return t; }, {} as Partial<Row>);
console.log("game\tproducts\twithTCGplayerRef\tindexable\tstores0\tstores1\tstores2+\tnoindex&noRef");
for (const [g, r] of [...rows, ["TOTAL", tot as Row] as [string, Row]]) console.log([g, r.products, r.ref, r.indexable, r.noStore, r.one, r.twoPlus, r.noindexNoRef].join("\t"));
