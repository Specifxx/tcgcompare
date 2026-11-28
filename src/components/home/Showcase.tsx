"use client";
// The store hero's product window (owner, 2026-11-28: the home page "should look more like a store, similar to how TCG Player
// structures their homepage"): the three products shoppers open most today, photo first, each with its cheapest price in the
// visitor's market. Every market's price is in the props (one cached page for everyone); the market is picked on hydration, as in
// SealedShelf. Each is one link to its product page, with the quick view's data attributes.
import Link from "@/components/Link";
import { money } from "@/lib/format";
import type { HeroItem } from "@/lib/sealed-hero";
import { useMarket } from "@/components/ClientPrefs";

export function Showcase({ items }: { items: HeroItem[] }) {
  const { market } = useMarket();
  if (!items.length) return null;
  return (
    <ul className="showcase" aria-label="Most popular today">
      {items.map((i, n) => {
        const pr = i.prices[market] ?? null;
        return (
          <li key={i.id} className={`showcase-item showcase-${n}`}>
            <Link href={`/card/${i.slug}`} data-qv={i.slug} data-qv-name={i.name} data-qv-sub={i.set ?? undefined} data-qv-img={i.image ?? undefined} className="showcase-link">
              <span className="showcase-plate">
                {i.image && <img src={i.image} alt={i.name} width={400} height={400} loading={n === 0 ? "eager" : "lazy"} decoding="async" />}
              </span>
              <span className="showcase-cap">
                <span className="showcase-name">{i.name}</span>
                {pr && (
                  <span className="showcase-price">
                    <span className="showcase-from">From</span> {money(pr.cents, pr.currency)}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
