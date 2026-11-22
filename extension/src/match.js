// Which product in our price file a store's page is selling, from the page's own words (its tab title, heading or
// product data) and, when the page shows one, its barcode. Shared by the popup and the tests (tests/extension-match):
// a plain script that defines makeMatcher(), and a CommonJS export when Node loads it.
//
// It refuses rather than guesses. A page is called a product ("sure") only when the words cover that product's own
// name, the kind of product agrees (a box is never its case, a pack never its box), the game and the language agree,
// and no other product fits as well. Otherwise the popup shows the closest products as search results to choose
// from, and a single card is said to be a single card: we only price sealed product.
(function (root) {
  const STOP = new Set(
    ("a an and the of for with in on by to from new sealed factory official english eng en version edition ver tcg ccg tcgs " +
      "card cards game games trading collectible collectable product item items free shipping ship ships in-stock stock instock hand " +
      "buy now sale preorder preorders release releases presale shop store online au us uk ca nz eu usa australia " +
      "brand authentic genuine original retail sealedbox x qty each only today hot deal deals best price")
      .split(" "),
  );
  // Words that only say what kind of thing it is; the kind is read separately (kindOf), so they never count as name words.
  const KIND_WORDS = new Set(
    "booster boosters box boxes display displays pack packs case cases bundle bundles deck decks tin tins collection collections kit kits etb blister blisters trainer elite set sets".split(" "),
  );
  const LANG_FOREIGN = /\b(japanese|japan|jp|jpn|japonais|japanisch|japans|japones|giapponese|korean|kr|kor|chinese|simplified|traditional|chn|french|francais|fr|german|deutsch|de|italian|italiano|spanish|espanol|portuguese|portugues|thai|indonesian)\b/;
  const JAPANESE = /\b(japanese|japan|jp|jpn|japonais|japanisch|japans|japones|giapponese)\b/;
  // How players and stores name each game. A page that names one game is only ever matched to that game's products.
  const GAME_WORDS = {
    pkm: ["pokemon", "pokémon", "ptcg", "poke mon"],
    pkj: ["pokemon", "pokémon", "ptcg"],
    mtg: ["magic the gathering", "magic gathering", "mtg", "magic"],
    rb: ["riftbound", "league of legends", "lol"],
    op: ["one piece", "optcg", "op tcg"],
    ygo: ["yu gi oh", "yugioh", "ygo", "konami"],
    lor: ["lorcana", "disney lorcana"],
    gun: ["gundam"],
    ua: ["union arena"],
    fw: ["fusion world", "dragon ball super fusion", "dbs fusion", "dbsfw"],
    dbs: ["dragon ball super masters", "dbs masters", "dragon ball super card game masters"],
    dg: ["digimon"],
    swu: ["star wars unlimited", "swu"],
    fab: ["flesh and blood", "fab tcg"],
    ws: ["weiss schwarz", "weiß schwarz", "weib schwarz"],
    cfv: ["vanguard", "cardfight"],
    sor: ["sorcery contested realm", "sorcery tcg"],
    ga: ["grand archive"],
    holo: ["hololive"],
    gz: ["godzilla card game"],
    cp: ["cyberpunk"],
    ff: ["final fantasy tcg", "fftcg", "final fantasy trading card game", "opus"],
    sve: ["shadowverse"],
    uvs: ["universus", "uvs"],
    ele: ["elestrals"],
    cr: ["cookierun", "cookie run", "braverse"],
    pal: ["palworld"],
    wx: ["wixoss"],
    bss: ["battle spirits"],
    ac: ["alpha clash"],
  };
  // Signs of a single card (or a graded slab) rather than sealed product.
  const SINGLE = /\b\d{1,3}\s?\/\s?\d{2,3}\b|\b(psa|cgc|bgs|sgc|beckett|ace)\s?(\d{1,2}(\.\d)?|gem|mint)\b|\b(near mint|nm\/m|nm|lp|mp|hp|holo rare|reverse holo|full art|alt art|alternate art|secret rare|illustration rare|special illustration|sir|hyper rare|ultra rare|serialized|serialised|graded|slab|single|singles|foil|non foil|borderless|showcase|extended art|signed|autograph|playset|x4|4x)\b/;

  function fold(s) {
    return String(s ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ß/g, "ss")
      .replace(/['’`]/g, "")
      .replace(/&/g, " and ")
      .replace(/\+/g, " plus ")
      .replace(/[^a-z0-9./]+/g, " ")
      .replace(/(?<![\d])[./]|[./](?![\d])/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Phrases with one meaning however a store spells them.
  function canon(s) {
    return (" " + s + " ")
      .replace(/ elite trainer box(es)? /g, " etb ")
      .replace(/ pokemon center /g, " pc ")
      .replace(/ build (and |n )?battle (box|kit|stadium)? ?/g, " buildbattle ")
      .replace(/ pre ?release /g, " prerelease ")
      .replace(/ pre ?rift /g, " prerift ")
      .replace(/ pre ?orders? /g, " preorder ")
      .replace(/ booster displays? /g, " booster box ")
      .replace(/ (blister|checklane) /g, " blister ")
      .replace(/ 3 ?pk /g, " 3 pack ")
      .replace(/ vol(ume)? ?(\d+) /g, " vol$2 ")
      .replace(/ (\d+) ?(ct|count|pc|pcs|pieces) /g, " ")
      .replace(/ s and v | s v /g, " scarlet and violet ")
      .replace(/ ([a-z]{1,4}) ?-? ?0*(\d{1,3})([a-z]?) /g, (m, a, d, z) => (/^(vol|op|eb|st|prb|sv|me|sm|xy|bw|swsh|bt|ex|fb|ue|gd|bs|ga|dz|ds|ch|ou|ws|qb|sd|ec|rb|ad|mb|mp|ap)$/.test(a) ? ` ${a}${d}${z} ` : m))
      .replace(/\s+/g, " ")
      .trim();
  }

  /** "36 packs", "12 boosters", "24 cards": what a thing holds, never part of its name. */
  function stripCounts(s) {
    return (" " + s + " ").replace(/(?<! (set|series|vol|wave|part|season|chapter|volume)) \d+ ?x? ?(booster |sleeved |card )?(packs|pack|boosters|cards|decks|tins|bundles|pcs) /g, " ");
  }

  /** The kind of sealed product a text describes, or null when it does not say. */
  function kindOf(t) {
    let s = " " + t + " ";
    // Counts of what is inside ("36 packs", "(6 booster boxes)") say what the thing holds, not what it is.
    if (/ (\d+|six|4|6|8|12) ?x? ?(booster )?(boxes|displays) /.test(s) || / sealed case | case of /.test(s)) return "case";
    s = stripCounts(s);
    const deck = / (decks?|precons?|preconstructed) /.test(s);
    if (deck && / (display|displays|case|box of) /.test(s)) return "deckdisplay";
    if (/ buildbattle /.test(s) && / (display|displays) /.test(s)) return "kitdisplay";
    if (/ (case|cases) /.test(s)) return "case";
    if (/ etb /.test(s)) return "etb";
    if (/ booster box(es)? | display /.test(s)) return "box";
    if (/ buildbattle /.test(s)) return "kit";
    if (/ bundle /.test(s) && !/ (pack|packs) bundle /.test(s)) return "bundle";
    if (deck) return "deck";
    if (/ tins? /.test(s)) return "tin";
    if (/ (prerelease|prerift|kit) /.test(s)) return "kit";
    if (/ collections? | trove /.test(s)) return "collection";
    if (/ (pack|packs|booster|boosters|sleeved|blister) /.test(s)) return "pack";
    if (/ box /.test(s)) return "obox";
    return null;
  }

  function kindsAgree(q, i) {
    if (!q || !i || q === i) return 0;
    const near = { obox: ["collection", "kit", "box", "etb", "bundle"], collection: ["obox", "tin", "kit"], kit: ["obox", "collection"], bundle: ["obox"] };
    return near[q]?.includes(i) ? 1 : 2; // 1 = could be, 2 = a different product
  }

  /** The product words of a page title: the store's name, Amazon's and eBay's furniture taken off. */
  function cleanTitle(title) {
    let t = String(title ?? "").replace(/\s+/g, " ").trim();
    t = t.replace(/^amazon(\.[a-z.]+)?\s*:\s*/i, "").replace(/\s*:\s*(toys (and|&) games|video games|toys|toys & games|everything else|home & kitchen)\s*$/i, "");
    t = t.replace(/\s*[|]\s*ebay.*$/i, "").replace(/\s*[|]\s*tcgplayer.*$/i, "");
    // "Product – Store", "Product | Store", "Product — Store": the last part is the shop.
    const m = t.match(/^(.*\S)\s+[–—|]\s+[^–—|]{2,60}$/);
    if (m && m[1].length >= 8) t = m[1];
    return t.slice(0, 200);
  }

  function makeMatcher(feed, opts = {}) {
    const W = { miss: 1.1, extra: 0.7, opt: 0.6, kindless: 1.5, margin: 0.8, cover: 0.7, ...opts };
    const ids = Object.keys(feed.items);
    const gameRe = {};
    for (const [g, words] of Object.entries(GAME_WORDS)) gameRe[g] = new RegExp(`(^| )(${words.map((w) => fold(w).replace(/\s+/g, " ")).join("|")})( |$)`);
    const gameTokens = new Set(Object.values(GAME_WORDS).flatMap((w) => w.flatMap((x) => fold(x).split(" "))));
    for (const l of Object.values(feed.lines ?? {})) for (const w of fold(l.name).split(" ")) gameTokens.add(w);

    const toks = (s, drop) => {
      const out = [];
      for (const w of stripCounts(canon(fold(s))).trim().split(" ")) {
        if (!w || STOP.has(w) || KIND_WORDS.has(w) || (drop && gameTokens.has(w))) continue;
        if (w.length < 2 && !/\d/.test(w)) continue;
        if (!out.includes(w)) out.push(w);
      }
      return out;
    };

    const rows = [];
    const df = new Map();
    for (const id of ids) {
      const it = feed.items[id];
      const nameF = canon(fold(it.n));
      const req = toks(it.n, true);
      const opt = toks(`${it.t ?? ""} ${it.c ?? ""}`, true).filter((w) => !req.includes(w));
      const kind = kindOf(nameF) ?? kindOf(canon(fold(it.k ?? ""))) ?? null;
      const jp = it.g === "pkj" || /\bjapanese\b/.test(nameF);
      const foreign = jp || LANG_FOREIGN.test(nameF);
      rows.push({ id, it, req, opt, kind, jp, foreign, code: it.e ?? null });
      for (const w of new Set([...req, ...opt])) df.set(w, (df.get(w) ?? 0) + 1);
    }
    const N = rows.length;
    const idf = (w) => Math.log(1 + N / (df.get(w) ?? 0.5));
    const byCode = new Map(rows.filter((r) => r.code).map((r) => [r.code.replace(/^0+/, ""), r]));

    const same = (q, t) => {
      if (q === t) return true;
      if (/\d/.test(q) || /\d/.test(t)) return false;
      if (q.length >= 4 && t.length >= 4) {
        const [a, b] = q.length < t.length ? [q, t] : [t, q];
        return b.startsWith(a) && b.length - a.length <= 2;
      }
      return false;
    };

    /**
     * @param {string} text the page's product words (tab title, heading or product name)
     * @param {string} market the visitor's market, to rank in-stock products first among equals
     * @param {string[]} [gtins] barcodes the page shows
     * @returns {{ sure: string|null, top: string[], single: boolean, foreign: boolean }}
     */
    return function match(text, market, gtins = []) {
      for (const g of gtins) {
        const r = byCode.get(String(g).replace(/\D/g, "").replace(/^0+/, ""));
        if (r) return { sure: r.id, top: [r.id], single: false, foreign: false, by: "barcode" };
      }
      const clean = cleanTitle(text);
      const f = canon(fold(clean));
      const games = Object.keys(gameRe).filter((g) => gameRe[g].test(f));
      // "Magic" alone is too common a word to name the game when another game is named too.
      const named = games.length > 1 ? games.filter((g) => g !== "mtg" || /(^| )(mtg|gathering)( |$)/.test(f)) : games;
      const qJp = JAPANESE.test(f);
      const qForeign = LANG_FOREIGN.test(f);
      const qKind = kindOf(f);
      const single = !qKind && SINGLE.test(f);
      const q = toks(clean, true);
      if (!q.length) return { sure: null, top: [], single, foreign: qForeign };

      const qj = q.slice(1).map((w, i) => [q[i] + w, q[i], w]);
      const scored = [];
      for (const r of rows) {
        if (named.length && !named.includes(r.it.g) && !(r.it.g === "pkj" && named.includes("pkm"))) continue;
        let got = 0, miss = 0, gotN = 0;
        const used = new Set();
        // "Spiderman" is "Spider-Man", "Pokeball" is "Poke Ball": one word on one side can be two on the other.
        const joined = new Set();
        for (let i = 1; i < r.req.length; i++) if (q.includes(r.req[i - 1] + r.req[i])) { joined.add(r.req[i - 1]); joined.add(r.req[i]); used.add(r.req[i - 1] + r.req[i]); }
        for (const t of r.req) {
          let hit = joined.has(t) ? t : q.find((w) => same(w, t));
          if (!hit) {
            const j = qj.find((x) => x[0] === t);
            if (j) { hit = j[0]; used.add(j[1]); used.add(j[2]); }
          }
          if (hit) { got += idf(t); gotN++; used.add(hit); } else miss += idf(t);
        }
        let opt = 0;
        for (const t of r.opt) {
          const hit = q.find((w) => same(w, t));
          if (hit) { opt += idf(t); used.add(hit); }
        }
        if (!gotN && !opt) continue;
        let extra = 0;
        for (const w of q) if (!used.has(w) && df.has(w)) extra += idf(w);
        const kd = kindsAgree(qKind, r.kind);
        const langBad = r.jp !== qJp || (qForeign && !r.foreign);
        const cover = r.req.length ? got / (got + miss) : opt > 0 ? 1 : 0;
        const s = got + W.opt * opt - W.miss * miss - W.extra * extra - kd * 6 - (!qKind && r.kind ? W.kindless : 0) - (langBad ? 8 : 0) + (r.it.p?.[market] != null ? 0.4 : 0) + Math.log10(1 + (r.it.s ?? 0)) * 0.3;
        scored.push({ r, s, cover, kd, langBad, gotN, extra, got, miss, opt });
      }
      scored.sort((a, b) => b.s - a.s);
      const top = scored.slice(0, 25).map((x) => x.r.id);
      const best = scored[0];
      let sure = null;
      if (best && !single && best.kd === 0 && !best.langBad && best.cover >= W.cover && (qKind || !best.r.kind) && (best.gotN >= 1 || best.r.req.length === 0)) {
        const second = scored[1];
        // Another product that fits about as well means the words do not decide it.
        if (!second || best.s - second.s >= W.margin) sure = best.r.id;
      }
      if (W.debug) console.log(JSON.stringify({ q, qKind, top: scored.slice(0, 3).map((x) => [x.r.it.n, x.r.req, x.r.kind, +x.s.toFixed(2), +x.got.toFixed(2), +x.miss.toFixed(2), +x.extra.toFixed(2), x.kd]) }));
      return { sure, top, single, foreign: qForeign && !best?.r.foreign };
    };
  }

  const api = { makeMatcher, matcher: makeMatcher, cleanTitle, kindOf, fold };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
