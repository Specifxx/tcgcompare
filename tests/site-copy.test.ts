import { test } from "node:test";
import assert from "node:assert/strict";
import { gameList, gamesDescription, homeDescription } from "../src/lib/site-copy";

test("/games and home copy reads correctly for many games, never 'compares: trading card game.'", () => {
  const names = Array.from({ length: 31 }, (_, i) => (i === 0 ? "Magic" : i === 1 ? "Pokémon" : i === 2 ? "One Piece" : `Game ${i}`));
  assert.equal(gameList(names), "Magic, Pokémon, One Piece and 28 more");
  assert.equal(gameList(["Magic", "Pokémon"]), "Magic and Pokémon");
  assert.equal(gameList(["Magic"]), "Magic");
  const g = gamesDescription(names, "Pick one.");
  assert.match(g, /^Sealed prices for 31 trading card games: Magic, Pokémon, One Piece and 28 more\. Pick one\.$/);
  const h = homeDescription(names, 120);
  assert.doesNotMatch(h, /structure deck|trading card game booster box/);
  assert.match(h, /Magic, Pokémon, One Piece and 28 more across TCGplayer, eBay and 120 online stores/);
  assert.ok(h.length <= 200, `${h.length} chars`);
});

test("the pages use it, not SITE.game", async () => {
  const { readFileSync } = await import("node:fs");
  const games = readFileSync("src/app/games/page.tsx", "utf8");
  assert.match(games, /gamesDescription\(/);
  assert.doesNotMatch(games, /compares: \$\{SITE\.game\}/);
  assert.match(readFileSync("src/app/page.tsx", "utf8"), /homeDescription\(/);
});
