import { test } from "node:test";
import assert from "node:assert/strict";
import { heroGames, HUB_FLOOR } from "../src/lib/hero-games";

const g = (slug: string) => ({ line: { slug } });
const LINES = ["magic-the-gathering", "pokemon", "one-piece", "yugioh", "riftbound", "flesh-and-blood", "star-wars-unlimited"].map(g);
const slugs = (xs: { line: { slug: string } }[]) => xs.map((x) => x.line.slug);

test("no demand keeps site.config's order", () => {
  assert.deepEqual(slugs(heroGames(LINES, null, 5, true)), slugs(LINES.slice(0, 5)));
});

test("a hub with HUB_FLOOR+ views in 7 days leads; below the floor nothing moves", () => {
  const d = { views: { "/games/star-wars-unlimited": [106, 106] as [number, number], "/games/flesh-and-blood": [18, 18] as [number, number] } };
  assert.deepEqual(slugs(heroGames(LINES, d, 5, true)), ["star-wars-unlimited", "magic-the-gathering", "pokemon", "one-piece", "yugioh"]);
  const low = { views: { "/games/star-wars-unlimited": [500, HUB_FLOOR - 1] as [number, number] } };
  assert.deepEqual(slugs(heroGames(LINES, low, 5, true)), slugs(LINES.slice(0, 5)), "the 7-day count decides, not 28 days");
});

test("several over the floor: most viewed first, still five, no repeats", () => {
  const d = { views: { "/games/flesh-and-blood": [40, 40] as [number, number], "/games/star-wars-unlimited": [90, 90] as [number, number], "/games/pokemon": [60, 60] as [number, number] } };
  assert.deepEqual(slugs(heroGames(LINES, d, 5, true)), ["star-wars-unlimited", "pokemon", "flesh-and-blood", "magic-the-gathering", "one-piece"]);
});

test("the off switch keeps the fixed order", () => {
  const d = { views: { "/games/star-wars-unlimited": [106, 106] as [number, number] } };
  assert.deepEqual(slugs(heroGames(LINES, d, 5, false)), slugs(LINES.slice(0, 5)));
});
