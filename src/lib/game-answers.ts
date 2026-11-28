// "Quick answers" on each game hub (/games/<game>), written from the day's data (owner, 2026-11-28: "put a lot more effort into
// TCG Prices … SEO … one of the top sites, it covers all the TCGs"). Search Console, 90 days to 25 Nov: the game hubs are shown
// for "<game> prices", "<game> booster box", "how much is a <game> booster box" and "<game> booster box msrp" (Yu-Gi-Oh! 3.8,
// Cyberpunk 3.8, Digimon 2.1, Godzilla 12.2, Union Arena 47, Lorcana 30.8) and clicked by almost nobody. The page held tiles and
// a table, and no sentence that answers the question. These answers do, in the game's own words, from real prices only.
//
// Rules (CLAUDE.md, DECISIONS.md 2026-11-28): never an MSRP, a pack count or a price we do not hold; a store price is a store's
// own in-stock US-dollar price (never TCGplayer, eBay, Amazon or a pre-order: `usStoreLow`); "cheapest" means the cheapest we
// list today, said as such; no question is asked that today's data cannot answer. Pure, so tests/game-answers.test.ts pins it.
import { money } from "@/lib/format";
import type { Offer } from "@/lib/site-types";
import { usStoreLow, type HubItem } from "@/lib/hub-snippet";
import { longDate } from "@/lib/preorders";

export interface QA {
  q: string;
  a: string;
}

export interface AnswerSet {
  name: string;
  releasedOn: string | null;
  upcoming: boolean;
}

export interface StoreCount {
  name: string;
  /** Products of this game the store has in stock in the US today. */
  n: number;
}

export interface AnswerInput {
  /** The game as players type it ("Yu-Gi-Oh!", "Digimon"). */
  short: string;
  /** Every sealed product of the game (no inserts). */
  items: HubItem[];
  /** The game's sets, newest first. */
  sets: AnswerSet[];
  /** US stores with this game in stock today, most products first. */
  stores: StoreCount[];
  /** Distinct stores in any market with an offer for this game today. */
  storesAnywhere: number;
  today: string;
  storeName: (o: Offer) => string;
}

const released = (i: { upcoming: boolean; releasedOn: string | null }, today: string) => !i.upcoming && !!i.releasedOn && i.releasedOn <= today;
const s = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** "booster box" / "booster boxes" for a product type; the plural is the type's hub label when it has one. */
export interface TypeWords { type: string; one: string; many: string }
const BOX: TypeWords = { type: "Booster Box", one: "booster box", many: "booster boxes" };

/** "How much is a <game> <type>?": today's US in-stock store range across the type, then its newest product. */
export function typeAnswer(i: Pick<AnswerInput, "short" | "items" | "today" | "storeName">, w: TypeWords): QA | null {
  const all = i.items.filter((x) => x.sealedType === w.type && released(x, i.today));
  const priced = all.map((item) => ({ item, offer: usStoreLow(item.best) })).filter((x): x is { item: HubItem; offer: Offer } => !!x.offer);
  const newest = [...all].filter((b) => b.tcgCents || usStoreLow(b.best)).sort((a, b) => b.releasedOn!.localeCompare(a.releasedOn!))[0];
  if (!priced.length && !newest) return null;
  const parts: string[] = [];
  if (priced.length) {
    const low = [...priced].sort((a, b) => a.offer.cents - b.offer.cents)[0];
    const high = [...priced].sort((a, b) => b.offer.cents - a.offer.cents)[0];
    parts.push(
      priced.length === 1
        ? `Today one ${i.short} ${w.one} is in stock at a US store we track: ${low.item.name}, ${money(low.offer.cents)} at ${i.storeName(low.offer).trim()}.`
        : `Today ${s(priced.length, `${i.short} ${w.one}`, `${i.short} ${w.many}`)} are in stock at US stores we track, from ${money(low.offer.cents)} (${low.item.name} at ${i.storeName(low.offer).trim()}) to ${money(high.offer.cents)} (${high.item.name}).`,
    );
  }
  if (newest) {
    const st = usStoreLow(newest.best);
    const bits = [newest.tcgCents ? `${money(newest.tcgCents)} on TCGplayer's market` : null, st ? `from ${money(st.cents)} at ${i.storeName(st).trim()}` : null].filter(Boolean);
    if (bits.length) parts.push(`The newest, ${newest.name}, is ${bits.join(" and ")}.`);
  }
  parts.push("These are what stores charge today, not a list price, and we update them every day.");
  return { q: `How much is ${an(i.short) ? "an" : "a"} ${i.short} ${w.one}?`, a: parts.join(" ") };
}

/** "an Elestrals", "a One Piece", "a Union Arena": a vowel sound, not a vowel letter. */
const an = (w: string) => /^[aeiou]/i.test(w) && !/^(uni|one|eu)/i.test(w);

const boxAnswer = (i: AnswerInput) => typeAnswer(i, BOX);

function setAnswer(i: AnswerInput): QA | null {
  const out = i.sets.filter((x) => released(x, i.today)).sort((a, b) => b.releasedOn!.localeCompare(a.releasedOn!))[0];
  const next = i.sets.filter((x) => x.releasedOn && x.releasedOn > i.today).sort((a, b) => a.releasedOn!.localeCompare(b.releasedOn!))[0];
  if (!out && !next) return null;
  const parts: string[] = [];
  if (out) parts.push(`The newest ${i.short} set we compare is ${out.name}, released ${longDate(out.releasedOn)}.`);
  if (next) parts.push(`${out ? "The next" : "The next set"}, ${next.name}, is due ${longDate(next.releasedOn)}, and its pre-orders are compared here as stores open them.`);
  return { q: `What is the newest ${i.short} set?`, a: parts.join(" ") };
}

function storeAnswer(i: AnswerInput): QA | null {
  if (!i.storesAnywhere) return null;
  const top = i.stores.filter((x) => x.n > 0).slice(0, 3);
  const lead = `${s(i.storesAnywhere, "store")} list ${i.short} sealed product in our data today, besides TCGplayer and eBay.`;
  const us = top.length ? ` In the US, the most in stock right now are at ${list(top.map((x) => `${x.name.trim()} (${s(x.n, "product")})`))}.` : "";
  return { q: `Where can I buy ${i.short} sealed product?`, a: `${lead}${us} Every store is listed on each product's page, cheapest first, whether it pays us or not.` };
}

/** The game hub's answers, in order; any question today's data cannot answer is left out. */
export function gameAnswers(i: AnswerInput): QA[] {
  return [boxAnswer(i), setAnswer(i), storeAnswer(i)].filter((x): x is QA => !!x);
}
