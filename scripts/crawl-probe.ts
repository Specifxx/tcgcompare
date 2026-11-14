// The weekly probe of our own crawl (.github/workflows/crawl-probe.yml; rules in lib/import/crawl.ts): for every
// Shopify store in data/public/stores.json, which of its collections hold a game no sister covers. It reads
// robots.txt and /collections.json (at most three pages) through lib/import/polite-http.ts, and writes
// data/crawl/stores.json (public: hosts, keys, collection handles). It reads no product and no price.
//
// A store's platform comes from the sisters' store lists under SISTER_DIR when they are checked out: one any sister
// lists as WooCommerce, BigCommerce, ShadowPOS and the like is skipped. Otherwise a store counts as Shopify only if
// /collections.json answers JSON. Stores the vetting refused, or on the blocklist, are never probed.
//
// Env: SISTER_DIR, PROBE_BUDGET (8000 requests), PROBE_MAX_MINUTES (100).
import fs from "node:fs";
import path from "node:path";
import { SITE } from "@/site.config";
import type { Market } from "@/lib/site-types";
import { mergeProbe, runProbe, type ProbeStore } from "@/lib/import/crawl-run";
import type { CrawlStore } from "@/lib/import/crawl";
import { SISTERS } from "@/lib/import/sisters";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "data", "crawl", "stores.json");
const readJson = <T>(f: string, fb: T): T => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8")) as T;
  } catch {
    return fb;
  }
};
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

/** host → "shopify" | "other", from every sister store list that is checked out. A host any list calls non-Shopify is "other". */
export function sisterPlatforms(root: string): Map<string, "shopify" | "other"> {
  const out = new Map<string, "shopify" | "other">();
  const note = (base: string, platform: string | undefined) => {
    const h = hostOf(base);
    if (!h) return;
    const p = !platform || platform === "shopify" ? "shopify" : "other";
    if (out.get(h) !== "other") out.set(h, p);
  };
  for (const s of SISTERS) {
    if (!s.stores) continue;
    const file = path.join(root, s.dir, s.stores);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    if (file.endsWith(".json")) {
      for (const st of readJson<{ base?: string; platform?: string }[]>(file, [])) if (st.base) note(st.base, st.platform);
    } else {
      for (const line of text.split("\n")) {
        const b = /base:\s*"([^"]+)"/.exec(line);
        if (b) note(b[1], /platform:\s*"([^"]+)"/.exec(line)?.[1]);
      }
    }
  }
  return out;
}

async function main() {
  const stores = readJson<ProbeStore[]>(path.join(ROOT, "data", "public", "stores.json"), []);
  const blocklist = readJson<Record<string, string>>(path.join(ROOT, "data", "store-blocklist.json"), {});
  const refused = new Set(readJson<{ refused?: { key: string }[] }>(path.join(ROOT, "data", "public", "store-vetting.json"), {}).refused?.map((r) => r.key) ?? []);
  const platforms = process.env.SISTER_DIR ? sisterPlatforms(process.env.SISTER_DIR) : new Map<string, "shopify" | "other">();
  const list = stores.filter((s) => {
    const h = hostOf(s.base);
    return h && blocklist[h] == null && !refused.has(s.key) && platforms.get(h) !== "other" && !/\.myshopify\.com$/.test(h);
  });
  console.log(`[probe] ${list.length} of ${stores.length} stores (${platforms.size} hosts with a known platform)`);
  const minutes = Number(process.env.PROBE_MAX_MINUTES ?? 100);
  const r = await runProbe(
    list.map((s) => ({ ...s, market: s.market as Market })),
    SITE.lines ?? [],
    { budget: Number(process.env.PROBE_BUDGET ?? 8000), perStoreCap: 6, deadline: Date.now() + minutes * 60_000, log: console.log },
  );
  const merged = mergeProbe(readJson<CrawlStore[]>(OUT, []), r);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 1) + "\n");
  const perLine = new Map<string, number>();
  for (const e of merged) perLine.set(e.line, (perLine.get(e.line) ?? 0) + 1);
  console.log(`[probe] ${r.probed.size} stores probed, ${r.blocked.size} blocked us, ${r.requests} requests; ${merged.length} store-game entries: ${[...perLine].map(([k, n]) => `${k} ${n}`).join(", ")}`);
}

if (process.argv[1] && /crawl-probe\.ts$/.test(process.argv[1]))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
