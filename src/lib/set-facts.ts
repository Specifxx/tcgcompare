// The set page's "About this set" lines (owner, 2026-11-18, Cardmarket's playbook: expansion pages are the high-intent
// landing pages, so each carries copy about THAT set beside its listings; DECISIONS.md 2026-11-18). Cardmarket pays
// players to write it; we write only what our own data settles: the release date, the product types we compare, and
// the cheapest in-stock US booster box against TCGplayer's market price. Never a pack count, print run, MSRP or card
// text. Pure, so tests/set-facts.test.ts pins every sentence.
import { money } from "@/lib/format";
import type { Offer } from "@/lib/site-types";

export interface SetFactInput {
  phrase: string; // "One Piece The Dominance of God (OP18)"
  releasedOn: string | null;
  upcoming: boolean;
  today: string; // YYYY-MM-DD
  products: { name: string; sealedType: string | null; tcgCents: number | null; best: Offer[]; inStockSources: number }[];
  storeName: (o: Offer) => string;
}

const TYPE_ORDER = ["Booster Box", "Case", "Elite Trainer Box", "Booster Bundle", "Collection", "Starter Deck", "Deck", "Booster Pack", "Blister Pack", "Prerelease", "Deck Display"];

const plural = (t: string) => (/x$/.test(t) ? `${t}es` : /s$/.test(t) ? t : `${t}s`);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function setFacts(i: SetFactInput): string[] {
  const out: string[] = [];
  const types = [...new Set(i.products.map((p) => p.sealedType).filter((t): t is string => !!t))].sort(
    (a, b) => (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99),
  );
  const when = i.releasedOn && /^\d{4}-\d{2}-\d{2}$/.test(i.releasedOn) ? i.releasedOn : null;
  if (when) out.push(`${i.phrase} ${i.upcoming || when > i.today ? "releases" : "released"} on ${day(when)}.`);
  const n = i.products.length;
  if (n) out.push(`We compare ${n} sealed product${n === 1 ? "" : "s"} from it${types.length ? ` (${list(types.slice(0, 5).map((t) => plural(t).toLowerCase()))})` : ""} at every store we track, TCGplayer, eBay and Amazon.`);
  // The headline box: a booster box (never a case), the one most stores have in stock.
  const boxes = i.products.filter((p) => p.sealedType === "Booster Box").sort((a, b) => b.inStockSources - a.inStockSources);
  const box = boxes[0];
  if (box) {
    const us = box.best.filter((o) => o.market === "US" && o.inStock && o.currency === "USD" && o.source !== "tcgplayer" && o.source !== "ebay" && o.source !== "amazon").sort((a, b) => a.cents - b.cents)[0];
    if (us && box.tcgCents) {
      const gap = Math.round(((box.tcgCents - us.cents) / box.tcgCents) * 100);
      const vs = gap >= 1 ? `, ${gap}% under` : gap <= -1 ? `, ${-gap}% over` : ", level with";
      out.push(`The cheapest ${box.name} in stock in the US is ${money(us.cents)} at ${i.storeName(us)}${vs} TCGplayer's market price of ${money(box.tcgCents)}.`);
    } else if (us) {
      out.push(`The cheapest ${box.name} in stock in the US is ${money(us.cents)} at ${i.storeName(us)}.`);
    } else if (box.tcgCents) {
      out.push(`No store we track has the ${box.name} in stock in the US today; TCGplayer's market price is ${money(box.tcgCents)}.`);
    }
  }
  return out;
}
