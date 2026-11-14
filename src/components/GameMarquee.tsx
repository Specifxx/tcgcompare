import Link from "@/components/Link";
import { gameViews } from "@/lib/game-hubs";

/**
 * Every game with a product today, drifting past in one line under the hero (globals.css .neo-marquee). Real links in the
 * server's HTML; the second copy that makes the loop seamless is hidden from screen readers and the tab order, and pauses
 * under the pointer or the keyboard.
 */
export function GameMarquee() {
  const views = gameViews();
  if (views.length < 6) return null;
  const chips = (hidden: boolean) =>
    views.map((v) => (
      <Link key={`${v.line.id}${hidden ? "-b" : ""}`} href={`/games/${v.line.slug}`} className="neo-chip" style={{ ["--game" as string]: v.line.color }} tabIndex={hidden ? -1 : undefined} aria-hidden={hidden || undefined}>
        <i aria-hidden="true" />
        {v.line.short}
      </Link>
    ));
  return (
    <nav className="neo-marquee" aria-label="Every game we compare">
      <div className="neo-track">
        {chips(false)}
        {chips(true)}
      </div>
    </nav>
  );
}
