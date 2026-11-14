// Page copy that names the games (2026-11-14). This site compares ~30 games, so a sentence built from SITE.game (one phrase,
// "trading card game") or from one game's product words ("structure deck") reads wrongly; these take the names of the games
// with product today, biggest first, and stay generic about product types. Pure, so tests/site-copy.test.ts can pin them.

/** "Magic, Pokémon, One Piece and 27 more" (the first `shown` names, then the rest as a count). */
export function gameList(names: string[], shown = 3): string {
  if (names.length <= shown) return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
  return `${names.slice(0, shown).join(", ")} and ${names.length - shown} more`;
}

/** The /games description. */
export function gamesDescription(names: string[], tail: string): string {
  if (!names.length) return `Every trading card game we compare. ${tail}`;
  return `Sealed prices for ${names.length} trading card game${names.length === 1 ? "" : "s"}: ${gameList(names)}. ${tail}`;
}

/** The home page description. */
export function homeDescription(names: string[], stores: number): string {
  const games = names.length ? `${gameList(names)}` : "every trading card game";
  return `Compare booster box, case, pack, deck and pre-order prices for ${games} across TCGplayer, eBay and ${stores} online stores. Cheapest in-stock first, in your currency.`;
}
