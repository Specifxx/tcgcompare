"use client";
// The filter and sort bar over a product grid (2026-11-23: the list pages were one undifferentiated wall, 774 booster boxes on
// one page). The grid itself is server HTML (FilterGrid.tsx): every product link is in the page for crawlers and for a browser
// without scripts. This bar only hides tiles (.lc-x) and sets their CSS `order`; it never fetches, never navigates and never
// changes the URL's path or query (one CDN copy per URL). The choice lives in the hash, so a filtered list can be shared.
import { useCallback, useEffect, useRef, useState } from "react";

export interface LcGame { id: string; name: string; n: number }
export interface LcSet { id: string; name: string; n: number }
// The owner's UX review (2026-11-23, P0 3): price both ways, % under market and newest, plus set, era (release year) and price band.
// No price-per-pack sort: the catalogue holds no pack counts and none is ever guessed. No language filter: the catalogue is English.
type Sort = "pop" | "new" | "lo" | "hi" | "under" | "stores";
const SORTS: [Sort, string][] = [["pop", "Most popular"], ["lo", "Price: low to high"], ["hi", "Price: high to low"], ["under", "% under market"], ["new", "Newest set"], ["stores", "Most stores"]];
type Band = "" | "u50" | "50" | "150" | "400";
const BANDS: [Exclude<Band, "">, string, number, number][] = [["u50", "Under $50", 0, 5000], ["50", "$50–150", 5000, 15000], ["150", "$150–400", 15000, 40000], ["400", "$400+", 40000, Infinity]];
interface Row { el: HTMLElement; i: number; date: string; cents: number; stores: number; pre: boolean; game: string; set: string; under: number; name: string }

export function ListControls({ target, total, games, sets = [], first, noun = "products" }: { target: string; total: number; games: LcGame[]; sets?: LcSet[]; first: number; noun?: string }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("pop");
  const [stock, setStock] = useState(false);
  const [game, setGame] = useState("");
  const [set, setSet] = useState("");
  const [year, setYear] = useState("");
  const [band, setBand] = useState<Band>("");
  const [limit, setLimit] = useState(first);
  const [count, setCount] = useState(total);
  const rows = useRef<Row[] | null>(null);
  const ready = useRef(false);

  const read = useCallback((): Row[] => {
    if (rows.current) return rows.current;
    const grid = document.getElementById(target);
    rows.current = grid
      ? Array.from(grid.querySelectorAll<HTMLElement>("[data-lc]")).map((el, i) => {
          const [date, cents, stores, pre, g, st, under] = (el.dataset.lc ?? "").split("|");
          return { el, i, date, cents: Number(cents) || 0, stores: Number(stores) || 0, pre: pre === "1", game: g ?? "", set: st ?? "", under: Number(under) || 0, name: (el.dataset.qvName ?? el.textContent ?? "").toLowerCase() };
        })
      : [];
    return rows.current;
  }, [target]);

  // The hash on arrival (a shared filtered list), once.
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const s = h.get("sort") as Sort | null;
    if (s && SORTS.some(([k]) => k === s)) setSort(s);
    if (h.get("stock") === "1") setStock(true);
    const g = h.get("game");
    if (g && games.some((x) => x.id === g)) setGame(g);
    const text = h.get("q");
    if (text) setQ(text.slice(0, 60));
    const st = h.get("set");
    if (st && sets.some((x) => x.id === st)) setSet(st);
    const y = h.get("year");
    if (y && /^\d{4}$/.test(y)) setYear(y);
    const b = h.get("price") as Band | null;
    if (b && BANDS.some(([k]) => k === b)) setBand(b);
    ready.current = true;
  }, [games, sets]);
  // The release years in the list, newest first (the era filter); read once from the tiles.
  const [years, setYears] = useState<string[]>([]);
  useEffect(() => {
    setYears([...new Set(read().map((r) => r.date.slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))].sort().reverse());
  }, [read]);

  useEffect(() => {
    const all = read();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const bandOf = BANDS.find(([k]) => k === band);
    const keep = all.filter(
      (r) =>
        (!game || r.game === game) &&
        (!set || r.set === set) &&
        (!year || r.date.startsWith(year)) &&
        (!bandOf || (r.cents > 0 && r.cents >= bandOf[2] && r.cents < bandOf[3])) &&
        (!stock || (r.stores > 0 && !r.pre)) &&
        words.every((w) => r.name.includes(w)),
    );
    const priced = (r: Row) => (r.cents > 0 ? 0 : 1); // a product with no price never leads a price sort
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      pop: (a, b) => a.i - b.i,
      new: (a, b) => b.date.localeCompare(a.date) || a.i - b.i,
      lo: (a, b) => priced(a) - priced(b) || a.cents - b.cents || a.i - b.i,
      hi: (a, b) => priced(a) - priced(b) || b.cents - a.cents || a.i - b.i,
      under: (a, b) => b.under - a.under || a.i - b.i,
      stores: (a, b) => b.stores - a.stores || a.i - b.i,
    };
    keep.sort(by[sort]);
    const pos = new Map(keep.map((r, n) => [r, n]));
    for (const r of all) {
      const n = pos.get(r);
      r.el.classList.toggle("lc-x", n == null || n >= limit);
      r.el.style.order = n == null ? "" : String(n);
    }
    setCount(keep.length);
    if (ready.current) {
      const h = new URLSearchParams();
      if (sort !== "pop") h.set("sort", sort);
      if (stock) h.set("stock", "1");
      if (game) h.set("game", game);
      if (set) h.set("set", set);
      if (year) h.set("year", year);
      if (band) h.set("price", band);
      if (q) h.set("q", q);
      const s = h.toString();
      if (s || window.location.hash) history.replaceState(null, "", s ? `#${s}` : window.location.pathname + window.location.search);
    }
  }, [q, sort, stock, game, set, year, band, limit, read]);

  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setLimit(first); };
  const filtered = !!(q || stock || game || set || year || band);
  const shown = Math.min(limit, count);
  return (
    <div className="lc" data-lc-bar>
      <div className="lc-row">
        <label className="lc-search">
          <span className="sr-only">Filter these {noun} by name</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" /></svg>
          <input type="search" value={q} onChange={(e) => change(setQ)(e.target.value)} placeholder="Filter by name" aria-label={`Filter ${total.toLocaleString()} ${noun} by name`} autoComplete="off" enterKeyHint="search" />
        </label>
        <label className="lc-sort">
          <span className="sr-only">Sort by</span>
          <select value={sort} onChange={(e) => change(setSort)(e.target.value as Sort)}>
            {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="scroller lc-chips" role="group" aria-label="Filters">
        <button type="button" aria-pressed={stock} onClick={() => change(setStock)(!stock)} className={`chip min-h-10 whitespace-nowrap ${stock ? "chip-on" : ""}`}>
          <span aria-hidden="true" className="lc-dot" />In stock now
        </button>
        {BANDS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={band === k} onClick={() => change(setBand)(band === k ? "" : k)} className={`chip min-h-10 whitespace-nowrap ${band === k ? "chip-on" : ""}`}>
            {label}
          </button>
        ))}
        {sets.length > 1 && (
          <label className="lc-sort">
            <span className="sr-only">Set</span>
            <select value={set} onChange={(e) => change(setSet)(e.target.value)} aria-label="Filter by set">
              <option value="">Every set</option>
              {sets.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.n})</option>)}
            </select>
          </label>
        )}
        {years.length > 1 && (
          <label className="lc-sort">
            <span className="sr-only">Release year</span>
            <select value={year} onChange={(e) => change(setYear)(e.target.value)} aria-label="Filter by release year">
              <option value="">Any year</option>
              {years.map((y) => <option key={y} value={y}>Released {y}</option>)}
            </select>
          </label>
        )}
        {games.length > 1 && games.map((g) => (
          <button key={g.id} type="button" aria-pressed={game === g.id} onClick={() => change(setGame)(game === g.id ? "" : g.id)} className={`chip min-h-10 whitespace-nowrap ${game === g.id ? "chip-on" : ""}`}>
            {g.name} <span className="tabular text-xs opacity-60">{g.n}</span>
          </button>
        ))}
      </div>
      <p className="lc-count" aria-live="polite">
        {count === 0 ? `No ${noun} match.` : `Showing ${shown.toLocaleString()} of ${count.toLocaleString()}${filtered ? ` (${total.toLocaleString()} in all)` : ""}`}
        {filtered && <button type="button" className="lc-clear" onClick={() => { setQ(""); setStock(false); setGame(""); setSet(""); setYear(""); setBand(""); setLimit(first); }}>Clear filters</button>}
      </p>
      {/* The grid sits between the bar and this foot in the page; `order` in the wrapper (globals.css .lc-wrap) puts it last. */}
      {count > limit && (
        <div className="lc-more">
          <button type="button" className="btn-soft min-h-11 px-5" onClick={() => setLimit(limit + first)}>Show {Math.min(first, count - limit)} more</button>
          <button type="button" className="btn-ghost min-h-11 px-4" onClick={() => setLimit(count)}>Show all {count.toLocaleString()}</button>
        </div>
      )}
    </div>
  );
}
