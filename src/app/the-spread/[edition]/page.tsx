import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { JsonLd } from "@/components/JsonLd";
import { SITE } from "@/site.config";
import { canon, SITE_URL } from "@/lib/site";
import { OPEN_LICENCE, OPEN_LICENCE_URL, OPEN_PATHS } from "@/lib/open-data";
import { signed, SPREAD_MIN, SPREAD_MIN_STORES, SPREAD_PATH, type Change, type Edition, type MarketBlock, type Mover } from "@/lib/spread";
import { editionById, editions } from "@/lib/spread-store";

// The Spread (DECISIONS.md "The Spread", 2026-11-20): one frozen monthly edition per URL. The page reads only the
// edition file, so its numbers never change after publication; corrections are listed on the page.
export const revalidate = 86400;
export const dynamicParams = false;
export const generateStaticParams = () => editions().map((e) => ({ edition: e.id }));

const MARKET_NAME: Record<string, string> = { US: "United States", UK: "United Kingdom", CA: "Canada", AU: "Australia", EU: "Euro area", SG: "Singapore" };
const pct = (v: number) => `${v.toFixed(1)}%`;
const money = (cents: number, cur: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(cents / 100);
const longDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function lede(e: Edition) {
  const us = e.markets.find((m) => m.market === "US");
  if (!us?.gap) return `What independent stores charged for sealed trading card product, ${longDate(e.from)} to ${longDate(e.to)}.`;
  return `For the same sealed product on ${longDate(e.gapDate)}, the typical US store charged ${pct(us.gap.toMedian)} more than the cheapest, and the dearest ${pct(us.gap.toDearest)} more (median over ${us.gap.n.toLocaleString("en-US")} products with ${SPREAD_MIN_STORES}+ stores in stock).`;
}

export function generateMetadata({ params }: { params: { edition: string } }): Metadata {
  const e = editionById(params.edition);
  if (!e) return {};
  return { title: `${e.title}: sealed TCG store prices`, description: lede(e), ...canon(`${SPREAD_PATH}/${e.id}`) };
}

const ChangeCells = ({ c }: { c: Change | null }) =>
  c ? (
    <>
      <td className="py-1 pr-3">{pct(c.fell)}</td>
      <td className="py-1 pr-3">{pct(c.rose)}</td>
      <td className="py-1 pr-3">{c.n.toLocaleString("en-US")}</td>
    </>
  ) : (
    <td className="py-1 pr-3 text-muted" colSpan={3}>under {SPREAD_MIN} products</td>
  );

function Movers({ title, rows, cur }: { title: string; rows: Mover[]; cur: string }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <h4 className="mb-1 text-sm font-bold">{title}</h4>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted"><th className="py-1 pr-3">Product</th><th className="py-1 pr-3">Game</th><th className="py-1 pr-3">Cheapest store, start</th><th className="py-1 pr-3">End</th><th className="py-1">Change</th></tr></thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id} className="border-t border-line">
              <td className="py-1 pr-3"><Link className="link" href={`/card/${x.slug}`}>{x.name}</Link></td>
              <td className="py-1 pr-3">{x.game}</td>
              <td className="py-1 pr-3">{money(x.from, cur)}</td>
              <td className="py-1 pr-3">{money(x.to, cur)}</td>
              <td className="py-1">{signed(x.pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketDetail({ m }: { m: MarketBlock }) {
  return (
    <div className="flex flex-col gap-4">
      {m.games.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1 pr-3">Game</th><th className="py-1 pr-3">Typical store vs cheapest</th><th className="py-1 pr-3">Dearest vs cheapest</th><th className="py-1 pr-3">Got cheaper</th><th className="py-1 pr-3">Got dearer</th><th className="py-1 pr-3">Products</th></tr></thead>
            <tbody>
              {m.games.map((g) => (
                <tr key={g.slug} className="border-t border-line">
                  <td className="py-1 pr-3"><Link className="link" href={`/games/${g.slug}`}>{g.name}</Link></td>
                  <td className="py-1 pr-3">{g.gap ? `+${pct(g.gap.toMedian)}` : "–"}</td>
                  <td className="py-1 pr-3">{g.gap ? `+${pct(g.gap.toDearest)}` : "–"}</td>
                  <ChangeCells c={g.change} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {m.types.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1 pr-3">Product type</th><th className="py-1 pr-3">Typical store vs cheapest</th><th className="py-1 pr-3">Dearest vs cheapest</th><th className="py-1 pr-3">Stores in stock (median)</th><th className="py-1">Products</th></tr></thead>
            <tbody>
              {m.types.map((t) => (
                <tr key={t.type} className="border-t border-line">
                  <td className="py-1 pr-3">{t.type}</td>
                  <td className="py-1 pr-3">+{pct(t.gap.toMedian)}</td>
                  <td className="py-1 pr-3">+{pct(t.gap.toDearest)}</td>
                  <td className="py-1 pr-3">{t.gap.stores}</td>
                  <td className="py-1">{t.gap.n.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Movers title="Biggest falls in the cheapest store price" rows={m.falls} cur={m.currency} />
      <Movers title="Biggest rises in the cheapest store price" rows={m.rises} cur={m.currency} />
    </div>
  );
}

export default function SpreadEdition({ params }: { params: { edition: string } }) {
  const e = editionById(params.edition);
  if (!e) notFound();
  const url = `${SITE_URL}${SPREAD_PATH}/${e.id}`;
  const us = e.markets.find((m) => m.market === "US");
  const others = e.markets.filter((m) => m.market !== "US");
  const total = Math.max(...e.markets.map((m) => m.tracked));
  const cite = `${e.title}, ${SITE.name} (${url}), published ${longDate(e.published)}. Store prices only, ${OPEN_LICENCE}.`;
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${e.title}: what stores charged for sealed trading card product`,
    description: lede(e),
    datePublished: e.published,
    dateModified: e.corrections.length ? e.corrections[e.corrections.length - 1].date : e.published,
    url,
    license: OPEN_LICENCE_URL,
    author: { "@type": "Organization", name: SITE.name, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE_URL },
    isBasedOn: `${SITE_URL}${OPEN_PATHS.page}`,
  };

  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <JsonLd data={article} />
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted"><Link className="link" href={SPREAD_PATH}>The Spread</Link> · monthly sealed price report</p>
        <h1 className="font-display text-3xl font-black">{e.title}</h1>
        <p className="text-muted">{lede(e)}</p>
        <p className="text-xs text-muted">Published {longDate(e.published)}. Prices {longDate(e.from)} to {longDate(e.to)}, up to {total.toLocaleString("en-US")} sealed products per market, {e.markets.length} markets, independent stores only.</p>
      </header>

      <section className="flex flex-col gap-3" id="spread">
        <h2 className="text-lg font-bold">The spread: how much the same box costs from store to store</h2>
        <p className="text-sm text-muted">
          For every product at least {SPREAD_MIN_STORES} stores had in stock on {longDate(e.gapDate)}, we compared the cheapest store with the middle store and the dearest store, in that market&apos;s own currency.
          The figure is the median over those products. It is the saving a buyer leaves on the table by buying from a typical store without comparing.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1 pr-3">Market</th><th className="py-1 pr-3">Typical store vs cheapest</th><th className="py-1 pr-3">Dearest vs cheapest</th><th className="py-1 pr-3">Stores in stock (median)</th><th className="py-1">Products</th></tr></thead>
            <tbody>
              {e.markets.map((m) => (
                <tr key={m.market} className="border-t border-line">
                  <td className="py-1 pr-3">{MARKET_NAME[m.market] ?? m.market}</td>
                  {m.gap ? (
                    <>
                      <td className="py-1 pr-3 font-bold">+{pct(m.gap.toMedian)}</td>
                      <td className="py-1 pr-3">+{pct(m.gap.toDearest)}</td>
                      <td className="py-1 pr-3">{m.gap.stores}</td>
                      <td className="py-1">{m.gap.n.toLocaleString("en-US")}</td>
                    </>
                  ) : (
                    <td className="py-1 text-muted" colSpan={4}>under {SPREAD_MIN} products with {SPREAD_MIN_STORES}+ stores</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {e.events.length > 0 && (
        <section className="flex flex-col gap-3" id="sale-days">
          <h2 className="text-lg font-bold">Sale days against the week before</h2>
          <p className="text-sm text-muted">The cheapest in-stock store price of each product on the day, against the same product on the same weekday a week earlier. Only products priced on both days count.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-1 pr-3">Day</th><th className="py-1 pr-3">Market</th><th className="py-1 pr-3">Got cheaper</th><th className="py-1 pr-3">Got dearer</th><th className="py-1 pr-3">Products</th></tr></thead>
              <tbody>
                {e.events.flatMap((ev) =>
                  ev.markets.map((x) => (
                    <tr key={`${ev.label}-${x.market}`} className="border-t border-line">
                      <td className="py-1 pr-3">{ev.label} ({longDate(ev.day)} vs {longDate(ev.vs)})</td>
                      <td className="py-1 pr-3">{x.market}</td>
                      <ChangeCells c={x.change} />
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3" id="month">
        <h2 className="text-lg font-bold">How prices moved over the period</h2>
        <p className="text-sm text-muted">Each product&apos;s cheapest in-stock store price on {longDate(e.from)} against {longDate(e.to)}. A move under half a percent counts as unchanged. &quot;Sold out&quot; is a product some store had in stock at the start that no store we read had at the end.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1 pr-3">Market</th><th className="py-1 pr-3">Got cheaper</th><th className="py-1 pr-3">Got dearer</th><th className="py-1 pr-3">Products</th><th className="py-1">Sold out</th></tr></thead>
            <tbody>
              {e.markets.map((m) => (
                <tr key={m.market} className="border-t border-line">
                  <td className="py-1 pr-3">{MARKET_NAME[m.market] ?? m.market}</td>
                  <ChangeCells c={m.change} />
                  <td className="py-1">{m.soldOut ? `${pct(m.soldOut.pct)} (${m.soldOut.n})` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {e.notes.length > 0 && (
        <section className="flex flex-col gap-2" id="notes">
          <h2 className="text-lg font-bold">Why prices moved</h2>
          {e.notes.map((n, i) => <p key={i} className="text-sm">{n}</p>)}
        </section>
      )}

      {us && (
        <section className="flex flex-col gap-3" id="us">
          <h2 className="text-lg font-bold">United States in detail</h2>
          <MarketDetail m={us} />
        </section>
      )}

      {others.length > 0 && (
        <section className="flex flex-col gap-3" id="markets">
          <h2 className="text-lg font-bold">Other markets in detail</h2>
          {others.map((m) => (
            <details key={m.market} className="card-surface p-3">
              <summary className="cursor-pointer font-bold">{MARKET_NAME[m.market] ?? m.market} ({m.currency})</summary>
              <div className="mt-3"><MarketDetail m={m} /></div>
            </details>
          ))}
        </section>
      )}

      <section className="card-surface flex flex-col gap-2 p-4 text-sm" id="method">
        <h2 className="text-lg font-bold">How this is measured</h2>
        <ul className="list-disc pl-5">
          <li>Prices are read once a day from the public catalogues of independent online stores and matched to the exact product by its TCGplayer product id. How a store gets on the list: <Link className="link" href="/how-we-pick-stores">how we pick stores</Link>; how prices are read: <Link className="link" href="/methodology">methodology</Link>.</li>
          <li>Stores only: no TCGplayer, eBay or Amazon price is in any figure here. In-stock prices only; pre-orders are left out. Each market is measured in its own currency and never converted.</li>
          <li>Every figure is a median over products, each product counted once, so one odd listing cannot move it. A group with fewer than {SPREAD_MIN} products is not shown.</li>
          <li>The cheapest store price can move because a store changed its price or because the cheapest store sold out; the &quot;biggest moves&quot; tables show both. Shipping is not included.</li>
          <li>Nothing is estimated or back-filled. This edition is frozen: its numbers will not change, and any correction is listed below with its date.</li>
          <li>The raw daily data is free: <Link className="link" href={OPEN_PATHS.page}>open price data</Link> ({OPEN_LICENCE}).</li>
        </ul>
        <h3 className="mt-2 font-bold">Quoting this report</h3>
        <p>Free to quote and chart, commercial use included, with a credit linking to this page:</p>
        <pre className="whitespace-pre-wrap rounded bg-surface p-2 text-xs">{cite}</pre>
        <h3 className="mt-2 font-bold">Corrections</h3>
        {e.corrections.length ? (
          <ul className="list-disc pl-5">{e.corrections.map((c, i) => <li key={i}>{longDate(c.date)}: {c.text}</li>)}</ul>
        ) : (
          <p className="text-muted">None so far. Spotted something wrong? <Link className="link" href="/contact">Tell us</Link>.</p>
        )}
      </section>
    </article>
  );
}
