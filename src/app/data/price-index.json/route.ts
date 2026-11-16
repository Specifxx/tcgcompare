import { meta } from "@/lib/data";
import { credit, INDEX_MIN_PRODUCTS, loadIndex } from "@/lib/open-data";
import { lineBySlug } from "@/lib/lines";

// The Sealed Price Index as JSON (lib/open-data.ts): the all-games line and each game with enough products, one point a
// day. A file built with the deploy, open to every origin.
export const dynamic = "force-static";

export function GET() {
  const f = loadIndex();
  const slugs = new Set<string>();
  for (const d of f?.days ?? []) for (const [g, p] of Object.entries(d.games)) if (p.n >= INDEX_MIN_PRODUCTS) slugs.add(g);
  const games = [...slugs].sort().map((g) => ({ slug: g, name: lineBySlug(g)?.name ?? g }));
  const body = {
    version: 1,
    ...credit(),
    generatedAt: meta()?.updatedAt ?? null,
    base: f?.base ?? null,
    method: f?.note ?? null,
    games,
    days: (f?.days ?? []).map((d) => ({ date: d.d, all: d.all, games: Object.fromEntries(Object.entries(d.games).filter(([g]) => slugs.has(g))) })),
  };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, s-maxage=86400", "Access-Control-Allow-Origin": "*" } });
}
