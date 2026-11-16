import type { Metadata } from "next";
import Link from "@/components/Link";
import { JsonLd } from "@/components/JsonLd";
import { SITE } from "@/site.config";
import { canon, SITE_URL } from "@/lib/site";
import { meta, products, refCents, summaryOf } from "@/lib/data";
import { gameViews } from "@/lib/game-hubs";
import { storesVsTcgplayer } from "@/lib/market-report";
import { changeOver, credit, INDEX_MIN_PRODUCTS, loadIndex, OPEN_LICENCE, OPEN_LICENCE_URL, OPEN_PATHS, openRows, type IndexDay, type IndexPoint } from "@/lib/open-data";
import { indexWidgetSnippet } from "@/lib/open-embed";
import { MARKETS } from "@/lib/site-types";

// Open price data (DECISIONS.md "Open price data", owner go 2026-11-16). Static with a daily refresh like every page.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Free trading card price data: sealed prices and index",
  description: `Free, dated, open data on what independent stores charge for sealed trading card product: a CSV download, a daily Sealed Price Index and an embeddable widget. ${OPEN_LICENCE}, credit ${SITE.name}.`,
  ...canon(OPEN_PATHS.page),
};

const fmt = (v: number | null) => (v == null ? "building" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

function Chart({ days }: { days: IndexDay[] }) {
  if (days.length < 2) return null;
  const pts = days.map((d) => d.all.level);
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const W = 640, H = 160, P = 8;
  const xy = pts.map((v, i) => `${(P + (i / (pts.length - 1)) * (W - 2 * P)).toFixed(1)},${(H - P - ((v - lo) / span) * (H - 2 * P)).toFixed(1)}`).join(" ");
  return (
    <figure className="card-surface p-3">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`All-games sealed price index, ${days[0].d} to ${days[days.length - 1].d}, from ${pts[0]} to ${pts[pts.length - 1]}`} className="h-40 w-full">
        <polyline points={xy} fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" />
      </svg>
      <figcaption className="mt-1 text-xs text-muted">All games, US stores, base 100 on {days[0].d}. Low {lo.toFixed(1)}, high {hi.toFixed(1)}.</figcaption>
    </figure>
  );
}

export default function DataPage() {
  const date = (meta()?.updatedAt ?? new Date().toISOString()).slice(0, 10);
  const rows = openRows();
  const f = loadIndex();
  const days = f?.days ?? [];
  const last = days[days.length - 1];
  const usRows = rows.filter((r) => r.market === "US");
  const marketCounts = MARKETS.map((m) => ({ m, n: rows.filter((r) => r.market === m).length })).filter((x) => x.n);

  const report = products()
    .filter((p) => p.kind === "sealed")
    .map((p) => ({ p, ref: refCents(p.id), best: summaryOf(p.id).best, change30d: null as number | null }));
  const beat = storesVsTcgplayer(report);

  const tracked = gameViews()
    .map((v) => {
      const pick = (d: IndexDay): IndexPoint | undefined => d.games[v.line.slug];
      const pt = last ? pick(last) : undefined;
      return { slug: v.line.slug, name: v.line.name, pt, week: changeOver(days, pick, 7), prod: usRows.filter((r) => r.gameSlug === v.line.slug).length };
    })
    .filter((g) => g.pt && g.pt.n >= INDEX_MIN_PRODUCTS)
    .sort((a, b) => (b.pt?.n ?? 0) - (a.pt?.n ?? 0));
  const allWeek = changeOver(days, (d) => d.all, 7);
  const c = credit();

  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${SITE.name} sealed trading card store prices`,
    description: "The cheapest in-stock store price for each sealed trading card product (booster boxes, decks, tins, collections) in each market, in the store's own currency, updated daily, with a chained Sealed Price Index.",
    url: `${SITE_URL}${OPEN_PATHS.page}`,
    license: OPEN_LICENCE_URL,
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: SITE.name, url: SITE_URL },
    dateModified: date,
    temporalCoverage: `${f?.base ?? date}/..`,
    measurementTechnique: "Prices read once a day from the public catalogues of independent online stores, matched to the exact product by TCGplayer product id.",
    distribution: [
      { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE_URL}${OPEN_PATHS.csv}` },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE_URL}${OPEN_PATHS.index}` },
    ],
  };

  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <JsonLd data={dataset} />
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-black">Free sealed trading card price data</h1>
        <p className="text-muted">
          What independent stores charge for booster boxes, decks, tins and collections, for {gameViews().length} trading card games, free to download, chart and quote.
          Updated {date}. Licence {OPEN_LICENCE}: use it for anything, commercial included, with a visible credit linking to {SITE.name}.
        </p>
      </header>

      <section className="card-surface flex flex-col gap-3 p-4" id="download">
        <h2 className="text-lg font-bold">Download</h2>
        <ul className="list-disc pl-5 text-sm">
          <li><a className="link" href={OPEN_PATHS.csv} download>sealed-prices.csv</a>: {rows.length.toLocaleString("en-US")} rows, one per product and market ({marketCounts.map((x) => `${x.m} ${x.n.toLocaleString("en-US")}`).join(", ")}). Opens in Excel and Google Sheets.</li>
          <li><a className="link" href={OPEN_PATHS.index}>price-index.json</a>: the Sealed Price Index, one point a day, all games and each game with {INDEX_MIN_PRODUCTS}+ products.</li>
          <li><a className="link" href="/prices.json">prices.json</a>: every product&apos;s cheapest in-stock price per market as JSON for bots and tools (this older file also counts TCGplayer&apos;s price; the CSV above is stores only).</li>
        </ul>
        <p className="text-xs text-muted">Columns: {`tcgplayer_product_id, game, set, product, product_type, market, currency, cheapest_store_price, stores_in_stock, url, date`}. Prices are in the store&apos;s own currency and never converted.</p>
      </section>

      <section className="flex flex-col gap-3" id="index">
        <h2 className="text-lg font-bold">Sealed Price Index</h2>
        <p className="text-sm text-muted">
          One number for how store prices of sealed product are moving. Each day&apos;s level is yesterday&apos;s times the median price ratio of the products priced on both days, US stores, equal weight per product,
          100 on {f?.base ?? date}. New products enter the basket without moving the level, and pre-orders are left out.
        </p>
        <div className="card-surface flex flex-wrap items-baseline gap-x-6 gap-y-1 p-4">
          <div><div className="text-xs font-bold uppercase tracking-wide text-muted">All games, today</div><div className="text-3xl font-black">{last ? last.all.level.toFixed(1) : "100.0"}</div></div>
          <div><div className="text-xs font-bold uppercase tracking-wide text-muted">7 days</div><div className="text-xl font-bold">{fmt(allWeek)}</div></div>
          <div><div className="text-xs font-bold uppercase tracking-wide text-muted">Products</div><div className="text-xl font-bold">{last ? last.all.n.toLocaleString("en-US") : usRows.length.toLocaleString("en-US")}</div></div>
          <div><div className="text-xs font-bold uppercase tracking-wide text-muted">Days recorded</div><div className="text-xl font-bold">{days.length}</div></div>
        </div>
        <Chart days={days} />
        {days.length < 2 && <p className="text-xs text-muted">The index began on {f?.base ?? date}. The chart and the 7-day change fill in as each day is added; nothing is back-filled or estimated.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1 pr-3">Game</th><th className="py-1 pr-3">Level</th><th className="py-1 pr-3">7 days</th><th className="py-1 pr-3">Products</th><th className="py-1">Median US store price</th></tr></thead>
            <tbody>
              {tracked.map((g) => (
                <tr key={g.slug} className="border-t border-line">
                  <td className="py-1 pr-3"><Link className="link" href={`/games/${g.slug}`}>{g.name}</Link></td>
                  <td className="py-1 pr-3">{g.pt!.level.toFixed(1)}</td>
                  <td className="py-1 pr-3">{fmt(g.week)}</td>
                  <td className="py-1 pr-3">{g.pt!.n}</td>
                  <td className="py-1">${(g.pt!.median / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {beat.compared > 0 && (
          <p className="text-sm text-muted">
            Today, of {beat.compared.toLocaleString("en-US")} sealed products with a TCGplayer market price of $5 or more, a US store sells {beat.storeCheaper.toLocaleString("en-US")} below it
            {beat.medianSaving != null ? `, by a median ${beat.medianSaving}%` : ""}.
          </p>
        )}
      </section>

      <section className="card-surface flex flex-col gap-3 p-4" id="widget">
        <h2 className="text-lg font-bold">Embed the index</h2>
        <p className="text-sm text-muted">A small card with the level, the week&apos;s change and the credit link, for a blog, a Discord page or a newsletter archive. Replace <code>all</code> with a game: {gameViews().slice(0, 4).map((v) => v.line.slug).join(", ")}…{" "}
          <a className="link" href="/embed/price-index/all">See it running →</a></p>
        <pre className="overflow-x-auto rounded bg-ink-900 p-3 text-xs"><code>{indexWidgetSnippet(SITE_URL, SITE.name, "all", "Sealed price index")}</code></pre>
      </section>

      <section className="flex flex-col gap-2" id="terms">
        <h2 className="text-lg font-bold">Where it comes from, and what it leaves out</h2>
        <ul className="list-disc pl-5 text-sm text-muted">
          <li>Prices are read once a day from the public product catalogues of the independent online stores listed on <Link className="link" href="/stores">/stores</Link>, and kept only when we can match the listing to one exact product. When in doubt it is left out. Store prices are facts the stores publish; the selection, matching and index are ours. See <Link className="link" href="/methodology">how our prices work</Link>.</li>
          <li>Only in-stock, new, non-pre-order store prices, one row per product and market (the cheapest, with the count of stores that have it in stock). Prices are the listing price: shipping and tax are not included.</li>
          <li>Not included, on purpose: TCGplayer, eBay and Amazon prices and photos belong to their owners&apos; terms, and no store names or store links, so the file credits the comparison and cannot be used as a map of the stores. TCGplayer&apos;s product id is the join key.</li>
          <li>The index is a record from {f?.base ?? date} on. It is never back-filled, and a day the import fails is a gap, not a guess.</li>
          <li>Credit: <code>{c.attributionHtml}</code>. Questions or a bigger export: <a className="link" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.</li>
        </ul>
        <p className="text-xs text-muted">{SITE.name} is not affiliated with any game publisher, store or marketplace named in the data.</p>
      </section>
    </article>
  );
}
