// The collection app (DECISIONS.md, 2026-11-26 "The collection app"): single cards valued from TCG Singles DB's open API,
// what I paid, spreadsheet import that refuses rather than guesses, and the installable app.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cardId,
  cardPriceMap,
  historyEligible,
  matchRow,
  matchSet,
  namesAgree,
  numberKey,
  parseCardId,
  parseCsv,
  parseMoney,
  printingsOf,
  readImport,
  setsToFetch,
  toUnixSeries,
  type OpenSetFile,
} from "../src/lib/card-collection";
import { addItem, setItemCost, sinceAdded, totalsByMarket, valueItems, type VaultItem } from "../src/lib/vault";
import { mergeThreeWay } from "../src/lib/vault-sync";
import { installWay, shouldOffer } from "../src/lib/app-install";

const base: OpenSetFile = {
  game: "pokemon",
  set: { slug: "base-set", name: "Base Set", abbr: "BS", released: "1999-01-09", cards: 4 },
  cards: [
    { id: 42382, s: "charizard-004-102", n: "Charizard", no: "004/102", r: "Holo Rare", p: { Holofoil: 100105 } },
    { id: 657516, s: "charizard-black-dot-error-004-102", n: "Charizard (Black Dot Error)", no: "004/102", r: "Holo Rare", p: {} },
    { id: 42500, s: "pikachu-058-102", n: "Pikachu", no: "058/102", r: "Common", p: { Normal: 900, "1st Edition": 4200 } },
    { id: 42600, s: "energy-removal-092-102", n: "Energy Removal", no: "092/102", r: "Common", p: { Normal: 50 } },
  ],
};
const sets = { "pokemon/base-set": base };

test("a card id round-trips, fits the account's id rule, and refuses junk", () => {
  const id = cardId({ game: "pokemon", set: "base-set", tcgId: 42500, printing: "1st Edition" })!;
  assert.equal(id, "card:pokemon:base-set:42500:1st_Edition");
  assert.match(id, /^[A-Za-z0-9_.:-]{1,80}$/); // RiftCompare lib/sister-stash.ts ID_RE
  assert.deepEqual(parseCardId(id), { game: "pokemon", set: "base-set", tcgId: 42500, printing: "1st Edition" });
  assert.equal(cardId({ game: "Pokemon!", set: "x", tcgId: 1, printing: "Normal" }), null);
  assert.equal(cardId({ game: "pokemon", set: "x", tcgId: 0, printing: "Normal" }), null);
  assert.equal(parseCardId("12345"), null);
});

test("cards are valued at their own printing's price, in US$, beside sealed products", () => {
  const pika1 = cardId({ game: "pokemon", set: "base-set", tcgId: 42500, printing: "1st Edition" })!;
  const zard = cardId({ game: "pokemon", set: "base-set", tcgId: 42382, printing: "Holofoil" })!;
  const err = cardId({ game: "pokemon", set: "base-set", tcgId: 657516, printing: "Normal" })!;
  const prices = cardPriceMap([pika1, zard, err], sets);
  assert.deepEqual(prices, { [pika1]: 4200, [zard]: 100105 });
  const items: VaultItem[] = [
    { id: pika1, name: "Pikachu", href: "/collection", market: "US", currency: "USD", addedCents: 3000, qty: 2, addedAt: "2026-11-01T00:00:00Z" },
    { id: err, name: "Error", href: "/collection", market: "US", currency: "USD", addedCents: 0, qty: 1, addedAt: "2026-11-01T00:00:00Z" },
    { id: "99", name: "Box", href: "/card/box", market: "US", currency: "USD", addedCents: 10000, qty: 1, addedAt: "2026-11-01T00:00:00Z" },
  ];
  const valued = valueItems(items, { products: [{ id: "99", prices: { US: { cents: 12000 } } }, { id: pika1, prices: { US: { cents: 1 } } }] }, prices);
  assert.deepEqual(valued.map((v) => v.nowCents), [4200, null, 12000]); // a sealed price never values a card
  const [t] = totalsByMarket(valued);
  assert.equal(t.nowCents, 4200 * 2 + 12000);
  assert.equal(t.unpriced, 1);
  assert.deepEqual(sinceAdded(valued, "US"), { from: 3000 * 2 + 10000, to: 4200 * 2 + 12000 });
});

test("what I paid replaces the price when added, and an edit on one device survives a sync", () => {
  const i: VaultItem = { id: "a", name: "A", href: "/x", market: "US", currency: "USD", addedCents: 1000, qty: 1, addedAt: "2026-11-01T00:00:00Z" };
  assert.equal(setItemCost([i], "US:a", 750)[0].addedCents, 750);
  assert.equal(setItemCost([i], "US:a", -5)[0].addedCents, 0);
  const remoteEdit = { ...i, addedCents: 600 };
  assert.equal(mergeThreeWay([i], [i], [remoteEdit])[0].addedCents, 600);
  assert.equal(mergeThreeWay([i], [{ ...i, addedCents: 800 }], [i])[0].addedCents, 800);
});

test("sets to fetch: one per set, capped", () => {
  const ids = [1, 2, 3].map((n) => cardId({ game: "pokemon", set: n === 3 ? "jungle" : "base-set", tcgId: n, printing: "Normal" })!);
  assert.deepEqual(setsToFetch([...ids, "123"]), ["pokemon/base-set", "pokemon/jungle"]);
});

test("printings: priced first, dearest first; none priced still offers Normal", () => {
  assert.deepEqual(printingsOf(base.cards[2]).map((p) => p.name), ["1st Edition", "Normal"]);
  assert.deepEqual(printingsOf(base.cards[1]), [{ name: "Normal", cents: null }]);
});

test("a card joins the value chart only in the printing its history follows (the dearest)", () => {
  assert.equal(historyEligible(cardId({ game: "pokemon", set: "base-set", tcgId: 42500, printing: "1st Edition" })!, sets), true);
  assert.equal(historyEligible(cardId({ game: "pokemon", set: "base-set", tcgId: 42500, printing: "Normal" })!, sets), false);
  assert.deepEqual(toUnixSeries([[0, 5]]), [[Math.round(Date.parse("2026-01-01T00:00:00Z") / 86_400_000), 5]]);
});

test("CSV: quotes, doubled quotes, semicolons, CRLF and a BOM", () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n'), [["a", "b"], ["x, y", 'say "hi"']]);
  assert.deepEqual(parseCsv("a;b\n1;2"), [["a", "b"], ["1", "2"]]);
  assert.equal(parseMoney("$1,234.50"), 123450);
  assert.equal(parseMoney("12,50 €"), 1250);
  assert.equal(parseMoney(""), 0);
});

test("import reads the columns other apps export, and flags graded and sealed rows", () => {
  const csv = [
    "Portfolio Name,Category,Set,Product Name,Card Number,Rarity,Variance,Grade,Quantity,Average Cost Paid",
    "Main,Pokemon,Base Set,Charizard,4/102,Holo Rare,Holofoil,Ungraded,1,$350.00",
    "Main,Pokemon,Base Set,Charizard,4/102,Holo Rare,Holofoil,PSA 9,1,$900.00",
    "Main,Pokemon,Base Set,Pikachu,58,Common,,Ungraded,3,",
  ].join("\n");
  const { rows, missing } = readImport(csv, "magic");
  assert.deepEqual(missing, []);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r) => [r.game, r.name, r.number, r.qty, r.printing, r.paidCents, r.graded]),
    [
      ["pokemon", "Charizard", "4/102", 1, "Holofoil", 35000, false],
      ["pokemon", "Charizard", "4/102", 1, "Holofoil", 90000, true],
      ["pokemon", "Pikachu", "58", 3, "", 0, false],
    ],
  );
  assert.ok(readImport("Name,Qty\nCharizard,1", "pokemon").missing.includes("a set column"));
  assert.equal(readImport("Name,Set\nPokemon Scarlet & Violet 151 Elite Trainer Box,151", "pokemon").rows[0].sealed, true);
});

test("set names: a code prefix or case doesn't matter; two sets that fit is no match", () => {
  const list = [
    { slug: "sv03-obsidian-flames", name: "SV03: Obsidian Flames", abbr: "OBF", released: null, cards: 230 },
    { slug: "base-set", name: "Base Set", abbr: "BS", released: null, cards: 102 },
    { slug: "base-set-2", name: "Base Set 2", abbr: "B2", released: null, cards: 130 },
    { slug: "promo-a", name: "Promos", abbr: null, released: null, cards: 1 },
    { slug: "promo-b", name: "Promos", abbr: null, released: null, cards: 1 },
  ];
  assert.equal(matchSet("Obsidian Flames", list), "sv03-obsidian-flames");
  assert.equal(matchSet("sv03: obsidian flames", list), "sv03-obsidian-flames");
  assert.equal(matchSet("base set", list), "base-set");
  assert.equal(matchSet("OBF", list), "sv03-obsidian-flames");
  assert.equal(matchSet("Promos", list), null);
  assert.equal(matchSet("Nothing Like It", list), null);
});

test("numbers compare without leading zeros; a name must agree", () => {
  assert.equal(numberKey("004/102"), numberKey("4/102"));
  assert.equal(numberKey("#058"), "58");
  assert.equal(numberKey("TG05/TG30"), "TG5/TG30");
  assert.ok(namesAgree("Charizard Holo", "Charizard"));
  assert.ok(!namesAgree("Blastoise", "Charizard"));
});

test("rows match ONE card or none: twins, wrong names, unknown printings and graded rows are refused", () => {
  const row = (o: Partial<ReturnType<typeof readImport>["rows"][number]>) => ({ line: 2, name: "", set: "Base Set", number: "", qty: 1, printing: "", paidCents: 0, game: "pokemon", graded: false, sealed: false, ...o });
  const ok = matchRow(row({ name: "Charizard", number: "4/102", printing: "Holofoil" }), base);
  assert.equal(ok.kind, "card");
  assert.equal(ok.kind === "card" && ok.card.id, 42382);
  const dot = matchRow(row({ name: "Charizard (Black Dot Error)", number: "4/102" }), base);
  assert.equal(dot.kind === "card" && dot.card.id, 657516);
  // Two cards both called just "Charizard" on 4/102: no way to tell them apart, so neither.
  const twin = matchRow(row({ name: "Charizard", number: "4/102" }), { ...base, cards: base.cards.map((c) => (c.id === 657516 ? { ...c, n: "Charizard" } : c)) });
  assert.equal(twin.kind, "miss");
  assert.equal(matchRow(row({ name: "Blastoise", number: "4/102" }), base).kind, "miss");
  assert.equal(matchRow(row({ name: "Pikachu", number: "58", printing: "Shadowless" }), base).kind, "miss");
  assert.equal(matchRow(row({ name: "Charizard", number: "4/102", graded: true }), base).kind, "miss");
  assert.equal(matchRow(row({ name: "Charizard", number: "4/102" }), null).kind, "miss");
  const byName = matchRow(row({ name: "Energy Removal" }), base);
  assert.equal(byName.kind === "card" && byName.printing, "Normal");
  const assumed = matchRow(row({ name: "Pikachu", number: "58/102" }), base);
  assert.ok(assumed.kind === "card" && assumed.assumed && assumed.printing === "Normal");
});

test("an imported row adds with what was paid, and quantities add up", () => {
  const id = cardId({ game: "pokemon", set: "base-set", tcgId: 42500, printing: "Normal" })!;
  let list: VaultItem[] = [];
  list = addItem(list, { id, name: "Pikachu", href: "/collection", market: "US", currency: "USD", addedCents: 500, qty: 3 });
  list = addItem(list, { id, name: "Pikachu", href: "/collection", market: "US", currency: "USD", addedCents: 900, qty: 2 });
  assert.equal(list[0].qty, 5);
  assert.equal(list[0].addedCents, 500);
});

test("install offer: needs an item, a way to install, not already installed, not closed in 30 days", () => {
  const now = Date.parse("2026-11-26T00:00:00Z");
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
  const iosChrome = iphone.replace("Version/18.1", "CriOS/131.0");
  assert.equal(installWay(iphone, false), "ios");
  assert.equal(installWay(iosChrome, false), null);
  assert.equal(installWay("Mozilla/5.0 (Linux; Android 14) Chrome/131.0 Mobile Safari/537.36", true), "native");
  assert.equal(installWay("Mozilla/5.0 (Windows NT 10.0) Firefox/133.0", false), null);
  const base = { items: 3, standalone: false, way: "native" as const, closedAt: null, now };
  assert.equal(shouldOffer(base), true);
  assert.equal(shouldOffer({ ...base, items: 0 }), false);
  assert.equal(shouldOffer({ ...base, standalone: true }), false);
  assert.equal(shouldOffer({ ...base, way: null }), false);
  assert.equal(shouldOffer({ ...base, closedAt: now - 29 * 86_400_000 }), false);
  assert.equal(shouldOffer({ ...base, closedAt: now - 31 * 86_400_000 }), true);
});

test("the app: manifest opens on My collection with PNG icons; the service worker touches only the collection", () => {
  const m = readFileSync(new URL("../src/app/manifest.ts", import.meta.url), "utf8");
  assert.match(m, /start_url: "\/collection/);
  for (const f of ["icon-192.png", "icon-512.png", "maskable-512.png"]) assert.match(m, new RegExp(f.replace(".", "\\.")));
  const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.doesNotMatch(sw, /addEventListener\("(push|sync|periodicsync)"/);
  assert.match(sw, /req\.method !== "GET"\) return/);
  // Every respondWith is behind a collection-only condition; anything else falls through to the network untouched.
  const handler = sw.slice(sw.indexOf('addEventListener("fetch"'));
  assert.equal((handler.match(/respondWith/g) ?? []).length, 4);
  assert.match(handler, /url\.pathname === SHELL/);
  assert.match(handler, /fromCollection\(req\)\) return e\.respondWith\(networkFirst/);
  const view = readFileSync(new URL("../src/components/vault/VaultInstall.tsx", import.meta.url), "utf8");
  assert.match(view, /claimPromptSlot\("app-install"\)/); // the visit's one prompt
  assert.doesNotMatch(view, /window\.open|position:\s*fixed/);
});
