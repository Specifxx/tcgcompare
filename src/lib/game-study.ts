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
