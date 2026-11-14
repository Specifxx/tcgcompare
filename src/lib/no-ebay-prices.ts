// TCG Prices has no eBay prices (owner, 2026-11-14): eBay is the first pinned row of every product as a tagged search,
// with no price claimed. An eBay offer must never reach the published data, a price row, "Best price" or a
// "Cheapest in" box. Script-side: the ops monitor and tests/no-ebay-prices.test.ts read the files with this.
import fs from "node:fs";
import path from "node:path";

/** Count the eBay offer tuples (and eBay picks) in data/public: every one is a breach of the rule. */
export function ebayPricesIn(publicDir: string): { offers: number; products: number; picks: number } {
  let offers = 0;
  const products = new Set<string>();
  const dir = path.join(publicDir, "prices");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
  for (const f of files) {
    const shard = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Record<string, { o?: unknown[][] }>;
    for (const [id, e] of Object.entries(shard)) {
      const n = (e.o ?? []).filter((t) => Array.isArray(t) && t[0] === "ebay").length;
      if (n) {
        offers += n;
        products.add(id);
      }
    }
  }
  const summaryFile = path.join(publicDir, "summary.json");
  if (fs.existsSync(summaryFile)) {
    const summary = JSON.parse(fs.readFileSync(summaryFile, "utf8")) as Record<string, { b?: unknown[][]; e?: unknown[][] }>;
    for (const [id, e] of Object.entries(summary)) {
      const n = [...(e.b ?? []), ...(e.e ?? [])].filter((t) => Array.isArray(t) && t[0] === "ebay").length;
      if (n) {
        offers += n;
        products.add(id);
      }
    }
  }
  const picksFile = path.join(publicDir, "ebay-picks.json");
  const picks = fs.existsSync(picksFile) ? (JSON.parse(fs.readFileSync(picksFile, "utf8")) as unknown[]).length : 0;
  return { offers, products: products.size, picks };
}

export function ebayPriceVerdict(publicDir: string): { status: "ok" | "fail"; detail: string } {
  const { offers, products, picks } = ebayPricesIn(publicDir);
  return offers || picks
    ? { status: "fail", detail: `${offers} eBay prices on ${products} products and ${picks} eBay picks in data/public: eBay must be a link only` }
    : { status: "ok", detail: "no eBay price in the published data" };
}
