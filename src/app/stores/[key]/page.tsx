import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { SITE } from "@/site.config";
import { canon, SITE_URL } from "@/lib/site";
import { MARKET_LABEL } from "@/lib/site-types";
import { money } from "@/lib/format";
import { shortName } from "@/lib/names";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { findUsSnippet, storeByKey, storeIndexable, storePath, storeStats } from "@/lib/store-pages";

export const dynamic = "force-dynamic"; // one CDN copy per URL (next.config.js CDN_PAGES), never ISR

// A page per store (DECISIONS.md 2026-11-28, "Store pages and the Find us on TCG Prices link"): what it stocks with us today,
// by game, how often its price is the lowest of its market, and a link it can put on its own site.
export function generateMetadata({ params }: { params: { key: string } }): Metadata {
  const store = storeByKey(params.key);
  if (!store) return {};
  const s = storeStats().get(store.key);
  const where = MARKET_LABEL[store.market];
  const games = s?.games.slice(0, 3).map(([g]) => g) ?? [];
  return {
    title: `${store.name} prices compared (${where}) | ${SITE.name}`,
    description: s?.inStock
      ? `${store.name} has ${s.inStock.toLocaleString("en-US")} sealed products in stock on ${SITE.name} today${games.length ? ` (${games.join(", ")})` : ""}, and the lowest ${where} store price on ${s.lowest.toLocaleString("en-US")} of them. Compare every store.`
      : `${store.name} is one of the ${where} stores ${SITE.name} compares for sealed trading card products.`,
    ...canon(storePath(store.key)),
    ...(storeIndexable(s) ? {} : { robots: { index: false, follow: true } }),
  };
}

export default function StorePage({ params }: { params: { key: string } }) {
  const store = storeByKey(params.key);
  if (!store) notFound();
  const s = storeStats().get(store.key);
  const where = MARKET_LABEL[store.market];
  const snippet = findUsSnippet(store.key, SITE_URL);
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Breadcrumbs items={[{ name: "Stores", href: "/stores" }, { name: store.name }]} />
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{store.name}</h1>
        <p className="mt-2 text-muted">
          A {where} store we compare. <a className="link" href={store.base} rel="noopener nofollow">Visit {store.name}</a>
        </p>
      </div>

      {s && s.inStock > 0 ? (
        <section aria-labelledby="today">
          <h2 id="today" className="mb-3 text-xl font-bold">Today on {SITE.name}</h2>
          <dl className="grid max-w-xl grid-cols-2 gap-3">
            <div className="rounded-xl border border-line p-4"><dt className="text-sm text-muted">Sealed products in stock</dt><dd className="tabular text-2xl font-bold">{s.inStock.toLocaleString("en-US")}</dd></div>
            <div className="rounded-xl border border-line p-4"><dt className="text-sm text-muted">Lowest {where} store price</dt><dd className="tabular text-2xl font-bold">{s.lowest.toLocaleString("en-US")}</dd></div>
          </dl>
          <p className="mt-3 max-w-3xl text-sm text-muted">
            &ldquo;Lowest&rdquo; counts products where this store&apos;s in-stock price is below every other {where} store we read today, in the store&apos;s own currency. TCGplayer, eBay and Amazon are not counted, and a tie counts for nobody.
          </p>
          {s.games.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {s.games.map(([g, n]) => (
                <li key={g} className="chip">{g} <span className="text-muted">· {n}</span></li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="text-muted">We have no in-stock product from {store.name} today. Its listings come back with its next good read.</p>
      )}

      {s && s.lowestPicks.length > 0 && (
        <section aria-labelledby="lowest">
          <h2 id="lowest" className="mb-3 text-xl font-bold">Where {store.name} has the lowest {where} price today</h2>
          <ul className="set-list">
            {s.lowestPicks.map(({ p, cents, currency }) => (
              <li key={p.id} className="set-row">
                <Link href={`/card/${p.slug}`} className="set-row-link">
                  <span className="set-row-name">{shortName(p.name)}</span>
                  <span className="set-row-meta tabular">{money(cents, currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="link-us" className="max-w-3xl">
        <h2 id="link-us" className="mb-2 text-xl font-bold">Run {store.name}? Show your customers</h2>
        <p className="text-sm text-muted">Paste this link anywhere on your site, the footer works well. It opens this page, so shoppers can see the products where you are the lowest price. It is free, and a store is listed whether it links to us or not.</p>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-line p-3 text-sm"><code>{snippet}</code></pre>
      </section>
    </div>
  );
}
