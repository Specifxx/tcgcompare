// Daily step of the open price data (lib/open-data.ts, DECISIONS.md "Open price data"), run by refresh-prices.yml
// after the imports and before the data commit: writes today's basket (US cheapest store price per product, by game)
// to data/open/baskets/<date>.json, chains the Sealed Price Index from the previous day's basket into
// data/open/index.json, and keeps the last 8 baskets. Never fatal in the workflow; safe to run twice in a day.
import fs from "node:fs";
import path from "node:path";
import { openRows, appendDay, type IndexFile } from "@/lib/open-data";
import { meta } from "@/lib/data";

const DIR = path.join(process.cwd(), "data", "open");
const BASKETS = path.join(DIR, "baskets");

type Basket = Record<string, Record<string, number>>;

function main() {
  const date = (meta()?.updatedAt ?? new Date().toISOString()).slice(0, 10);
  fs.mkdirSync(BASKETS, { recursive: true });
  const today: Basket = {};
  for (const r of openRows()) if (r.market === "US") (today[r.gameSlug] ??= {})[String(r.id)] = r.cents;
  if (!Object.keys(today).length) {
    console.log("open-index: no US store prices today, nothing written");
    return;
  }
  const files = fs.readdirSync(BASKETS).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const prevName = [...files].reverse().find((f) => f < `${date}.json`);
  const prev: Basket | null = prevName ? JSON.parse(fs.readFileSync(path.join(BASKETS, prevName), "utf8")) : null;
  let file: IndexFile | null = null;
  try { file = JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8")); } catch { /* first run */ }
  const next = appendDay(file, date, prev, today);
  fs.writeFileSync(path.join(BASKETS, `${date}.json`), JSON.stringify(today));
  fs.writeFileSync(path.join(DIR, "index.json"), JSON.stringify(next, null, 1) + "\n");
  for (const f of files.slice(0, Math.max(0, files.length - 7))) fs.unlinkSync(path.join(BASKETS, f));
  const last = next.days[next.days.length - 1];
  console.log(`open-index: ${date}, ${last.all.n} products, level ${last.all.level}, ${Object.keys(last.games).length} games`);
}
main();
