"use client";
// The ad banners (owner, 2026-11-14: "ad banners for amazon / tcgplayer / ebay … at the top of a page - directly under
// the hero"): three calm text banners in one row, eBay, TCGplayer and Amazon, each a tagged search of the game or set the
// page is about. Labelled Ad, no price, no product claim, no brand artwork, nothing floating; the site's own card tokens.
// Browser only, like the inline block: the server sends an empty box of the same height (h-14), so no crawler reads an ad
// and the page never moves (CLS 0).
// Amazon only where its store has our tag (lib/affiliate.ts amazonSearchUrl).
import { useEffect, useState } from "react";
import { amazonSearchUrl, ebaySearchUrl, goHref } from "@/lib/affiliate";
import { useMarket } from "./ClientPrefs";

const BANNER = "group flex h-14 min-w-[210px] flex-1 flex-col justify-center rounded-lg border border-line bg-surface px-3 transition-colors hover:border-ink/40";

/** `query`: the game's (or set's) eBay words, computed on the server (lib/card-ads.ts adSearch). */
export function AdBanners({ ebayQuery, tcgplayerUrl, page, className = "" }: { ebayQuery: string; tcgplayerUrl: string; page: string; className?: string }) {
  const { market } = useMarket();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div aria-hidden="true" className={`h-14 ${className}`} />;
  const ebayMarket = market === "UK" || market === "AU" || market === "CA" ? market : "US";
  const query = ebayQuery.replace(/\s+card$/i, "").trim();
  const amazon = amazonSearchUrl(`${query} booster box`, market);
  const items = [
    { key: "ebay", href: goHref({ url: ebaySearchUrl(`${query} sealed`, ebayMarket), source: "ebay", market: ebayMarket }, undefined, `${page}-banner-ebay`), title: "Sealed on eBay", sub: "New, Buy It Now listings" },
    { key: "tcg", href: goHref({ url: tcgplayerUrl, source: "tcgplayer", market: "US" }, undefined, `${page}-banner-tcg`), title: "Shop TCGplayer", sub: "Thousands of sellers, one cart" },
    ...(amazon ? [{ key: "amazon", href: goHref({ url: amazon, source: "amazon", market }, undefined, `${page}-banner-amazon`), title: "Find it on Amazon", sub: "Sealed boxes and bundles" }] : []),
  ];
  return (
    <aside data-ad="banners" data-ad-page={page} aria-label="Sponsored links to eBay, TCGplayer and Amazon" className={`flex h-14 items-center gap-3 ${className}`}>
      <span className="ad-pill shrink-0">Ad</span>
      <div className="scroller h-14 min-w-0 flex-1 gap-3">
        {items.map((b) => (
          <a key={b.key} href={b.href} rel="sponsored nofollow noopener" target="_blank" className={BANNER}>
            <span className="truncate text-sm font-semibold text-ink group-hover:text-brand">{b.title} →</span>
            <span className="truncate text-xs text-muted">{b.sub}</span>
          </a>
        ))}
      </div>
    </aside>
  );
}
