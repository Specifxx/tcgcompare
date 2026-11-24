// Game hub and game-type hub titles and descriptions written from today's data (page scorecard 2026-11-23, Job D: the game
// hubs rank on page one, positions 9 to 15, for "yugioh prices", "cyberpunk tcg prices", "digimon card prices", "godzilla
// booster box", and are clicked by nobody; the snippet was a template that said the same thing for all 31 games).
// The title names the game and the product types it really has; the description leads with one real US store price for
// the newest released product of the page, beside TCGplayer's market price. Never an MSRP, a pack count or a price we do
// not hold. Pure, so tests/hub-snippet.test.ts pins every sentence.
import { money } from "@/lib/format";
import type { Offer } from "@/lib/site-types";

export interface HubItem {
  name: string;
  sealedType: string | null;
  releasedOn: string | null;
  upcoming: boolean;
  tcgCents: number | null;
  best: Offer[];
}

const NOT_A_STORE = new Set(["tcgplayer", "ebay", "amazon"]);

/** The cheapest in-stock US store offer in US dollars (never TCGplayer, eBay or Amazon, never a pre-order). */
export function usStoreLow(best: Offer[]): Offer | null {
  return best.filter((o) => o.market === "US" && o.inStock && !o.preorder && o.currency === "USD" && !NOT_A_STORE.has(o.source)).sort((a, b) => a.cents - b.cents)[0] ?? null;
}

/** The page's headline product: the newest released one a US store has in stock, else none. */
export function headlineItem(items: HubItem[], today: string): { item: HubItem; offer: Offer } | null {
  const out = items
    .filter((i) => !i.upcoming && i.releasedOn && i.releasedOn <= today)
    .map((item) => ({ item, offer: usStoreLow(item.best) }))
    .filter((x): x is { item: HubItem; offer: Offer } => !!x.offer)
    .sort((a, b) => b.item.releasedOn!.localeCompare(a.item.releasedOn!) || (b.item.tcgCents ?? 0) - (a.item.tcgCents ?? 0));
  return out[0] ?? null;
}

const KINDS: [RegExp, string][] = [
  [/^Booster Box$/, "Booster Boxes"],
  [/^(Booster|Sleeved) Pack$/, "Packs"],
  [/Deck$/, "Decks"],
  [/^Elite Trainer Box$/, "ETBs"],
  [/^Case$/, "Cases"],
];

/** "Booster Boxes, Packs & Decks": the first three kinds the game really has, in that order. */
export function kindsPhrase(types: (string | null)[]): string | null {
  const have = KINDS.filter(([re]) => types.some((t) => t && re.test(t))).map(([, k]) => k).slice(0, 3);
  if (!have.length) return null;
  return have.length === 1 ? have[0] : `${have.slice(0, -1).join(", ")} & ${have[have.length - 1]}`;
}

/** Game hub title candidates, longest first; `fitTitle` keeps the first that fits. */
export function gameHubTitleLadder(name: string, short: string, types: (string | null)[]): string[] {
  const kinds = kindsPhrase(types);
  const out = kinds ? [`${name} Prices: ${kinds}`, `${short} Prices: ${kinds}`] : [];
  out.push(`${name} Booster Box & Sealed Prices`, `${short} Booster Box & Sealed Prices`, `${short} Prices`);
  return [...new Set(out)];
}

const priceLine = (h: { item: HubItem; offer: Offer }, storeName: (o: Offer) => string, lead: string) => {
  const vs = h.item.tcgCents ? ` (TCGplayer market ${money(h.item.tcgCents)})` : "";
  return `${lead}${h.item.name} from ${money(h.offer.cents)} at ${storeName(h.offer).trim()}${vs}.`;
};

export function gameHubDescription(i: { short: string; items: HubItem[]; sets: number; stores: number; today: string; storeName: (o: Offer) => string }): string {
  const boxes = i.items.filter((x) => x.sealedType === "Booster Box");
  const h = headlineItem(boxes, i.today) ?? headlineItem(i.items, i.today);
  const lead = h ? priceLine(h, i.storeName, "In stock in the US today: ") + " " : "";
  const n = i.items.length;
  return `${lead}Compare ${n.toLocaleString("en-US")} ${i.short} sealed product${n === 1 ? "" : "s"} from ${i.sets} set${i.sets === 1 ? "" : "s"} across ${i.stores.toLocaleString("en-US")} stores, TCGplayer and eBay, updated daily.`;
}

/** "Booster packs" -> "Booster Pack": the type as a title word. */
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function typeHubTitleLadder(name: string, short: string, type: string, label: string, n: number): string[] {
  const t = titleCase(type);
  return [...new Set([`${name} ${t} Prices: All ${n} Compared`, `${short} ${t} Prices: All ${n} Compared`, `${short} ${t} Prices`, `${short} ${titleCase(label)}`])];
}

export function typeHubDescription(i: { short: string; label: string; items: HubItem[]; stores: number; today: string; storeName: (o: Offer) => string }): string {
  const h = headlineItem(i.items, i.today);
  const lead = h ? priceLine(h, i.storeName, "Newest in stock in the US: ") + " " : "";
  return `${lead}Prices for all ${i.items.length.toLocaleString("en-US")} ${i.short} ${i.label.toLowerCase()} across ${i.stores.toLocaleString("en-US")} stores, TCGplayer and eBay, newest set first.`;
}
