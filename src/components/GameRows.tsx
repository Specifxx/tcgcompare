import Link from "@/components/Link";
import { GAME_TYPE_MIN, gameTypeHubs, gameViews } from "@/lib/game-hubs";

/**
 * The homepage's game picker since 2026-11-10 (the cost-cut redesign: bare-bones, more exploring): one plain row per game with
 * its product-type hubs as links, so a visitor is one tap from "Fusion World booster boxes" instead of scrolling past three
 * illustrated panels. Server HTML, no images.
 */
export function GameRows() {
  const views = gameViews();
  if (!views.length) return null;
  return (
    <section aria-labelledby="games-h">
      <h2 id="games-h" className="mb-3 text-xl font-bold">Pick your game</h2>
      <ul className="card grid grid-cols-2 overflow-hidden sm:block sm:divide-y sm:divide-line">
        {views.map((v) => {
          const hubs = gameTypeHubs(v.line).filter((h) => h.items.length >= GAME_TYPE_MIN).slice(0, 5);
          return (
            // On a phone (2026-11-19, owner: too much going on) the games are two columns, each its name and how many products; the
            // product-type chips and the newest set show from sm up, and the game's page lists every type.
            <li key={v.line.id} className="flex min-w-0 flex-col gap-2 border-b border-line px-3 py-3 odd:border-r sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:p-4">
              <div className="min-w-0">
                <Link href={`/games/${v.line.slug}`} className="text-sm font-semibold hover:text-brand sm:text-base">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: v.line.color }} aria-hidden="true" />
                  {v.line.name} →
                </Link>
                <p className="text-xs text-muted">
                  {v.sealed.toLocaleString()} sealed products<span className="hidden sm:inline"> · {v.sets.length} sets{v.newest ? ` · newest: ${v.newest.name}` : ""}</span>
                </p>
              </div>
              {hubs.length > 0 && (
                <p className="hidden flex-wrap gap-1.5 sm:flex">
                  {hubs.map((h) => (
                    <Link key={h.slug} href={`/games/${v.line.slug}/${h.slug}`} className="chip text-xs">
                      {h.label}
                    </Link>
                  ))}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
