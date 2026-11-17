// After the import: which independent stores' sealed offers came back in stock since the last commit
// (data/public/restocks.json, lib/restocks.ts). Never fatal: a failed diff leaves the last file as it was.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PRICES_DIR } from "../src/lib/price-store";
import { diffRestocks, mergeRestocks, readRestocks, RESTOCKS_FILE, type RestockEvent, type RestockFile } from "../src/lib/restocks";

const now = new Date();
// RESTOCKS_BASE (a commit) and RESTOCKS_AT (ISO) exist for a one-off backfill; the workflow uses neither.
const base = process.env.RESTOCKS_BASE || "HEAD";
const at = process.env.RESTOCKS_AT || now.toISOString();
const fresh: RestockEvent[] = [];
let shards = 0;
for (const f of fs.readdirSync(PRICES_DIR).filter((n) => n.endsWith(".json"))) {
  const rel = path.posix.join("data/public/prices", f);
  let prev: Record<string, { o: never[] }> | undefined;
  try {
    prev = JSON.parse(execFileSync("git", ["show", `${base}:${rel}`], { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).toString());
  } catch {
    continue; // a set with no earlier file: nothing to compare
  }
  const cur = JSON.parse(fs.readFileSync(path.join(PRICES_DIR, f), "utf8"));
  fresh.push(...diffRestocks(prev as never, cur, at));
  shards++;
}
const old = readRestocks()?.events ?? [];
const file: RestockFile = { v: 1, updatedAt: at, events: mergeRestocks(old, fresh, now) };
fs.writeFileSync(RESTOCKS_FILE, JSON.stringify(file));
console.log(`restocks: ${shards} shards compared, ${fresh.length} back in stock this run, ${file.events.length} kept`);
