// Per-game views of the catalogue for multi-game sites (SITE.lines): the
// /games hubs and the homepage's game tiles. Empty on single-game sites.
import type { GameLine, Product, SetInfo } from "@/lib/site-types";
import { byValue, products, refCents, setById, sets, summaryOf } from "@/lib/data";
import { shortName } from "@/lib/names";
import type { HubItem } from "@/lib/hub-snippet";
import { LINES } from "@/lib/lines";
import { SEALED_ORDER, SEALED_PLURAL } from "@/lib/hubs";
import { slugify } from "@/lib/slug";

/** A product as the hub snippets read it (lib/hub-snippet.ts): its name, type, release, TCGplayer market and best offers. */
export function hubItem(p: Product): HubItem {
  const s = setById(p.setId);
  return { name: shortName(p.name), sealedType: p.sealedType, releasedOn: s?.releasedOn ?? null, upcoming: !!s?.upcoming, tcgCents: refCents(p.id), best: summaryOf(p.id).best };
}

/** Every sealed product of a game (never an insert), for its hub's snippet. */
export function gameSealed(line: GameLine): Product[] {
  const ids = new Set(sets().filter((s) => s.line === line.id && s.productCount > 0).map((s) => s.id));
  return products().filter((p) => p.kind === "sealed" && p.sealedType !== "Insert" && ids.has(p.setId));
}

export interface GameView {
  line: GameLine;
  sets: SetInfo[];
  sealed: number;
  newest: SetInfo | null;
  /** The game's most valuable sealed products with a photo (the homepage tile's fan). */
  topSealed: Product[];
  boxes: Product[];
  /** Starter decks and decks, newest set first. */
  decks: Product[];
}

const memo = new Map<string, GameView>();
export function gameView(line: GameLine): GameView {
  const hit = memo.get(line.id);
  if (hit) return hit;
  const own = sets().filter((s) => s.line === line.id && s.productCount > 0);
  const ids = new Set(own.map((s) => s.id));
  const mine = products().filter((p) => ids.has(p.setId));
  const released = (p: Product) => { const s = setById(p.setId); return s && !s.upcoming ? s.releasedOn ?? "" : null; };
  const boxes = mine
    .filter((p) => p.kind === "sealed" && p.sealedType === "Booster Box" && released(p) !== null && refCents(p.id) != null)
    .sort((a, b) => released(b)!.localeCompare(released(a)!) || (refCents(b.id) ?? 0) - (refCents(a.id) ?? 0));
  const sealed = mine.filter((p) => p.kind === "sealed" && p.sealedType !== "Insert");
  const decks = sealed
    .filter((p) => /deck/i.test(p.sealedType ?? "") && released(p) !== null)
    .sort((a, b) => released(b)!.localeCompare(released(a)!));
  const view: GameView = {
    line,
    sets: own,
    sealed: sealed.length,
    newest: own.find((s) => !s.upcoming && sealed.some((p) => p.setId === s.id && p.sealedType === "Booster Box")) ?? own.find((s) => !s.upcoming) ?? null,
    topSealed: byValue(sealed.filter((p) => p.image && (p.sealedType === "Booster Box" || p.sealedType === "Case"))).slice(0, 12),
    boxes: boxes.slice(0, 12),
    decks: decks.slice(0, 12),
  };
  memo.set(line.id, view);
  return view;
}

/** Every game with a product today, in SITE.lines order (the biggest markets first). */
export const gameViews = (): GameView[] => LINES.map(gameView).filter((v) => v.sealed > 0);

// One game's sealed products by product type (/games/<game>/<type>): a Fusion World player never wades through Union Arena or
// Digimon boxes (owner, 2026-11-09). A hub exists for any type the game has products in; it is indexed, listed in the sitemap and
// linked from a menu only with GAME_TYPE_MIN products (a thin one is noindex).
export const GAME_TYPE_MIN = 3;
export interface GameTypeHub { slug: string; label: string; type: string; items: Product[] }

const typeMemo = new Map<string, GameTypeHub[]>();
export function gameTypeHubs(line: GameLine): GameTypeHub[] {
  const hit = typeMemo.get(line.id);
  if (hit) return hit;
  const ids = new Set(sets().filter((s) => s.line === line.id).map((s) => s.id));
  const sealed = products().filter((p) => p.kind === "sealed" && ids.has(p.setId));
  const hubs = SEALED_ORDER.filter((t) => t !== "Other" && t !== "Insert")
    .map((t) => ({ slug: slugify(t), label: SEALED_PLURAL[t] ?? t, type: t, items: byValue(sealed.filter((p) => p.sealedType === t)) }))
    .filter((h) => h.items.length);
  typeMemo.set(line.id, hubs);
  return hubs;
}
export const gameTypeHub = (line: GameLine, slug: string) => gameTypeHubs(line).find((h) => h.slug === slug) ?? null;
