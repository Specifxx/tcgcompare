// Products that had a page and lost it (the sealed focus, a TCGplayer group past the age window, TCGCSV no longer
// listing it): the import writes data/public/culled.json so the old URL 301s instead of a 404. Each entry is the
// product slug -> its set slug (the original format) or { set, line } (since 2026-11-14), so a product whose set is
// gone too still reaches its game's hub. Both formats are read (lib/import/continuity.ts culledTarget). A product
// that gets its page back leaves the file and keeps its URL.
import fs from "node:fs";
import path from "node:path";
import { culledTarget, type CulledMap } from "@/lib/import/continuity";

let map: CulledMap | null = null;

export function culledEntry(slug: string): { set: string; line: string | null } | null {
  if (!map) {
    try {
      map = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "public", "culled.json"), "utf8")) as CulledMap;
    } catch {
      map = {};
    }
  }
  return Object.prototype.hasOwnProperty.call(map, slug) ? culledTarget(map[slug]) : null;
}

/** Where a culled product's URL goes: its set while it has a page, else its game's hub, else the set's game hub. */
export function culledRedirect(
  e: { set: string; line: string | null },
  hasSetPage: (setSlug: string) => boolean,
  hubOfLine: (lineId: string) => string | null,
  hubOfSet: (setSlug: string) => string,
): string {
  if (hasSetPage(e.set)) return `/sets/${e.set}`;
  return (e.line ? hubOfLine(e.line) : null) ?? hubOfSet(e.set);
}
