import Link from "@/components/Link";
import { gameViews } from "@/lib/game-hubs";
import { heroGames } from "@/lib/hero-games";
import { HOME_DEMAND } from "@/lib/home-demand";

/**
 * The game bar under the header, the way a card shop's site is laid out (owner, 2026-11-28: "it should look more like a store,
 * similar to how TCG Player structures their homepage"): one dark row of the games people shop most, then every game. From md up
 * only: on a phone the header's menu and the home page's game tiles do this job, and the phone's top stays one row. Links only,
 * server HTML, no script; it never holds an ad or a sale.
 */
export function GameBar({ chips = false }: { chips?: boolean }) {
  const views = gameViews();
  if (views.length < 2) return null;
  const top = heroGames(views, HOME_DEMAND, 8);
  // The home page's phone row (below md, where the bar is hidden): the same games as one sideways row of chips under the hero.
  if (chips)
    return (
      <nav aria-label="Shop by game" className="game-chips md:hidden">
        {top.map((v) => (
          <Link key={v.line.id} href={`/games/${v.line.slug}`} className="game-chip">
            <span className="game-chip-dot" style={{ background: v.line.color }} aria-hidden="true" />
            {v.line.short}
          </Link>
        ))}
        <Link href="/games" className="game-chip">
          All games →
        </Link>
      </nav>
    );
  return (
    <nav aria-label="Shop by game" className="game-bar hidden md:block">
      <ul className="game-bar-in">
        {top.map((v) => (
          <li key={v.line.id}>
            <Link href={`/games/${v.line.slug}`} className="game-bar-link">
              {v.line.short}
            </Link>
          </li>
        ))}
        <li className="ml-auto">
          <Link href="/games" className="game-bar-link game-bar-all">
            All {views.length} games <span aria-hidden="true">→</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
