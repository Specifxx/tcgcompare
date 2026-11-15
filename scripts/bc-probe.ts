/**
 * One-off, polite look at a BigCommerce shop's server HTML (Game Nerdz): which category pages list products, whether
 * the cards carry title, price and stock, and whether a product page carries JSON-LD. Prints a summary to the log;
 * writes nothing to data/. Uses the same polite session as the crawl (robots.txt obeyed, one request a second).
 */
import { RequestBudget, StoreSession } from "../src/lib/import/polite-http";

const BASE = process.env.BC_BASE ?? "https://www.gamenerdz.com";
const PATHS = (process.env.BC_PATHS ?? "/magic-the-gathering,/pokemon,/sitemap/categories").split(",");

async function main() {
  const s = new StoreSession(BASE, { budget: new RequestBudget(30), perStoreCap: 30 });
  for (const path of PATHS) {
    const html = await s.getText(path);
    console.log(`\n=== ${path}: ${html == null ? "no page" : `${html.length} chars`}`);
    if (!html) continue;
    console.log("json-ld blocks:", (html.match(/application\/ld\+json/g) ?? []).length);
    console.log("product cards (data-test=card / class card):", (html.match(/class="card"/g) ?? []).length, (html.match(/data-product-id/g) ?? []).length);
    console.log("price spans:", (html.match(/price--withoutTax|data-product-price/g) ?? []).length);
    const links = [...html.matchAll(/href="(https?:\/\/[^"]*gamenerdz\.com\/[^"#?]+\/?)"/g)].map((m) => m[1]);
    console.log("sample links:", [...new Set(links)].slice(0, 25).join(" | "));
    const i = html.search(/data-product-id|class="card"/);
    if (i >= 0) console.log("first card html:", html.slice(Math.max(0, i - 200), i + 1800).replace(/\s+/g, " "));
    const next = /rel="next"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*rel="next"/.exec(html);
    console.log("next page link:", next?.[1] ?? next?.[2] ?? "none");
  }
  console.log("\nrequests:", s.requests, "stopped:", JSON.stringify(s.stopped));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
