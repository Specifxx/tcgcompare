// Whether an Amazon search result is THIS sealed product (scripts/amazon-asins.ts). Pure, so tests/amazon-api.test.ts
// can pin it against real titles. Script-side only: no page reads it.
//
// The store matcher (match.ts matchSealed) was written for one game a site. Here one catalogue holds 31 games, so an
// Amazon title is held to more, and refused rather than guessed (a wrong match is worse than none):
//   1. It must name the product's own game (GameLine.amazon in site.config.ts) and no other game.
//   2. It is matched only against that game's products, with "ME06: " style codes taken off the set names
//      (IndexOptions.stripSetCodes; the code still counts as a code).
//   3. It must not be a different kind of product the store matcher reads as the same type: a "Double Pack Set" is
//      not the booster pack, a "Release Event" or "Welcome" pack is not the starter deck, an empty box is no box.
import type { GameLine, Product, SetInfo } from "@/lib/site-types";
import { tokens } from "@/lib/slug";
import { buildIndex, isForeign, kindAgrees, matchSealed, splitSetCode, type IndexOptions, type MatchIndex, type NumberStyle } from "./match";

export { kindAgrees };

const fold = (s: string) => tokens(s.replace(/ß/g, "ss").replace(/ẞ/g, "SS"));

const has = (have: Set<string>, phrase: string) => {
  const need = fold(phrase);
  return need.length > 0 && need.every((t) => have.has(t));
};

/** Does a title (as folded tokens) name this game? */
export function namesGame(have: Set<string>, line: GameLine): boolean {
  if (!line.amazon) return false;
  return line.amazon.any.some((p) => has(have, p)) && !(line.amazon.not ?? []).some((p) => has(have, p));
}

/** The games an Amazon title names. */
export function gamesNamed(title: string, lines: GameLine[]): GameLine[] {
  const have = new Set(fold(title));
  return lines.filter((l) => namesGame(have, l));
}

export interface AmazonMatcher {
  /** The one product this Amazon title is, or null. */
  find(title: string): Product | null;
  /** Whether this Amazon title is this product and no other. */
  matches(p: Pick<Product, "id">, title: string): boolean;
  /** Whether searching for it can ever find a match (a game whose titles the matcher always refuses, or a product
   *  whose own name is foreign, is a wasted search). */
  searchable(p: Pick<Product, "setId" | "name">): boolean;
  /** The words searchItems is asked for: the game, the set name (without its code) unless the product name has it,
   *  the product name. */
  keywords(p: Pick<Product, "setId" | "name">): string;
}

export function amazonMatcher(products: Product[], sets: SetInfo[], lines: GameLine[], style: NumberStyle, opts: IndexOptions = {}): AmazonMatcher {
  const setById = new Map(sets.map((s) => [s.id, s]));
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const lineOf = (setId: number) => {
    const id = setById.get(setId)?.line;
    return id ? lineById.get(id) ?? null : null;
  };
  // One index a game, so a title is only ever read against its own game's products.
  const byLine = new Map<string, { products: Product[]; sets: SetInfo[] }>();
  for (const s of sets) {
    const k = s.line ?? "";
    if (!byLine.has(k)) byLine.set(k, { products: [], sets: [] });
    byLine.get(k)!.sets.push(s);
  }
  for (const p of products) byLine.get(setById.get(p.setId)?.line ?? "")?.products.push(p);
  const indexes = new Map<string, MatchIndex>();
  for (const [k, v] of byLine) indexes.set(k, buildIndex(v.products, v.sets, style, { ...opts, stripSetCodes: true }));
  const multi = lines.length > 0;

  const find = (title: string): Product | null => {
    let key = "";
    if (multi) {
      const named = gamesNamed(title, lines);
      if (named.length !== 1) return null;
      key = named[0].id;
    }
    const idx = indexes.get(key);
    if (!idx) return null;
    // Products of another kind are out before the store matcher chooses, so a Double Pack Set's title can still find
    // the Double Pack Set rather than lose to the plain pack and match nothing.
    return matchSealed(title, { ...idx, sealed: idx.sealed.filter((p) => kindAgrees(title, p.name)) })?.product ?? null;
  };

  return {
    find,
    matches: (p, title) => find(title)?.id === p.id,
    searchable(p) {
      if (isForeign(p.name)) return false;
      if (!multi) return true;
      const line = lineOf(p.setId);
      return !!line?.amazon && line.amazon.any.some((ph) => !isForeign(ph));
    },
    keywords(p) {
      const set = setById.get(p.setId);
      const line = multi ? lineOf(p.setId) : null;
      const setName = set ? splitSetCode(set.name).name : "";
      const own = new Set(fold(p.name));
      const parts = [
        line && !namesGame(own, line) ? line.name : "",
        setName && !fold(setName).every((t) => own.has(t)) ? setName : "",
        p.name,
      ];
      return parts.join(" ").replace(/\s+/g, " ").trim();
    },
  };
}
