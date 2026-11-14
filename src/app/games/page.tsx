import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE } from "@/site.config";
import { canon } from "@/lib/site";
import { fitTitle } from "@/lib/seo-title";
import { GameTiles } from "@/components/GameTiles";
import { isMultiGame } from "@/lib/lines";
import { gameViews } from "@/lib/game-hubs";
import { gamesDescription } from "@/lib/site-copy";

export const revalidate = 86400;
// Written for many games (the copy came from BandaiCompare, whose SITE.game was its list of three): the number of games
// with product today and the biggest few by name.
export function generateMetadata(): Metadata {
  const names = gameViews().map((v) => v.line.short);
  return {
    title: fitTitle([`Card Games We Compare — ${names.length} Trading Card Games | ${SITE.name}`, `Card Games We Compare | ${SITE.name}`, "Card Games We Compare"]),
    description: gamesDescription(names, "Pick one for its sets, booster boxes, cases and starter decks across every store."),
    ...canon("/games"),
  };
}

export default function Games() {
  if (!isMultiGame) notFound();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-black">The card games we compare</h1>
      <GameTiles />
    </div>
  );
}
