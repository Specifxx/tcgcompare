import { NextResponse } from "next/server";
import { products, refCents, setById } from "@/lib/data";
import { money } from "@/lib/format";
import { shortName } from "@/lib/names";
import { tokens } from "@/lib/slug";
import { kitBestByMarket, kitImage, kits } from "@/lib/kits";
import { expandWords, suggestQuery } from "@/lib/search-fuzzy";
import { rankProducts } from "@/lib/home-demand";

// A plain function on Vercel caches only through its CDN header (Rift Compare,
// "Cached pages refresh every 6 to 24 hours"): six hours at the edge.
export const dynamic = "force-dynamic";

// Each product's search tokens, built once per server instance: tokenising all
// ~17,000 names on every query cost ~40 ms of CPU per keystroke.
let index: { hay: string[]; set: Set<string> }[] | null = null;
function haystacks() {
  return (index ??= products().map((p) => {
    const hay = tokens(`${p.name} ${setById(p.setId)?.name ?? ""} ${setById(p.setId)?.code ?? ""} ${p.number ?? ""}`);
    return { hay, set: new Set(hay) };
  }));
}

let vocab: Map<string, number> | null = null;
/** Every word the catalogue's names, sets and codes hold, with how many products carry it ("did you mean"). */
function words() {
  if (vocab) return vocab;
  vocab = new Map();
  for (const { set } of haystacks()) for (const t of set) if (t.length >= 3 && !/^\d+$/.test(t)) vocab.set(t, (vocab.get(t) ?? 0) + 1);
  return vocab;
}

let kitIndex: Set<string>[] | null = null;
/** Model kits (SITE.kits) whose name, grade, scale or JAN hold every word. */
function kitHits(want: string[], limit: number) {
  if (!want.length) return [];
  const all = kits();
  const idx = (kitIndex ??= all.map((k) => new Set(tokens(`${k.name} ${k.grade ?? ""} ${k.scale ?? ""} ${k.jan}`))));
  const out = [];
  for (let i = 0; i < all.length && out.length < limit; i++) {
    const set = idx[i];
    if (!want.every((w) => set.has(w) || [...set].some((h) => h.startsWith(w)))) continue;
    const k = all[i];
    const best = kitBestByMarket(k.jan)[0];
    out.push({ slug: k.slug, href: `/kit/${k.slug}`, name: k.name, set: "Model kit", image: k.image ? kitImage(k.image, 120) : null, price: best ? money(best.cents, best.currency) : "—", kind: "kit", number: null, rarity: null });
  }
  return out;
}

// A case, display or "set of N" holds several of the product; its price outranked the box itself, so "booster box" listed
// cases first (owner, 2026-11-26: sealed search must find the product). Multiples rank under the single unit unless the
// words ask for them ("booster box case", "display").
// "Booster Display" is the box itself on Bandai's and Lorcana's shelves, so only a display of decks, tins or packs counts.
const isBulk = (name: string) => /\b(case|set of \d+)\b|\(\d+\s*(boxes|packs|decks)\)|(?<!booster )\bdisplay\b/i.test(name);
const asksBulk = (q: string) => /\b(case|cases|display|displays|set of)\b/i.test(q);

export function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").slice(0, 80);
  const bulkUnwanted = !asksBulk(q);
  // /sealed's keyword box (SealedSearch.tsx) asks for sealed product only.
  const onlySealed = u.searchParams.get("kind") === "sealed";
  const limit = Math.min(60, Number(u.searchParams.get("limit") ?? 8) || 8);
  const want = tokens(q);
  if (u.searchParams.get("kind") === "kit")
    return NextResponse.json({ hits: kitHits(want, limit) }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  const numQ = q.match(/\d+\s*\/\s*\d+|[A-Z]{1,4}\d{0,2}-\d{2,3}/i)?.[0]?.replace(/\s/g, "").toUpperCase();
  const idQ = /^\s*\d{5,14}\s*$/.test(q) ? q.trim() : null;
  const all = products();
  const idx = want.length ? haystacks() : [];
  const run = (ws: string[]) => {
    const scored: { s: number; i: number }[] = [];
    if (!ws.length) return scored;
    all.forEach((p, i) => {
      if (onlySealed && p.kind !== "sealed") return;
      const { hay, set } = idx[i];
      let hit = 0;
      for (const w of ws) if (set.has(w) || hay.some((h) => h.startsWith(w))) hit++;
      if (numQ && p.number?.toUpperCase() === numQ) hit += ws.length;
      // A barcode or TCGplayer id typed whole finds its product (lib/gtin.ts): exact only, so "2025" matches no id.
      if (idQ && (p.upc === idQ || (p.upc && p.upc.replace(/^0/, "") === idQ.replace(/^0/, "")) || String(p.id) === idQ)) hit = ws.length + 2;
      if (hit < ws.length) return;
      const ref = refCents(p.id) ?? 0;
      scored.push({ s: hit * 10 + Math.log10(1 + ref) + (p.kind === "card" ? 0.5 : 0) - (bulkUnwanted && isBulk(p.name) ? 3 : 0), i });
    });
    return scored;
  };
  // Owner's UX review (2026-11-23, P0 5): the words as typed; then with shorthand spelled out (ETB, UPC, BB…); then each word
  // that matches nothing swapped for the nearest catalogue word ("charizrd" → charizard), said on the page as "Showing results
  // for". Nothing at all: the most bought products, marked `popular`, never a dead end.
  let scored = run(want);
  let corrected: string | null = null;
  if (!scored.length && want.length && !idQ) {
    const expanded = expandWords(want);
    if (expanded.join(" ") !== want.join(" ")) {
      scored = run(expanded);
      if (scored.length) corrected = expanded.join(" ");
    }
    if (!scored.length) {
      const known = (w: string) => idx.some(({ hay, set }) => set.has(w) || hay.some((h) => h.startsWith(w)));
      const fix = suggestQuery(expanded, words(), known);
      if (fix) {
        scored = run(fix.split(" "));
        if (scored.length) corrected = fix;
      }
    }
  }
  scored.sort((a, b) => b.s - a.s);
  const shape = (p: (typeof all)[number]) => ({ id: p.id, slug: p.slug, href: `/card/${p.slug}`, name: shortName(p.name), set: setById(p.setId)?.name ?? "", image: p.image, price: money(refCents(p.id)), kind: p.kind, number: p.number, rarity: p.rarity });
  const hits = scored.slice(0, limit).map(({ i }) => shape(all[i]));
  // Kits fill what the cards leave: "hg aerial" finds the kit, "aerial" the card first.
  const all2 = [...hits, ...kitHits(want, Math.max(0, limit - hits.length))];
  const popular = !all2.length && want.length ? rankProducts(all.filter((p) => p.kind === "sealed")).slice(0, Math.min(limit, 8)).map(shape) : [];
  return NextResponse.json({ hits: all2, ...(corrected ? { corrected } : {}), ...(popular.length ? { popular } : {}) }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
}
