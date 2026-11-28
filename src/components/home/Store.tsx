import Link from "@/components/Link";
import type { ReactNode } from "react";

// The home page as a shop window (owner, 2026-11-28: "it should look more like a store, similar to how TCG Player structures their
// homepage"; DECISIONS.md). A banner hero with the words and the search on one side and today's most-opened products on the other,
// then wide feature banners, then rows of products, each with a kicker, a title and "See all". Server components; the prices inside
// are the existing market-picking islands (Showcase, SealedShelf, DealGrid).

/** The banner hero: words and search left, `aside` (the product window) right from lg up. */
export function StoreHero({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="hero store-hero">
      <div className="store-hero-in">
        <div className="store-hero-copy">{children}</div>
        {aside && <div className="store-hero-aside">{aside}</div>}
      </div>
    </section>
  );
}

/** One wide feature banner: a kicker, a title, one line, one button, and up to three product photos. */
export function FeatureBanner({ href, kicker, title, line, cta, images, tone }: { href: string; kicker: string; title: string; line: string; cta: string; images: { src: string; alt: string }[]; tone: "ink" | "brand" | "warm" }) {
  return (
    <Link href={href} className={`feature-banner feature-${tone}`}>
      <span className="feature-copy">
        <span className="feature-kicker">{kicker}</span>
        <span className="feature-title">{title}</span>
        <span className="feature-line">{line}</span>
        <span className="feature-cta">
          {cta} <span aria-hidden="true">→</span>
        </span>
      </span>
      {images.length > 0 && (
        <span className="feature-art" aria-hidden="true">
          {images.slice(0, 3).map((im, i) => (
            <span key={im.src} className={`feature-plate feature-plate-${i}`}>
              <img src={im.src} alt={im.alt} width={200} height={200} loading="lazy" decoding="async" />
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}

/** A row of products: a small kicker, the row's title (an h2 of the page), a "See all" link, then the products. */
export function Row({ id, kicker, title, href, linkLabel, children }: { id: string; kicker: string; title: string; href: string; linkLabel: string; children: ReactNode }) {
  return (
    <section className="store-row" aria-labelledby={id}>
      <div className="store-row-head">
        <div className="min-w-0">
          <p className="store-row-kicker">{kicker}</p>
          <h2 id={id} className="store-row-title">
            {title}
          </h2>
        </div>
        <Link href={href} className="store-row-all">
          {linkLabel} <span aria-hidden="true">→</span>
        </Link>
      </div>
      {children}
    </section>
  );
}
