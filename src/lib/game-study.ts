// Two data studies behind the guides, computed from the same committed files as every page, so the numbers in a guide
// are today's (a guide's html uses {{study:...}} tokens, lib/post-render.ts). Pure over the catalogue: no network, no
// request. Prices are TCGplayer's US market price in dollars and US store prices in dollars, never converted.
import { products, refCents, setById, summaryOf } from "./data";
import { LINES } from "./lines";
import { money } from "./format";
import { storesVsTcgplayer, type ReportRow } from "./market-report";
import { shortName } from "./names";
import { escapeHtml } from "./html";
import type { GameLine, Product } from "./site-types";

const median = (xs: number[]): number => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const releasedSealed = (line: GameLine, type?: string): Product[] =>
  products().filter((p) => {
    if (p.kind !== "sealed" || (type && p.sealedType !== type)) return false;
    const s = setById(p.setId);
    return !!s && s.line === line.id && !s.upcoming && refCents(p.id) != null;
  });

export interface BoxRow { line: GameLine; count: number; median: number; cheapest: Product; priciest: Product }

/** Per game: how many released booster boxes carry a TCGplayer market price, and the median, cheapest and dearest of them. */
export function boxRows(minBoxes = 5): BoxRow[] {
  const out: BoxRow[] = [];
  for (const line of LINES) {
    const boxes = releasedSealed(line, "Booster Box");
    if (boxes.length < minBoxes) continue;
    const byPrice = boxes.slice().sort((a, b) => refCents(a.id)! - refCents(b.id)!);
    out.push({ line, count: boxes.length, median: median(boxes.map((p) => refCents(p.id)!)), cheapest: byPrice[0], priciest: byPrice[byPrice.length - 1] });
  }
  return out.sort((a, b) => b.median - a.median);
}

export interface BeatRow { line: GameLine; compared: number; storeCheaper: number; medianSaving: number | null }

/** Per game: how often a US store sells below TCGplayer's market price, over every released sealed product of US$5 or more. */
export function beatRows(minCompared = 30): BeatRow[] {
  const out: BeatRow[] = [];
  for (const line of LINES) {
    const rows: ReportRow[] = releasedSealed(line).map((p) => ({ p, ref: refCents(p.id), best: summaryOf(p.id).best, change30d: null }));
    const s = storesVsTcgplayer(rows);
    if (s.compared >= minCompared) out.push({ line, ...s });
  }
  return out.sort((a, b) => b.storeCheaper / b.compared - a.storeCheaper / a.compared);
}

const link = (p: Product) => `<a href="/card/${p.slug}">${escapeHtml(shortName(p.name))}</a> (${money(refCents(p.id))})`;
const gameLink = (l: GameLine) => `<a href="/games/${l.slug}">${escapeHtml(l.short)}</a>`;

export function boxTable(): string {
  const rows = boxRows();
  if (!rows.length) return "";
  const tr = rows.map((r) => `<tr><td>${gameLink(r.line)}</td><td>${r.count}</td><td><b>${money(r.median)}</b></td><td>${link(r.cheapest)}</td><td>${link(r.priciest)}</td></tr>`).join("");
  return `<table><thead><tr><th>Game</th><th>Boxes</th><th>Median box</th><th>Cheapest box</th><th>Dearest box</th></tr></thead><tbody>${tr}</tbody></table>`;
}

export function beatTable(): string {
  const rows = beatRows();
  if (!rows.length) return "";
  const tr = rows
    .map((r) => `<tr><td>${gameLink(r.line)}</td><td>${r.compared}</td><td><b>${Math.round((100 * r.storeCheaper) / r.compared)}%</b></td><td>${r.medianSaving == null ? "—" : `${r.medianSaving}%`}</td></tr>`)
    .join("");
  return `<table><thead><tr><th>Game</th><th>Products compared</th><th>A US store is cheaper</th><th>Median saving when it is</th></tr></thead><tbody>${tr}</tbody></table>`;
}

/** Single facts the prose quotes. Unknown key: an empty string, so a typo shows as a gap in the test, never a wrong number. */
export function fact(key: string): string {
  if (key.includes(":")) return factArg(key);
  const b = boxRows();
  const w = beatRows();
  switch (key) {
    case "boxGames": return String(b.length);
    case "boxCount": return String(b.reduce((n, r) => n + r.count, 0));
    case "dearestGame": return b[0] ? escapeHtml(b[0].line.short) : "";
    case "dearestMedian": return b[0] ? money(b[0].median) : "";
    case "cheapestGame": return b.length ? escapeHtml(b[b.length - 1].line.short) : "";
    case "cheapestMedian": return b.length ? money(b[b.length - 1].median) : "";
    case "beatGames": return String(w.length);
    case "beatBestGame": return w[0] ? escapeHtml(w[0].line.short) : "";
    case "beatBestPct": return w[0] ? `${Math.round((100 * w[0].storeCheaper) / w[0].compared)}%` : "";
    case "beatWorstGame": return w.length ? escapeHtml(w[w.length - 1].line.short) : "";
    case "beatWorstPct": return w.length ? `${Math.round((100 * w[w.length - 1].storeCheaper) / w[w.length - 1].compared)}%` : "";
    default: return "";
  }
}

// ---- Per-set studies for one game (guides on a single game) ----

const lineOf = (id: string): GameLine | null => LINES.find((l) => l.id === id) ?? null;
const monthsSince = (iso: string | null | undefined, now = Date.now()): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.round((now - t) / (30.44 * 864e5)));
};

/** One game's released booster boxes, newest set first: price, age and how many stores have it in stock today. */
export function setBoxRows(lineId: string): { p: Product; set: string; rel: string; months: number | null; ref: number; stock: number }[] {
  const line = lineOf(lineId);
  if (!line) return [];
  return releasedSealed(line, "Booster Box")
    .map((p) => ({ p, s: setById(p.setId)! }))
    .sort((a, b) => (b.s.releasedOn ?? "").localeCompare(a.s.releasedOn ?? ""))
    .map(({ p, s }) => ({ p, set: s.name, rel: s.releasedOn ?? "", months: monthsSince(s.releasedOn), ref: refCents(p.id)!, stock: summaryOf(p.id).inStockSources }));
}

export function setBoxTable(lineId: string): string {
  const rows = setBoxRows(lineId);
  if (!rows.length) return "";
  const tr = rows
    .map((r) => `<tr><td><a href="/card/${r.p.slug}">${escapeHtml(shortName(r.p.name))}</a></td><td>${escapeHtml(r.rel.slice(0, 7))}</td><td>${r.months ?? "—"}</td><td><b>${money(r.ref)}</b></td><td>${r.stock}</td></tr>`)
    .join("");
  return `<table><thead><tr><th>Booster box</th><th>Released</th><th>Months old</th><th>TCGplayer market</th><th>Stores with stock</th></tr></thead><tbody>${tr}</tbody></table>`;
}

export interface VariantPair { set: string; base: Product; premium: Product; ratio: number }

/** Sets where a game sells a booster product in a standard and a premium edition (name carries `word`), same set. */
export function variantPairs(lineId: string, word: string): VariantPair[] {
  const line = lineOf(lineId);
  if (!line) return [];
  const re = new RegExp(word, "i");
  const bySet = new Map<number, Product[]>();
  for (const p of releasedSealed(line)) if (/booster (box|display)/i.test(p.name) || p.sealedType === "Booster Box") bySet.set(p.setId, [...(bySet.get(p.setId) ?? []), p]);
  const out: VariantPair[] = [];
  for (const [setId, ps] of bySet) {
    const prem = ps.filter((p) => re.test(p.name));
    const base = ps.filter((p) => !re.test(p.name));
    if (prem.length === 1 && base.length === 1) out.push({ set: setById(setId)!.name, base: base[0], premium: prem[0], ratio: refCents(prem[0].id)! / refCents(base[0].id)! });
  }
  return out.sort((a, b) => (setById(b.base.setId)!.releasedOn ?? "").localeCompare(setById(a.base.setId)!.releasedOn ?? ""));
}

export function variantTable(lineId: string, word: string): string {
  const rows = variantPairs(lineId, word);
  if (!rows.length) return "";
  const tr = rows
    .map((r) => `<tr><td>${escapeHtml(r.set)}</td><td><a href="/card/${r.base.slug}">${money(refCents(r.base.id))}</a></td><td><a href="/card/${r.premium.slug}">${money(refCents(r.premium.id))}</a></td><td><b>${r.ratio.toFixed(1)}×</b></td></tr>`)
    .join("");
  return `<table><thead><tr><th>Set</th><th>Standard box</th><th>${escapeHtml(word)} edition</th><th>Price multiple</th></tr></thead><tbody>${tr}</tbody></table>`;
}

/** A product photo with its live price, linked to its page (the stores' and TCGplayer's own photo, hotlinked as everywhere). */
export function productFigure(id: number): string {
  const p = products().find((x) => x.id === id);
  if (!p || !p.image) return "";
  return `<figure style="margin:1.25rem 0;text-align:center"><a href="/card/${p.slug}"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(shortName(p.name))}" width="200" height="200" loading="lazy" decoding="async" style="margin:0 auto;max-height:240px;width:auto"></a><figcaption style="font-size:.85rem;opacity:.75">${escapeHtml(shortName(p.name))}: TCGplayer market ${money(refCents(p.id))}</figcaption></figure>`;
}

/** Facts that take a game id: "carbMedian:swu", "carbMin:swu", "carbMax:swu", "carbSets:swu", "dearestOld:fab" (name of the dearest box).
 *  A missing game or empty list gives an empty string. */
function factArg(key: string): string {
  const [k, id] = key.split(":");
  const v = variantPairs(id, "Carbonite");
  const r = v.map((x) => x.ratio).sort((a, b) => a - b);
  const one = (x: number | undefined) => (x == null ? "" : `${x.toFixed(1)}×`);
  switch (k) {
    case "carbMedian": return r.length ? one(median(r)) : "";
    case "carbMin": return one(r[0]);
    case "carbMax": return one(r[r.length - 1]);
    case "carbSets": return String(v.length);
    case "boxStockMin": { const b = setBoxRows(id); return b.length ? String(Math.min(...b.map((x) => x.stock))) : ""; }
    case "boxDearest": { const b = setBoxRows(id).slice().sort((a, c) => c.ref - a.ref)[0]; return b ? escapeHtml(shortName(b.p.name)) : ""; }
    case "boxDearestPrice": { const b = setBoxRows(id).slice().sort((a, c) => c.ref - a.ref)[0]; return b ? money(b.ref) : ""; }
    case "boxDearestMonths": { const b = setBoxRows(id).slice().sort((a, c) => c.ref - a.ref)[0]; return b?.months != null ? String(b.months) : ""; }
    case "boxCheapest": { const b = setBoxRows(id).slice().sort((a, c) => a.ref - c.ref)[0]; return b ? escapeHtml(shortName(b.p.name)) : ""; }
    case "boxCheapestPrice": { const b = setBoxRows(id).slice().sort((a, c) => a.ref - c.ref)[0]; return b ? money(b.ref) : ""; }
    case "boxCount": return String(setBoxRows(id).length);
    default: return "";
  }
}
