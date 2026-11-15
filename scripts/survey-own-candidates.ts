// Checks researched candidate shops before they join data/crawl/own-stores.json (survey-own-candidates.yml, a claude/**
// branch push whose subject carries [survey]; never on main, never a commit). For each candidate in SURVEY_FILE it asks
// robots.txt, /meta.json (Shopify's shop meta: currency and country) and /collections.json through
// lib/import/polite-http.ts, the same polite session the crawl uses, and prints one line per shop plus a JSON verdict
// list: ok (Shopify, the market's currency, a collection that holds a game) or why not. It reads no product or price.
//
// Env: SURVEY_FILE (JSON array of { base, name, market? }), SURVEY_BUDGET (3000).
import fs from "node:fs";
import { SITE } from "@/site.config";
import { CURRENCY, type Market } from "@/lib/site-types";
import { lineOfCollection } from "@/lib/import/crawl";
import { eachStore, RequestBudget, StopStore, StoreSession } from "@/lib/import/polite-http";

interface Cand { base: string; name: string; market?: Market }
interface Meta { currency?: string; country?: string; published_products_count?: number; myshopify_domain?: string }

async function main() {
  const file = process.env.SURVEY_FILE ?? "";
  const cands = (JSON.parse(fs.readFileSync(file, "utf8")) as Cand[]).filter((c) => c && c.base);
  const lines = (SITE.lines ?? []).map((l) => ({ id: l.id, crawl: l.crawl ?? l.ownCrawl }));
  const budget = new RequestBudget(Number(process.env.SURVEY_BUDGET ?? 3000));
  const out: Record<string, unknown>[] = [];
  await eachStore(
    cands,
    async (c) => {
      const base = c.base.replace(/\/+$/, "");
      const market = c.market ?? "US";
      const s = new StoreSession(base, { budget, perStoreCap: 6 });
      const row: Record<string, unknown> = { base, name: c.name, market };
      try {
        const m = await s.getJson<Meta>("/meta.json");
        if (!m || !m.myshopify_domain) row.verdict = "not-shopify";
        else {
          Object.assign(row, { currency: m.currency, country: m.country, products: m.published_products_count });
          const cs: { handle: string; title?: string; products_count?: number }[] = [];
          for (let page = 1; page <= 3; page++) {
            const d = await s.getJson<{ collections?: typeof cs }>(`/collections.json?limit=250&page=${page}`);
            const list = Array.isArray(d?.collections) ? d!.collections : null;
            if (!list) break;
            cs.push(...list);
            if (list.length < 250) break;
          }
          const games = new Map<string, number>();
          for (const col of cs) {
            const l = lineOfCollection(col, lines);
            if (l) games.set(l, (games.get(l) ?? 0) + (col.products_count ?? 0));
          }
          row.games = Object.fromEntries(games);
          row.verdict =
            (m.currency ?? "").toUpperCase() !== CURRENCY[market] ? `currency-${m.currency}` : !(m.published_products_count ?? 0) ? "no-products" : games.size === 0 ? "no-game-collection" : "ok";
        }
      } catch (e) {
        if (!(e instanceof StopStore)) throw e;
        row.verdict = `stopped-${e.reason}`;
      }
      if (row.verdict == null) row.verdict = "unreachable";
      console.log(`[survey] ${row.verdict} ${base} ${JSON.stringify({ c: row.currency, n: row.products, g: row.games })}`);
      out.push(row);
    },
    4,
  );
  console.log("SURVEY_JSON_BEGIN");
  console.log(JSON.stringify(out));
  console.log("SURVEY_JSON_END");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
