// Our own crawl of the games no sister site covers (rules in lib/import/crawl.ts), run by refresh-prices.yml and
// trial-import.yml BEFORE the import: reads every collection data/crawl/stores.json names, through
// lib/import/polite-http.ts (robots.txt, our own User-Agent, one request a second per store, two stores at a time, a
// 401/403/429 or challenge stops the store), and writes the listings it found to data/crawl/listings.json
// (git-ignored). It decides nothing about products: the import does (pickId), with the whole catalogue.
//
// A no-op when data/crawl/stores.json is missing or empty. Env: CRAWL_BUDGET (6000 requests a run),
// CRAWL_STORE_CAP (40 a store), CRAWL_MAX_MINUTES (45).
import fs from "node:fs";
import path from "node:path";
import type { Meta } from "@/lib/site-types";
import type { CrawlStore } from "@/lib/import/crawl";
import { runCrawl } from "@/lib/import/crawl-run";

const ROOT = process.cwd();
export const CRAWL_STORES = path.join(ROOT, "data", "crawl", "stores.json");
export const CRAWL_OUT = path.join(ROOT, "data", "crawl", "listings.json");

async function main() {
  fs.rmSync(CRAWL_OUT, { force: true });
  let entries: CrawlStore[] = [];
  try {
    entries = JSON.parse(fs.readFileSync(CRAWL_STORES, "utf8")) as CrawlStore[];
  } catch {}
  if (!Array.isArray(entries) || !entries.length) {
    console.log("[crawl] data/crawl/stores.json is empty or missing: nothing to read (run the Crawl probe workflow)");
    return;
  }
  // Never tried first, then the longest ago (a store that keeps hitting its cap was tried, though never read to the end).
  let seen: Record<string, string> = {};
  try {
    const c = (JSON.parse(fs.readFileSync(path.join(ROOT, "data", "public", "meta.json"), "utf8")) as Meta).crawl;
    seen = { ...(c?.seen ?? {}), ...(c?.tried ?? {}) };
  } catch {}
  const minutes = Number(process.env.CRAWL_MAX_MINUTES ?? 45);
  const run = await runCrawl(entries, {
    budget: Number(process.env.CRAWL_BUDGET ?? 6000),
    perStoreCap: Number(process.env.CRAWL_STORE_CAP ?? 40),
    deadline: Date.now() + minutes * 60_000,
    seen,
    log: console.log,
  });
  fs.mkdirSync(path.dirname(CRAWL_OUT), { recursive: true });
  fs.writeFileSync(CRAWL_OUT, JSON.stringify(run) + "\n");
  const ok = run.stores.filter((s) => s.ok);
  const partial = run.stores.filter((s) => !s.ok && s.partial);
  console.log(`[crawl] ${ok.length} of ${run.stores.length} stores read, ${partial.length} in part (${partial.reduce((a, s) => a + s.listings.length, 0)} listings), ${run.requests}/${run.budget} requests, ${ok.reduce((a, s) => a + s.listings.length, 0)} listings`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
