// Reads the frozen editions of The Spread (lib/spread.ts) from data/spread/<yyyy-mm>.json. Pages read only these files.
import fs from "node:fs";
import path from "node:path";
import type { Edition } from "./spread";

const DIR = path.join(process.cwd(), "data", "spread");
let cache: Edition[] | null = null;

/** Every published edition, newest first. */
export function editions(): Edition[] {
  if (cache) return cache;
  let files: string[] = [];
  try { files = fs.readdirSync(DIR).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)); } catch { /* none yet */ }
  cache = files
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Edition)
    .filter((e) => e.v === 1)
    .sort((a, b) => b.id.localeCompare(a.id));
  return cache;
}

export const editionById = (id: string) => editions().find((e) => e.id === id) ?? null;
