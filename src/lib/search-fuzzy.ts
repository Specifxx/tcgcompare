// Typo-tolerant search (owner, 2026-11-23 UX review, P0 5: "charizard" returned 15 results, "charizrd" none; "Add fuzzy
// matching, synonyms (ETB, UPC, BB) and a 'did you mean' fallback showing popular products instead of a dead end"). Pure:
// /api/search runs the exact search first, and only when it finds nothing asks suggestQuery for the nearest catalogue words.

/** Shorthand buyers type, expanded before the search (each side is matched as whole words). */
export const SYNONYMS: Record<string, string> = {
  etb: "elite trainer box",
  etbs: "elite trainer box",
  upc: "ultra premium collection",
  bb: "booster box",
  bbs: "booster box",
  bx: "booster box",
  pcetb: "pokemon center elite trainer box",
  spc: "super premium collection",
  sb: "starter deck",
  boxes: "box",
  packs: "pack",
  decks: "deck",
  tins: "tin",
  bundles: "bundle",
  cases: "case",
  displays: "display",
  pokémon: "pokemon",
  mtg: "magic",
  ygo: "yugioh",
  "yu-gi-oh": "yugioh",
  op: "one piece",
};

/** The words of a query with shorthand expanded ("charizard etb" → charizard elite trainer box). Pure. */
export function expandWords(words: readonly string[]): string[] {
  return words.flatMap((w) => (SYNONYMS[w] ? SYNONYMS[w].split(" ") : [w]));
}

/** Edit distance with a ceiling (insert, delete, change, or swap two neighbours counts once); max + 1 once over it. Pure. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      best = Math.min(best, d[i][j]);
    }
    if (best > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Edits a word may be off by: none under 4 letters (set codes, numbers), one for 4-6, two for 7 and more. */
export const allowedEdits = (w: string): number => (/\d/.test(w) ? 0 : w.length >= 7 ? 2 : w.length >= 4 ? 1 : 0);

/**
 * "Did you mean": each word that matches nothing (`matches(w)` false) swapped for the closest word of `vocab` (fewest edits, a
 * prefix of a longer word counts, then the word on the most products), or null when every word already matches or one has no
 * close match. Pure.
 */
export function suggestQuery(words: readonly string[], vocab: ReadonlyMap<string, number>, matches: (w: string) => boolean): string | null {
  if (!words.length) return null;
  let changed = false;
  const out: string[] = [];
  for (const w of words) {
    if (matches(w)) {
      out.push(w);
      continue;
    }
    const max = allowedEdits(w);
    if (!max) return null;
    let pick: string | null = null;
    let pickD = max + 1;
    for (const [t, n] of vocab) {
      if (Math.abs(t.length - w.length) > max && t.length < w.length) continue;
      const d = Math.min(editDistance(w, t, max), t.length > w.length ? editDistance(w, t.slice(0, w.length), max) : max + 1);
      if (d < pickD || (d === pickD && pick != null && n > (vocab.get(pick) ?? 0))) {
        pick = t;
        pickD = d;
      }
    }
    if (!pick || pickD > max) return null;
    out.push(pick);
    changed = true;
  }
  return changed ? out.join(" ") : null;
}
