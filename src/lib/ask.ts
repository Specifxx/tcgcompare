// "Ask our prices" (owner, 2026-11-18, after Catchback's agent panel): a plain-words box that turns a sentence into one of OUR pages and
// the top live search hits. NO model call, no database, no key: pure rules over words, answering only from the site's own files
// (/api/search, the section pages). Nothing it cannot find is invented: no hit says so and offers the search page.
// Pure and browser-safe (no imports of server code), for the tests.

export interface AskGame {
  slug: string;
  short: string;
  name: string;
}

export interface AskRoute {
  href: string;
  label: string;
}

export interface Ask {
  /** The words to search for, with the filler taken out ("cheapest surging sparks booster box in the uk" → "surging sparks booster box"). */
  words: string;
  /** A section page the sentence plainly asks for (pre-orders, deals, movers, back in stock), or the game's hub. */
  routes: AskRoute[];
  /** A pasted store link: the "is this a good price" checker takes it. */
  link: string | null;
  /** The sentence asks for the lowest price (cheapest, lowest, cheap): the rows are the lowest-priced matches, not the most relevant. */
  cheapest: boolean;
}

const FILLER = new Set(
  "a an the of in on at for to me my i we you is are was it its what what's whats which where who how much many does do can could would should please show find get give tell about want wanna need looking look best cheapest cheap lowest price prices priced cost costs buy buying sale deal deals under below over above less more than around near new latest good worth uk us usa au ca eu sg canada australia europe singapore britain england united states kingdom".split(
    " ",
  ),
);

const URL_RE = /^\s*(https?:\/\/|[a-z0-9-]+(\.[a-z0-9-]+)+\/)\S*/i;

/** The sections a sentence can plainly ask for, first match wins per kind. */
const SECTIONS: { re: RegExp; route: AskRoute }[] = [
  { re: /\b(pre-?orders?|upcoming|coming soon|not out yet|release dates?)\b/i, route: { href: "/preorders", label: "Pre-orders" } },
  { re: /\b(back in stock|restock(s|ed)?|in stock again)\b/i, route: { href: "/restocks", label: "Back in stock" } },
  { re: /\b(movers?|price drops?|dropp(ed|ing)|falling|rising|going up|going down|trending)\b/i, route: { href: "/movers", label: "Price movers" } },
  { re: /\b(deals?|bargains?|discounts?|on sale|good price|worth it)\b/i, route: { href: "/tools/deal-finder", label: "Today's deals" } },
];

export function parseAsk(text: string, games: AskGame[] = []): Ask {
  const raw = text.trim().slice(0, 120);
  if (URL_RE.test(raw)) return { words: "", routes: [], link: raw, cheapest: false };
  let lower = raw.toLowerCase();
  const routes: AskRoute[] = [];
  // A section the sentence asks for is a page, not a product word: it comes out of what is searched for.
  const asked = lower;
  for (const s of SECTIONS) if (s.re.test(asked)) (routes.push(s.route), (lower = lower.replace(s.re, " ")));
  // A game named in the sentence: its hub (longest name first, so "Dragon Ball Super Fusion World" beats "Dragon Ball").
  const named = [...games].sort((a, b) => b.name.length - a.name.length).find((g) => asked.includes(g.name.toLowerCase()) || asked.includes(g.short.toLowerCase()));
  if (named) routes.push({ href: `/games/${named.slug}`, label: `${named.short} prices` });
  const words = lower
    .replace(/[£€$]\s?\d[\d,.]*/g, " ")
    .replace(/[^a-z0-9'\- ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w) && !/^\d{1,4}$/.test(w))
    .join(" ")
    .trim();
  return { words, routes: routes.slice(0, 2), link: null, cheapest: /\b(cheapest|cheap|lowest|least expensive|bargain)\b/i.test(asked) };
}

/** The search endpoint for an ask (three rows are enough for a sheet), or null when there is nothing to search. */
export function askSearchUrl(a: Ask, limit = 4): string | null {
  // "Cheapest" looks wider (the search ranks by relevance first) and keeps the lowest-priced few, see `askPick`.
  return a.words.length >= 2 ? `/api/search?q=${encodeURIComponent(a.words)}&limit=${a.cheapest ? 40 : limit}` : null;
}

/** The rows to show: as ranked, or for a "cheapest" ask the lowest-priced `limit` of those matches (a row with no price never leads). */
export function askPick<T extends { price: string }>(a: Ask, hits: T[], limit = 4): T[] {
  if (!a.cheapest) return hits.slice(0, limit);
  const n = (h: T) => {
    const v = Number(h.price.replace(/[^0-9.]/g, ""));
    return Number.isFinite(v) && v > 0 ? v : Infinity;
  };
  return [...hits].sort((x, y) => n(x) - n(y)).slice(0, limit);
}

/** Where "see all results" goes: the checker for a link, else the search page for the words. */
export function askSeeAll(a: Ask): AskRoute | null {
  if (a.link) return { href: `/tools/is-this-a-good-price#link=${encodeURIComponent(a.link)}`, label: "Check this price" };
  return a.words ? { href: `/search?q=${encodeURIComponent(a.words)}`, label: "See all results" } : null;
}

export const ASK_EXAMPLES = ["Cheapest booster box", "Pre-orders out this month", "Price drops today", "Is this a good price?", "Back in stock"];
