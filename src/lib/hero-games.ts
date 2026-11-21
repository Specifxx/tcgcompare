// The home hero's five game ways in, by what visitors open (merch backlog M12, 2026-11-21). The hero stays words, the search and
// links (never a product); this only decides WHICH five game hubs it links. A game whose hub (/games/<slug>) drew HUB_FLOOR or more
// views in the last 7 days (data/demand.json) moves ahead, most viewed first; the rest keep site.config's LINES order (the biggest
// markets first). The floor stops one stray visit from reshuffling the hero; the off switch is home-rank's (NEXT_PUBLIC_HOME_RANK=off).
import { homeRankOn, type DemandFile } from "./home-rank";

export const HUB_FLOOR = 30;

export function heroGames<T extends { line: { slug: string } }>(
  games: readonly T[],
  demand: DemandFile | null | undefined,
  n = 5,
  enabled = homeRankOn(),
): T[] {
  if (!enabled || !demand?.views) return games.slice(0, n);
  const week = (g: T) => demand.views?.[`/games/${g.line.slug}`]?.[1] ?? 0;
  const lead = games
    .map((g, i) => ({ g, i, w: week(g) }))
    .filter((x) => x.w >= HUB_FLOOR)
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .map((x) => x.g);
  return [...lead, ...games.filter((g) => !lead.includes(g))].slice(0, n);
}
