"use client";
// The price rows: every offer for the visitor's market, cheapest in-stock
// first, each with a tracked buy button. TCGplayer and eBay US stay listed in
// every market as the reference ("≈" converted at the day's ECB rate).
// Out-of-stock rows fold behind a button, as on RiftCompare: they are the
// last thing a buyer needs and used to push the live prices off the screen.
// Row order is lib/price-rows.ts, shared with the phone buy block.
import { Fragment, useState } from "react";
import { AmazonPrice, AMAZON_PRICE_DISCLAIMER } from "./AmazonPrice";
import type { AmazonCell } from "@/lib/amazon-live";
import { SITE } from "@/site.config";
import { CURRENCY, MARKETS, MARKET_LABEL, type Market, type Offer } from "@/lib/site-types";
import { money } from "@/lib/format";
import { Flag } from "./Flag";
import { ebaySearchUrl, goHref, isPaidSource, subId, tagged } from "@/lib/affiliate";
import { CartAddButton } from "./cart/CartAddButton";
import { priceRows } from "@/lib/price-rows";
import { useMarket } from "./ClientPrefs";
import { ReportPrice } from "./ReportForms";
import { StoreVote } from "./StoreVote";

const NAMES: Record<string, string> = {
  tcgplayer: "TCGplayer",
  ebay: "eBay",
  ...Object.fromEntries(SITE.stores.map((s) => [s.key, s.name])),
  ...Object.fromEntries((SITE.kits?.stores ?? []).map((s) => [s.key, s.name])),
};

export function sourceName(o: Offer) {
  if (o.source === "ebay") return o.market === "US" ? "eBay" : `eBay ${o.market}`;
  return NAMES[o.source] ?? o.source;
}

/**
 * The pinned rows' classes. Until 2026-11-12 each drew an outline (eBay green, Amazon amber, the cheapest sky blue; owner, 2026-11-06
 * and 11-07). The owner then found "all the colored rows" too much and left the design to us (DECISIONS.md, "A calmer price table"):
 * the rows are plain rows again, in the same order with the same tags and links. The keys stay as hooks and draw nothing. Since
 * 2026-11-14 (owner: "don't highlight the cheapest price") no row is marked: no tint, no "Best price" badge, no "Buy now" button.
 */
export const PIN_OUTLINE = {
  ebay: "",
  amazon: "",
  cheapest: "",
} as const;

/** Where the phone's sticky buy bar hides (components/CardBuy.tsx). */
export const PRICE_TABLE_ID = "price-comparison";

export function PriceTable({ ebayQuery, tcgUrl, offers, fx, productId, page, compact = false, amazon = null, tableId = PRICE_TABLE_ID, product, image = null, cartTitle }: { /** this site's eBay row when the data holds no eBay listing: a tagged search for exactly this product (owner, 2026-11-14: no eBay API here, "but we obviously want to make eBay money") */ ebayQuery?: string; /** TCGplayer's own page for this product: a pinned "Check TCGplayer" row when the data holds no TCGplayer price (owner, 2026-11-14) */ tcgUrl?: string; /** the product's picture, for the cart list (components/cart) */ image?: string | null; offers: Offer[]; fx: Record<string, number>; productId: number; page: string; compact?: boolean; amazon?: Partial<Record<Market, string | AmazonCell>> | null; /** null in the quick view: the page's own table keeps the id the buy bar watches */ tableId?: string | null; /** the product's name: shows "Report a wrong price" under the table */ product?: string; /** the cart's line title where `product` is left out (the quick view) */ cartTitle?: string }) {
  const { market, setMarket } = useMarket();
  const [showOut, setShowOut] = useState(false);
  // eBay and TCGplayer lead the table (lib/price-rows.ts `display`); no row is
  // marked as the cheapest (owner, 2026-11-14). No
  // wording about the order (owner, 2026-10-30): the paid rows are simply first.
  // Amazon (a tagged search of the market's own Amazon, only where that store has
  // our tag: lib/affiliate.ts) comes third, right under the pinned eBay and
  // TCGplayer rows (owner, 2026-11-03: "the third row out of the three"), or
  // first when neither is shown: no price, never ranked, never the cheapest.
  // Both are drawn exactly like a store row, tagged "Ad" (owner, 2026-11-01:
  // "blend in and look exactly the same as the other price rows").
  // Since 2026-11-06 (owner: "eBay prices and Amazon prices should function exactly
  // like a normal store price row … add to cart … if it's in stock … it just sits on
  // the very top. And it has a different colored outline"): eBay is always the first
  // row with a green outline, Amazon the second with an amber one, and both carry the
  // store row's thumbs and cart button (lib/cart-list.ts: manual lines on their tagged
  // links). With no Amazon price there is no row (owner, 2026-11-12).
  const { inStock, refs, outOfStock, display, pinned } = priceRows(offers, market);
  const rows = display;
  const cur = CURRENCY[market];
  const conv = (o: Offer) => (o.currency === cur ? null : Math.round((o.cents / (fx[o.currency] ?? 1)) * (fx[cur] ?? 1)));
  // DexCompare's conversion layout (its buy-click rate is the family's highest, ~44%): the market the prices are for is stated and
  // switchable right above the rows, every store row says "View deal" (owner, 2026-11-14: no row highlighted as the cheapest).
  const storesIn = new Set(inStock.filter((o) => o.source !== "tcgplayer" && o.source !== "ebay").map((o) => o.source)).size;
  const picker = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-raised px-3 py-2 text-xs text-muted" data-market-bar>
      <span>
        Prices for <Flag code={market} /> <b className="text-ink">{MARKET_LABEL[market]}</b>
        {storesIn > 0 && <> · {storesIn} store{storesIn === 1 ? "" : "s"} in stock</>}
      </span>
      {!compact && <span className="flex flex-wrap gap-1" role="group" aria-label="Show prices for">
        {MARKETS.map((m) => (
          <button key={m} type="button" onClick={() => setMarket(m)} aria-pressed={m === market} className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors ${m === market ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink hover:border-ink/30"}`}>
            <Flag code={m} />{m}
          </button>
        ))}
      </span>}
    </div>
  );
  // eBay is always the first row. With no eBay listing in the data it is a tagged search of the visitor's own eBay
  // (the US site where eBay has none for the market), labelled Ad, with no price claimed.
  const ebayMarket = market === "UK" || market === "AU" || market === "CA" ? market : "US";
  const ebaySearchRow = ebayQuery && !pinned.some((o) => o.source === "ebay") ? (
    <tr data-ebay-search-row className="border-t border-line">
      <td className="px-3 py-2.5">
        <span className="font-medium text-ink">{ebayMarket === "US" ? "eBay" : `eBay ${ebayMarket}`}</span>
        <span className="ad-pill ml-2">Ad</span>
      </td>
      <td className="hidden px-3 py-2.5 text-xs text-muted sm:table-cell">New and sealed listings, cheapest first</td>
      <td className="px-3 py-2.5 text-right text-xs text-muted">See prices</td>
      <td className="px-3 py-2.5 text-right">
        <a href={goHref({ url: ebaySearchUrl(ebayQuery, ebayMarket), source: "ebay", market }, productId, `${page}_pinned_search`, { pos: 1 })} rel="sponsored nofollow noopener" target="_blank" className="btn-primary min-h-10 whitespace-nowrap px-3 py-1.5">
          Check eBay <span aria-hidden="true">↗</span>
        </a>
      </td>
    </tr>
  ) : null;
  // TCGplayer is always the second pinned row: with no TCGplayer price in the data, a link to its own page for this product,
  // with no price claimed (owner, 2026-11-14: "Same for tcgplayer").
  const tcgSearchRow = tcgUrl && !pinned.some((o) => o.source === "tcgplayer") ? (
    <tr data-tcg-search-row className="border-t border-line">
      <td className="px-3 py-2.5">
        <span className="font-medium text-ink">TCGplayer</span>
      </td>
      <td className="hidden px-3 py-2.5 text-xs text-muted sm:table-cell">Sealed listings on TCGplayer</td>
      <td className="px-3 py-2.5 text-right text-xs text-muted">See prices</td>
      <td className="px-3 py-2.5 text-right">
        <a href={goHref({ url: tcgUrl, source: "tcgplayer", market }, productId, `${page}_pinned_search`, { pos: ebaySearchRow ? 2 : 1 })} rel="sponsored nofollow noopener" target="_blank" className="btn-tcg min-h-10 whitespace-nowrap px-3 py-1.5">
          Check TCGplayer <span aria-hidden="true">↗</span>
        </a>
      </td>
    </tr>
  ) : null;
  if (!rows.length)
    return (
      <div className="overflow-hidden rounded-xl border border-dashed border-line">
        {picker}
        {(ebaySearchRow || tcgSearchRow) && <table className="w-full text-sm"><tbody>{ebaySearchRow}{tcgSearchRow}</tbody></table>}
        <p className="p-4 text-sm text-muted">No store listings in {MARKET_LABEL[market]} right now. Try another market above{ebaySearchRow || tcgSearchRow ? ", or check the links above" : ""}.</p>
        {product && <div className="px-4 pb-3"><ReportPrice product={product} region={market} buttonClassName="btn-ghost px-3 py-1.5" /></div>}
      </div>
    );
  const live = [...inStock, ...refs];
  // Out-of-stock rows show when asked, or when nothing is in stock at all.
  const unfold = showOut || live.length === 0;
  const shown = compact ? rows.slice(0, 6) : unfold ? rows : rows.filter((o) => live.includes(o));
  const folded = compact ? 0 : unfold ? 0 : outOfStock.length;
  // A string is the tagged search; a cell (lib/amazon-live.ts) is the item's own page, with this build's price while under 24 hours old.
  const amazonCell = amazon?.[market];
  const amazonUrl = typeof amazonCell === "string" ? amazonCell : amazonCell?.url;
  const amazonLive = typeof amazonCell === "object" ? amazonCell.live : undefined;
  const amazonCart = amazonUrl && amazonLive?.cents ? { href: tagged(amazonUrl, subId(market, `${page}_cart`, productId)), productUrl: amazonUrl, storeName: "Amazon", title: product ?? "", priceCents: amazonLive.cents, currency: amazonLive.currency ?? cur, image } : null;
  const amazonRow = amazonUrl && amazonLive ? (
    <tr data-amazon-row className={`border-t border-line ${PIN_OUTLINE.amazon}`}>
      <td className="px-3 py-2.5">
        <span className="font-medium text-ink">Amazon</span>
        <StoreVote url={amazonUrl} name="Amazon" className="ml-2 text-muted" />
        {amazonCart && <span className="block sm:hidden"><CartAddButton {...amazonCart} inline className="text-xs" /></span>}
        <span className="ad-pill ml-2">Ad</span>
      </td>
      <td className="hidden px-3 py-2.5 text-xs text-muted sm:table-cell">New, in stock on Amazon</td>
      <td className="px-3 py-2.5 text-right font-semibold tabular-nums"><AmazonPrice {...amazonLive} /></td>
      <td className="px-3 py-2.5 text-right">
        <span className="inline-flex items-center justify-end gap-2">
          {amazonCart && <CartAddButton {...amazonCart} className="hidden text-muted sm:inline-flex" />}
          <a href={goHref({ url: amazonUrl, source: "amazon", market }, productId, `${page}_pinned`)} rel="sponsored nofollow noopener" target="_blank" className="btn-soft min-h-10 whitespace-nowrap px-3 py-1.5">
            View deal <span aria-hidden="true">↗</span>
          </a>
        </span>
      </td>
    </tr>
  ) : null;
  // Amazon is the second row, right under eBay (first when there is no eBay row).
  // Click log context (DECISIONS.md, 2026-11-17): a row's position in the table, and its item-price gap to the cheapest in-stock store in its own currency.
  const rowsAbove = [ebaySearchRow, pinned.some((o) => o.source === "ebay") ? null : tcgSearchRow, amazonRow && shown.findIndex((o) => o.source === "ebay" && pinned.includes(o)) < 0 ? amazonRow : null].filter(Boolean).length;
  const storeCents = (cur2: string) => shown.filter((x) => x.inStock && x.currency === cur2 && !isPaidSource(x.source) && x.cents > 0).map((x) => x.cents);
  const gapOf = (o: Offer): number | null => {
    const c = storeCents(o.currency);
    return o.inStock && o.cents > 0 && c.length ? ((o.cents - Math.min(...c)) / Math.min(...c)) * 100 : null;
  };
  const amazonAfter = shown.findIndex((o) => o.source === "ebay" && pinned.includes(o));
  return (
    <div id={tableId ?? undefined} className="card overflow-hidden">
      {picker}
      <table className="w-full text-sm">
        <thead className="bg-raised text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2">Store</th>
            <th className="hidden px-3 py-2 sm:table-cell">Details</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2"><span className="sr-only">Buy</span></th>
          </tr>
        </thead>
        <tbody>
          {ebaySearchRow}
          {/* TCGplayer's link row sits right under eBay; a priced TCGplayer row is already the second pinned row. */}
          {pinned.some((o) => o.source === "ebay") ? null : tcgSearchRow}
          {amazonAfter < 0 && amazonRow}
          {shown.map((o, i) => {
            const c = conv(o);
            return (
              <Fragment key={i}>
                <tr className={`border-t border-line ${o.inStock ? "" : "opacity-60"} ${o.source === "ebay" && pinned.includes(o) ? PIN_OUTLINE.ebay : ""}`}>
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-ink">{sourceName(o)}</span>
                    <StoreVote url={o.url} name={sourceName(o)} className="ml-2 text-muted" />
                    {/* Phones: the cart list's add button as a line under the store, where the row has no width to spare. */}
                    {o.inStock && o.source !== "tcgplayer" && (
                      <span className="block sm:hidden"><CartAddButton href={tagged(o.url, subId(o.market, `${page}_cart`, productId), { checkout: true })} productUrl={o.url} storeName={sourceName(o)} title={product ?? cartTitle ?? o.title} detail={o.printing && o.printing !== "Normal" ? o.printing : null} priceCents={o.cents} currency={o.currency} image={image} inline className="text-xs" /></span>
                    )}
                    {o.source === "ebay" && <span className="ad-pill ml-2">Ad</span>}
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs text-muted sm:table-cell">
                    {o.printing && o.printing !== "Normal" && <span className="tag mr-1">{o.printing}</span>}
                    {o.preorder && <span className="tag mr-1 border-pre text-pre">Pre-order</span>}
                    {!o.inStock && <span className="tag mr-1">Out of stock</span>}
                    {o.source === "tcgplayer" && <span>Lowest listing</span>}
                    {o.shippingCents != null && <span>+{money(o.shippingCents, o.currency)} shipping</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                    {money(o.cents, o.currency)}
                    {c != null && <span className="block text-xs font-normal text-muted">{o.source === "tcgplayer" ? "" : "≈ "}{money(c, cur)}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {/* The cart list (components/cart, owner 2026-11-06): an in-stock store row, beside its button. */}
                    <span className="inline-flex items-center justify-end gap-2">
                    {o.inStock && o.source !== "tcgplayer" && (
                      <CartAddButton href={tagged(o.url, subId(o.market, `${page}_cart`, productId), { checkout: true })} productUrl={o.url} storeName={sourceName(o)} title={product ?? cartTitle ?? o.title} detail={o.printing && o.printing !== "Normal" ? o.printing : null} priceCents={o.cents} currency={o.currency} image={image} className="hidden text-muted sm:inline-flex" />
                    )}
                    <a href={goHref(o, productId, pinned.includes(o) ? `${page}_pinned` : page, { pos: i + 1 + rowsAbove + (amazonAfter >= 0 && i > amazonAfter && amazonRow ? 1 : 0), gapPct: gapOf(o) })} rel="sponsored nofollow noopener" target="_blank" className={`min-h-10 whitespace-nowrap ${o.source === "tcgplayer" && o.inStock ? "btn-tcg px-3 py-1.5" : pinned.includes(o) && o.inStock ? "btn-primary px-3 py-1.5" : o.inStock ? "btn-soft px-3 py-1.5" : "btn-ghost px-3 py-1.5 opacity-80"}`}>
                      {o.inStock ? "View deal" : "View"} <span aria-hidden="true">↗</span>
                    </a>
                    </span>
                  </td>
                </tr>
                {i === amazonAfter && amazonRow}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {amazonLive && <p className="border-t border-ink-800 px-3 py-2 text-[11px] text-muted">* Amazon price: {AMAZON_PRICE_DISCLAIMER}</p>}
      {folded > 0 && (
        <button type="button" onClick={() => setShowOut(true)} className="w-full border-t border-line px-3 py-2.5 text-left text-sm text-muted hover:bg-raised hover:text-ink">
          Show {folded} out-of-stock listing{folded === 1 ? "" : "s"} ↓
        </button>
      )}
      {product && !compact && (
        <div className="border-t border-line px-3 pb-3 text-muted">
          <ReportPrice product={product} region={market} buttonClassName="btn-ghost px-3 py-1.5" stores={rows.filter((o) => o.source !== "ebay" && o.source !== "tcgplayer").map((o) => ({ name: sourceName(o), price: money(o.cents, o.currency) }))} />
        </div>
      )}
    </div>
  );
}

/** The cheapest in-stock price for the visitor's market, for tiles. */
export function LocalPrice({ offers, fallbackUsd }: { offers: Offer[]; fallbackUsd: number | null }) {
  const { market } = useMarket();
  const o = offers.find((x) => x.market === market && x.inStock);
  if (o) return <span>{money(o.cents, o.currency)}</span>;
  return <span>{money(fallbackUsd, "USD")}</span>;
}
