// Fetches candidate images from Wikimedia Commons for review, keeping ONLY files Commons marks public domain or CC0
// (owner, 2026-11-14: real game logos on the game tiles, real fantasy art in the hero; nothing we lack the right to).
// Run by .github/workflows/commons-fetch.yml on a claude/* branch push whose subject carries [commons-fetch]; it writes
// assets-candidates/ (index.json + files) to that branch for a person to look at. Nothing here is served by the site.
import { mkdir, writeFile } from "node:fs/promises";

const UA = "tcgprices.app asset review (https://tcgprices.app/about)";
const API = "https://commons.wikimedia.org/w/api.php";
const OK = /^(public domain|pd|cc0)/i;

const LOGOS = [
  ["mtg", "Magic: The Gathering logo"], ["pkm", "Pokémon logo"], ["op", "One Piece logo"], ["ygo", "Yu-Gi-Oh! logo"],
  ["rb", "Riftbound logo"], ["lor", "Lorcana logo"], ["gun", "Gundam logo"], ["ua", "Union Arena logo"],
  ["fw", "Dragon Ball Super logo"], ["dg", "Digimon logo"], ["swu", "Star Wars Unlimited logo"], ["swu2", "Star Wars logo"],
  ["fab", "Flesh and Blood TCG logo"], ["ws", "Weiss Schwarz logo"], ["cfv", "Cardfight Vanguard logo"],
  ["sor", "Sorcery Contested Realm logo"], ["ga", "Grand Archive logo"], ["holo", "hololive logo"], ["gz", "Godzilla logo"],
  ["cp", "Cyberpunk 2077 logo"], ["ff", "Final Fantasy logo"], ["sve", "Shadowverse logo"], ["uvs", "UniVersus logo"],
  ["nar", "Naruto logo"], ["ele", "Elestrals logo"], ["cr", "Cookie Run logo"], ["pal", "Palworld logo"], ["wx", "WIXOSS logo"],
  ["bss", "Battle Spirits logo"], ["ac", "Alpha Clash logo"], ["dbs", "Dragon Ball logo"], ["pkj", "Pokémon Japanese logo"],
];
const ART = [
  ["dragon1", "Saint George dragon painting"], ["dragon2", "Uccello Saint George"], ["dragon3", "Rackham dragon"],
  ["dragon4", "Doré dragon engraving"], ["knight1", "knight armour painting medieval"], ["knight2", "Burne-Jones knight"],
  ["castle1", "castle romantic painting"], ["sword1", "Siegfried Fafner Rackham"], ["wizard1", "Merlin illustration"],
  ["dragon5", "Sigurd Fafnir"], ["dragon6", "Michael archangel dragon painting"], ["fantasy1", "Valkyrie painting"],
];

async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", origin: "*", ...params })) u.searchParams.set(k, String(v));
  const r = await fetch(u, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json();
}

async function candidates(query, width, keep) {
  const s = await api({ action: "query", generator: "search", gsrsearch: query, gsrnamespace: 6, gsrlimit: 15, prop: "imageinfo", iiprop: "url|extmetadata|mime|size", iiurlwidth: width });
  const pages = Object.values(s.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const m = ii.extmetadata ?? {};
    const licence = m.LicenseShortName?.value ?? "";
    if (!OK.test(licence)) continue;
    out.push({ title: p.title, licence, artist: (m.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim(), credit: (m.Credit?.value ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 200), restrictions: m.Restrictions?.value ?? "", page: ii.descriptionurl, mime: ii.mime, w: ii.width, h: ii.height, thumb: ii.thumburl ?? ii.url, original: ii.url });
    if (out.length >= keep) break;
  }
  return out;
}

const index = { at: new Date().toISOString(), logos: {}, art: {} };
for (const [group, list, width, keep] of [["logos", LOGOS, 320, 4], ["art", ART, 1600, 4]]) {
  await mkdir(`assets-candidates/${group}`, { recursive: true });
  for (const [key, q] of list) {
    try {
      const c = await candidates(q, width, keep);
      for (const [i, x] of c.entries()) {
        const r = await fetch(x.thumb, { headers: { "user-agent": UA } });
        if (!r.ok) { x.error = r.status; continue; }
        const ext = (r.headers.get("content-type") ?? "").includes("png") ? "png" : (r.headers.get("content-type") ?? "").includes("svg") ? "svg" : "jpg";
        x.file = `assets-candidates/${group}/${key}-${i}.${ext}`;
        await writeFile(x.file, Buffer.from(await r.arrayBuffer()));
        await new Promise((res) => setTimeout(res, 300));
      }
      index[group][key] = { query: q, candidates: c };
      console.log(group, key, c.length, c.map((x) => `${x.title} [${x.licence}]`).join(" | "));
    } catch (e) {
      index[group][key] = { query: q, error: String(e) };
      console.log(group, key, "ERROR", String(e));
    }
  }
}
await writeFile("assets-candidates/index.json", JSON.stringify(index, null, 1));
