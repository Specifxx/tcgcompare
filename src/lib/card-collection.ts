// SINGLE CARDS IN MY COLLECTION (owner, 2026-11-26: "can we create something better than Collectr … you don't need to install an
// app"; DECISIONS.md "The collection app: single cards, what I paid, import, and an installable app").
//
// This site prices sealed product only. A single card in a member's collection is valued from TCG Singles DB's open card API
// (tcgsinglesdb.com/api/open, read in the browser, CORS-open and CDN-cached a day there): TCGplayer's market price in US cents
// per printing, every game Singles DB carries. Nothing of it is stored here or rendered on the server, so no page of this site
// gains a card, a function call or a byte of data/.
//
// A card is a VaultItem like a sealed product, so it syncs, backs up and shares through the same code:
//   id      `card:<game>:<set>:<tcgplayer id>:<printing, spaces as _>` (fits RiftCompare's stash id rule /^[A-Za-z0-9_.:-]{1,80}$/)
//   market  always "US", currency USD: TCGplayer's market price is a US$ figure, never converted, labelled as such.
//   href    "/collection": the row's links are built from the id (TCGplayer through /go, and an eBay search), never stored.
//
// Spreadsheet import (Collectr, the TCGplayer app, ManaBox, a home-made sheet): a row becomes a card only when its set name
// lands on exactly ONE set and its number (or, with no number, its exact name) on exactly one card of it, and the names agree.
// Anything else is listed back to the member as not matched, never guessed (a wrong card is worse than a missing one).
// Graded cards are reported, not priced: we have no graded prices.
//
// Pure: no window, no fetch. The fetching lives in components/vault/useCardPrices.ts.

export const SINGLES_API = (process.env.NEXT_PUBLIC_SINGLES_API || "https://tcgsinglesdb.com/api/open").replace(/\/$/, "");
export const SINGLES_SITE = "TCG Singles DB";
export const CARD_PREFIX = "card:";
/** The open API's history day numbers count from this day (tcgsinglesdb lib/cards.ts HISTORY_EPOCH). */
export const SINGLES_EPOCH = "2026-01-01";
const EPOCH_DAY = Math.round(Date.parse(`${SINGLES_EPOCH}T00:00:00Z`) / 86_400_000);
/** At most this many sets are fetched for one collection's prices (a set file is one CDN-cached request). */
export const MAX_SETS = 80;

/** The games a member can pick, in this order; search with no game looks across all of Singles DB's games. */
export const CARD_GAMES: { slug: string; name: string }[] = [
  { slug: "pokemon", name: "Pokémon" },
  { slug: "pokemon-japan", name: "Pokémon Japan" },
  { slug: "magic", name: "Magic" },
  { slug: "yugioh", name: "Yu-Gi-Oh!" },
  { slug: "one-piece", name: "One Piece" },
  { slug: "lorcana", name: "Lorcana" },
  { slug: "riftbound", name: "Riftbound" },
  { slug: "dragon-ball-fusion-world", name: "Fusion World" },
  { slug: "digimon", name: "Digimon" },
];
export const gameName = (slug: string) => CARD_GAMES.find((g) => g.slug === slug)?.name ?? slug.replace(/-/g, " ");

export interface CardRef {
  game: string;
  set: string;
  tcgId: number;
  printing: string;
}

const SLUG = /^[a-z0-9-]{1,40}$/;
const PRINTING = /^[A-Za-z0-9 .-]{1,30}$/;

export const isCardId = (id: string) => id.startsWith(CARD_PREFIX);

export function cardId(r: CardRef): string | null {
  if (!SLUG.test(r.game) || !SLUG.test(r.set) || !Number.isInteger(r.tcgId) || r.tcgId <= 0 || !PRINTING.test(r.printing)) return null;
  const id = `${CARD_PREFIX}${r.game}:${r.set}:${r.tcgId}:${r.printing.replace(/ /g, "_")}`;
  return /^[A-Za-z0-9_.:-]{1,80}$/.test(id) ? id : null;
}

export function parseCardId(id: string): CardRef | null {
  if (!isCardId(id)) return null;
  const [, game, set, tcg, printing] = id.split(":");
  const tcgId = Number(tcg);
  if (!game || !set || !printing || !SLUG.test(game) || !SLUG.test(set) || !Number.isInteger(tcgId) || tcgId <= 0) return null;
  return { game, set, tcgId, printing: printing.replace(/_/g, " ") };
}

export const cardImage = (tcgId: number) => `https://tcgplayer-cdn.tcgplayer.com/product/${tcgId}_200w.jpg`;
export const tcgplayerProductUrl = (tcgId: number) => `https://www.tcgplayer.com/product/${tcgId}`;

/** What the open API sends for one set. */
export interface OpenCard {
  id: number;
  s: string;
  n: string;
  no: string;
  r: string | null;
  p: Record<string, number>;
}
export interface OpenSetFile {
  game: string;
  set: { slug: string; name: string; abbr: string | null; released: string | null; cards: number };
  cards: OpenCard[];
}
export interface OpenSetsFile {
  game: string;
  sets: { slug: string; name: string; abbr: string | null; released: string | null; cards: number }[];
}
export interface OpenHit {
  game: string;
  set: string;
  setName: string;
  s: string;
  n: string;
  no: string;
  v: number;
  id: number;
  img: string;
}

/** The sets a collection's cards live in, most valuable holdings first, capped. "game/set" keys. */
export function setsToFetch(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const r = parseCardId(id);
    if (!r) continue;
    const k = `${r.game}/${r.set}`;
    if (!out.includes(k)) out.push(k);
    if (out.length >= MAX_SETS) break;
  }
  return out;
}

/** Today's price per card item id (US cents), from the fetched set files; a card or printing with no price is absent. */
export function cardPriceMap(ids: readonly string[], sets: Record<string, OpenSetFile | null | undefined>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const r = parseCardId(id);
    const file = r ? sets[`${r.game}/${r.set}`] : null;
    const c = file?.cards.find((x) => x.id === r!.tcgId);
    const cents = c?.p?.[r!.printing];
    if (typeof cents === "number" && cents > 0) out[id] = cents;
  }
  return out;
}

/** A card's printings, priced ones first, the dearest first; a card with none still offers "Normal". */
export function printingsOf(c: Pick<OpenCard, "p">): { name: string; cents: number | null }[] {
  const list = Object.entries(c.p ?? {})
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, cents]) => ({ name, cents }));
  return list.length ? list : [{ name: "Normal", cents: null }];
}

/** Singles DB keeps one history per card: its dearest printing's. A card joins the value chart only when held in that printing. */
export function historyEligible(id: string, sets: Record<string, OpenSetFile | null | undefined>): boolean {
  const r = parseCardId(id);
  const c = r ? sets[`${r.game}/${r.set}`]?.cards.find((x) => x.id === r.tcgId) : null;
  if (!c) return false;
  const ps = printingsOf(c);
  return ps[0].cents != null && ps[0].name === r!.printing;
}

/** A Singles DB history series (day numbers since 2026-01-01) as this site's series (days since 1970). */
export const toUnixSeries = (pts: readonly [number, number][]): [number, number][] => pts.map(([d, c]) => [d + EPOCH_DAY, c]);

/** The display name of a card item: "Charizard · Base Set 004/102 · Holofoil". */
export function cardLabel(name: string, setName: string, no: string, printing: string): string {
  return [name, [setName, no].filter(Boolean).join(" "), printing === "Normal" ? "" : printing].filter(Boolean).join(" · ").slice(0, 200);
}

// ─── Spreadsheet import ───────────────────────────────────────────────────────────────────────────────────────────────

export interface ImportRow {
  line: number;
  name: string;
  set: string;
  number: string;
  qty: number;
  printing: string;
  /** what the member paid per card, US cents (0 = not given) */
  paidCents: number;
  game: string;
  graded: boolean;
  sealed: boolean;
}

/** RFC 4180-ish: quoted cells, doubled quotes, commas or semicolons or tabs, CRLF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const first = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Header names seen in collection exports, matched after norm(). First hit wins, in this order.
const HEADERS: Record<keyof Omit<ImportRow, "line" | "graded" | "sealed"> | "grade" | "type", string[]> = {
  name: ["product name", "card name", "name", "card", "title", "product"],
  set: ["set name", "set", "expansion", "edition name", "group", "series"],
  number: ["card number", "collector number", "number", "no", "card no", "card"],
  qty: ["quantity", "qty", "count", "amount", "copies", "total quantity"],
  printing: ["printing", "variance", "variant", "finish", "foil", "print"],
  paidCents: ["average cost paid", "price paid", "purchase price", "cost", "paid", "buy price", "acquired price", "cost basis"],
  game: ["category", "game", "tcg"],
  grade: ["grade", "grading company", "graded", "slab", "grader"],
  type: ["product type", "type", "item type"],
};

/** Which column holds what. A column is used once; a header nobody knows is ignored. */
export function mapHeaders(header: readonly string[]): Partial<Record<keyof typeof HEADERS, number>> {
  const h = header.map(norm);
  const used = new Set<number>();
  const out: Partial<Record<keyof typeof HEADERS, number>> = {};
  for (const key of Object.keys(HEADERS) as (keyof typeof HEADERS)[]) {
    for (const want of HEADERS[key]) {
      const at = h.findIndex((x, i) => !used.has(i) && x === want);
      if (at >= 0) {
        out[key] = at;
        used.add(at);
        break;
      }
    }
  }
  return out;
}

export function parseMoney(s: string): number {
  const t = s.replace(/[^0-9.,-]/g, "");
  if (!t) return 0;
  // 1.234,56 or 1,234.56 or 12,50
  const dec = /,\d{1,2}$/.test(t) && !/\.\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  const v = Number(dec);
  return Number.isFinite(v) && v > 0 && v < 1e7 ? Math.round(v * 100) : 0;
}

const GRADED = /\b(psa|bgs|cgc|sgc|beckett|tag|ace)\s*\d|\bgraded\b|\bslab\b/i;
const SEALED = /\b(booster (box|pack|bundle|display)|elite trainer|etb|collection box|tin|blister|bundle|case|display|sealed|starter deck|build and battle|premium collection|upc)\b/i;

/** The spreadsheet's rows, read. `fallbackGame` is the game the member picked for rows that don't name one. */
export function readImport(text: string, fallbackGame: string): { rows: ImportRow[]; columns: string[]; missing: string[] } {
  const all = parseCsv(text.slice(0, 2_000_000));
  if (all.length < 2) return { rows: [], columns: all[0] ?? [], missing: ["a header row and at least one item"] };
  const cols = mapHeaders(all[0]);
  const missing = cols.name == null ? ["a name column"] : [];
  if (cols.set == null) missing.push("a set column");
  const cell = (r: string[], k: keyof typeof cols) => (cols[k] == null ? "" : (r[cols[k]!] ?? "").trim());
  const rows: ImportRow[] = [];
  for (let i = 1; i < all.length && rows.length < 2000; i++) {
    const r = all[i];
    const name = cell(r, "name");
    if (!name) continue;
    const qtyRaw = cell(r, "qty");
    const qty = qtyRaw ? Math.floor(Number(qtyRaw.replace(/[^0-9.]/g, ""))) : 1;
    if (!(qty > 0)) continue;
    const grade = cell(r, "grade");
    const type = cell(r, "type");
    const gameCell = norm(cell(r, "game"));
    const game = CARD_GAMES.find((g) => norm(g.name) === gameCell || g.slug.replace(/-/g, " ") === gameCell)?.slug ?? (gameCell.startsWith("pokemon") ? (/japan/.test(gameCell) ? "pokemon-japan" : "pokemon") : fallbackGame);
    rows.push({
      line: i + 1,
      name,
      set: cell(r, "set"),
      number: cell(r, "number"),
      qty: Math.min(99, qty),
      printing: cell(r, "printing"),
      paidCents: parseMoney(cell(r, "paidCents")),
      game,
      graded: (!!grade && !/^(no|none|raw|ungraded|n\/?a|0|false)$/i.test(grade)) || GRADED.test(name),
      sealed: /sealed|product/i.test(type) && !/single|card/i.test(type) ? true : !cell(r, "number") && SEALED.test(name),
    });
  }
  return { rows, columns: all[0], missing };
}

/** "SV03: Obsidian Flames" and "Obsidian Flames" read the same; so do "Base Set" and "base set". */
export function setKeys(name: string): string[] {
  const full = norm(name);
  const stripped = norm(name.replace(/^[A-Za-z]{1,5}\s?\d{0,3}[a-z]?\s*[:\-–]\s*/, ""));
  return [...new Set([full, stripped].filter(Boolean))];
}

/** The one set a spreadsheet's set name means, or null when none or more than one fits. */
export function matchSet(name: string, sets: OpenSetsFile["sets"]): string | null {
  if (!name.trim()) return null;
  const want = setKeys(name);
  const exact = sets.filter((s) => setKeys(s.name).some((k) => want.includes(k)) || (s.abbr && norm(s.abbr) === norm(name)));
  return exact.length === 1 ? exact[0].slug : null;
}

/** "4", "004", "4/102", "#004/102" → "4/102"-style key for comparing; letters kept ("TG05", "SV-P 012"). */
export function numberKey(no: string): string {
  const t = no.trim().replace(/^#/, "").toUpperCase();
  const [left, right] = t.split("/");
  const side = (s: string) => s.replace(/\s+/g, "").replace(/(^|[^0-9])0+(?=\d)/g, "$1");
  return right != null ? `${side(left)}/${side(right)}` : side(left);
}
const numberLeft = (no: string) => numberKey(no).split("/")[0];

const baseName = (s: string) => norm(s.replace(/\(.*?\)|\[.*?\]/g, " ").replace(/\s[-–]\s.*$/, ""));

/** Do the sheet's name and the card's name agree? The card's own name (before any "(…)" or " - …") must appear in the sheet's. */
export function namesAgree(sheet: string, card: string): boolean {
  const a = ` ${norm(sheet)} `;
  const b = baseName(card);
  return !!b && a.includes(` ${b} `);
}

export type ImportMatch =
  | { kind: "card"; row: ImportRow; card: OpenCard; set: string; setName: string; printing: string; assumed: boolean }
  | { kind: "miss"; row: ImportRow; why: string };

/** One row against its set's cards. */
export function matchRow(row: ImportRow, set: OpenSetFile | null): ImportMatch {
  if (row.graded) return { kind: "miss", row, why: "graded (no graded prices yet)" };
  if (row.sealed) return { kind: "miss", row, why: "sealed: add it with the product search above" };
  if (!set) return { kind: "miss", row, why: row.set ? `set "${row.set}" not found` : "no set given" };
  let found: OpenCard[];
  if (row.number) {
    const k = numberKey(row.number);
    found = set.cards.filter((c) => c.no && (numberKey(c.no) === k || (!k.includes("/") && numberLeft(c.no) === k)));
    found = found.filter((c) => namesAgree(row.name, c.n));
    // "Charizard" and "Charizard (Black Dot Error)" share 4/102: a qualifier in brackets must be in the sheet's name to count,
    // and the card whose qualifiers the sheet names most fully wins; still two at the top is no match.
    if (found.length > 1) {
      const sheet = ` ${norm(row.name)} `;
      const scored = found
        .map((c) => {
          const q = (c.n.match(/\((.*?)\)|\[(.*?)\]/g) ?? []).map((x) => norm(x)).filter(Boolean);
          return { c, ok: q.every((w) => sheet.includes(` ${w} `)), n: q.length };
        })
        .filter((x) => x.ok);
      const top = Math.max(-1, ...scored.map((x) => x.n));
      found = scored.filter((x) => x.n === top).map((x) => x.c);
    }
  } else {
    found = set.cards.filter((c) => baseName(c.n) === baseName(row.name));
  }
  if (found.length !== 1) return { kind: "miss", row, why: found.length ? "more than one card fits" : "card not found in that set" };
  const card = found[0];
  const ps = printingsOf(card);
  const asked = norm(row.printing);
  let printing: string | undefined;
  let assumed = false;
  if (asked) {
    printing = ps.find((p) => norm(p.name) === asked)?.name ?? (/^(non )?foil$|^holo$/.test(asked) ? ps.find((p) => norm(p.name) === (asked.startsWith("non") ? "normal" : "holofoil"))?.name : undefined);
    if (!printing) return { kind: "miss", row, why: `no "${row.printing}" printing of this card` };
  } else if (ps.length === 1) printing = ps[0].name;
  else {
    printing = ps.find((p) => p.name === "Normal")?.name ?? ps[ps.length - 1].name;
    assumed = true;
  }
  return { kind: "card", row, card, set: set.set.slug, setName: set.set.name, printing, assumed };
}
