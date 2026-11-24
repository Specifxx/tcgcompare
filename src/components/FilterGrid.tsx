// A product grid with its filter and sort bar (ListControls.tsx). Server HTML: every tile is in the page, most likely to be
// bought first (lib/home-demand.ts rankProducts); tiles past the first screenful carry .lc-x (hidden) until the visitor asks for
// more, so a type page is a few screens long instead of a hundred. Without scripts the <noscript> rule shows them all.
import type { Product } from "@/lib/site-types";
import { refCents, setById, summaryOf } from "@/lib/data";
import { isPreorder } from "@/lib/preorders";
import { rankProducts } from "@/lib/home-demand";
import { LINES, lineById } from "@/lib/lines";
import { ProductTile } from "@/components/ProductTile";
import { ListControls, type LcGame, type LcSet } from "@/components/ListControls";

/** How far the cheapest in-stock US store sits under TCGplayer's market price, in whole percent (0 when not under). */
export function underMarket(p: Product): number {
  const ref = refCents(p.id);
  const o = summaryOf(p.id).best.find((x) => x.market === "US" && x.inStock && x.currency === "USD" && x.source !== "tcgplayer");
  return ref && o && o.cents > 0 && o.cents < ref ? Math.round(((ref - o.cents) / ref) * 100) : 0;
}

/** What the bar reads of a tile: release date | market cents | stores in stock | pre-order | game | set id | % under market. */
export function lcData(p: Product): string {
  const set = setById(p.setId);
  return [set?.releasedOn ?? "", refCents(p.id) ?? 0, summaryOf(p.id).inStockSources, set && isPreorder(set) ? 1 : 0, set?.line ?? "", p.setId, underMarket(p)].join("|");
}

export function FilterGrid({ items, id = "lc-grid", first = 40, games = false, noun }: { items: Product[]; id?: string; first?: number; games?: boolean; noun?: string }) {
  const ranked = rankProducts(items);
  const counts = new Map<string, number>();
  if (games) for (const p of ranked) { const l = setById(p.setId)?.line; if (l) counts.set(l, (counts.get(l) ?? 0) + 1); }
  const gameList: LcGame[] = LINES.filter((l) => counts.has(l.id)).map((l) => ({ id: l.id, name: lineById(l.id)?.short ?? l.name, n: counts.get(l.id)! }));
  // The set filter (owner's UX review, P0 3): every set in the list, newest first; the years for the era filter.
  const setCount = new Map<number, number>();
  for (const p of ranked) setCount.set(p.setId, (setCount.get(p.setId) ?? 0) + 1);
  const setList: LcSet[] = [...setCount]
    .map(([id, n]) => ({ id: String(id), name: setById(id)?.name ?? "", date: setById(id)?.releasedOn ?? "", n }))
    .filter((x) => x.name)
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))
    .map(({ id, name, n }) => ({ id, name, n }));
  // A short list needs no bar: nothing to filter, nothing folded.
  if (ranked.length <= 12)
    return <div className="pc-grid">{ranked.map((p) => <ProductTile key={p.id} p={p} />)}</div>;
  return (
    <div className="lc-wrap">
      <noscript><style>{`.lc-x{display:flex!important}.lc{display:none!important}`}</style></noscript>
      <ListControls target={id} total={ranked.length} games={gameList} sets={setList.length > 1 ? setList : []} first={first} noun={noun} />
      <div id={id} className="pc-grid lc-grid">
        {ranked.map((p, i) => <ProductTile key={p.id} p={p} lc={lcData(p)} folded={i >= first} />)}
      </div>
    </div>
  );
}
