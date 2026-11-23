import type { Metadata } from "next";
import { SITE } from "@/site.config";
import { canon } from "@/lib/site";
import { meta } from "@/lib/data";
import { MARKET_LABEL } from "@/lib/site-types";
import { kitStoreStatus } from "@/lib/kits";
import { SuggestStore } from "@/components/ReportForms";
import { FoldFinder } from "@/components/FoldFinder";
import { Flag } from "@/components/Flag";

export const revalidate = 86400;
export const metadata: Metadata = { title: `${SITE.gameShort} stores we compare`, description: `Every online ${SITE.game} store ${SITE.name} compares, by country.`, ...canon("/stores") };

/** Stores of a country shown before "Show all": the ones with the most listings matched. */
const FIRST = 12;

// Since 2026-11-23: a store finder, a jump row of the countries and each country folded to its biggest stores (it was one
// bulleted list of every store, 48,000 px on a phone). Every store is still in the HTML, with the same link.
export default function Stores() {
  const m = meta();
  const matched = (key: string) => m?.stores[key]?.matched ?? 0;
  const markets = [...new Set(SITE.stores.map((s) => s.market))];
  const groups = markets.map((mk) => ({ mk, list: SITE.stores.filter((s) => s.market === mk).sort((a, b) => matched(b.key) - matched(a.key) || a.name.localeCompare(b.name)) })).sort((a, b) => (b.mk === "US" ? 1 : 0) - (a.mk === "US" ? 1 : 0) || b.list.length - a.list.length);
  return (
    <div data-ff-root>
      <noscript><style>{`.ff-x{display:flex!important}.ff-box,[data-ff-more]{display:none!important}`}</style></noscript>
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">{SITE.gameShort} stores we compare</h1>
      <div className="prose-site mt-3 max-w-3xl">
        <p>{SITE.stores.length.toLocaleString()} stores in {markets.length} countries, plus TCGplayer and eBay (US, UK, Canada and Australia). Know a store we should compare? <a href="#suggest">Suggest it below</a>. Run one? <a href="/list-your-store">List your store</a>, free. Every store is checked before it is listed and every week after: <a href="/how-we-pick-stores">how we pick stores</a>.</p>
      </div>
      <div className="mt-5 max-w-xl"><FoldFinder placeholder="Find a store by name" noun="stores" /></div>
      <nav aria-label="Jump to a country" className="mt-2">
        <ul className="scroller -mx-4 scroll-px-4 gap-2 px-4 sm:mx-0 sm:px-0">
          {groups.map(({ mk, list }) => (
            <li key={mk}><a href={`#stores-${mk.toLowerCase()}`} className="chip min-h-10 whitespace-nowrap"><Flag code={mk} />{MARKET_LABEL[mk]} <span className="tabular text-xs text-faint">{list.length}</span></a></li>
          ))}
        </ul>
      </nav>
      <div className="mt-8 flex flex-col gap-10">
        {groups.map(({ mk, list }) => (
          <section key={mk} id={`stores-${mk.toLowerCase()}`} data-ff-group className="ff-group scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{MARKET_LABEL[mk]}</h2>
              <span className="text-sm text-muted">{list.length} store{list.length === 1 ? "" : "s"}, most listings first</span>
            </div>
            <ul className="set-list">
              {list.map((s, i) => (
                <li key={s.key} data-ff={s.name.toLowerCase()} className={i >= FIRST ? "set-row ff-x" : "set-row"}>
                  <a href={s.base} rel="noopener nofollow" className="set-row-link">
                    <span className="set-row-name">{s.name}</span>
                    <span className="set-row-meta">{matched(s.key) ? `${matched(s.key).toLocaleString()} listing${matched(s.key) === 1 ? "" : "s"} matched` : "Listed, no match today"}</span>
                  </a>
                </li>
              ))}
            </ul>
            {list.length > FIRST && <button type="button" data-ff-more className="btn-soft mt-4 min-h-11 px-5">Show all {list.length} stores in {MARKET_LABEL[mk]}</button>}
          </section>
        ))}
        {SITE.kits && (
          <section className="prose-site max-w-3xl">
            <h2>{SITE.kits.label} shops</h2>
            <p>For <a href="/kits">{SITE.kits.noun}</a>, matched by the barcode on the box.</p>
            <ul>
              {SITE.kits.stores.map((s) => (
                <li key={s.key}><a href={s.base} rel="noopener nofollow">{s.name}</a> <span className="text-muted">— {MARKET_LABEL[s.market]}{kitStoreStatus()[s.key]?.matched ? `, ${kitStoreStatus()[s.key].matched.toLocaleString()} kits matched` : ""}</span></li>
              ))}
            </ul>
          </section>
        )}
        <section id="suggest" className="prose-site max-w-3xl scroll-mt-24">
          <h2>Suggest a store</h2>
          <p>Tell us about a {SITE.gameShort} store we don&apos;t compare yet. We check every suggestion and add the store if we can read its prices.</p>
          <SuggestStore regions={markets.map((mk) => [mk, MARKET_LABEL[mk]])} what={`${SITE.gameShort} products`} buttonClassName="btn-buy" />
        </section>
      </div>
    </div>
  );
}
