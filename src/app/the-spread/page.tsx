import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { SITE } from "@/site.config";
import { canon } from "@/lib/site";
import { SPREAD_PATH } from "@/lib/spread";
import { editions } from "@/lib/spread-store";

// The Spread's hub (DECISIONS.md "The Spread"): every edition, newest first. No edition yet is a 404, never a thin page.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "The Spread: monthly sealed TCG price report",
  description: `A monthly report on what independent stores charge for sealed trading card product across six markets, from ${SITE.name}'s own daily store prices. Free to quote.`,
  ...canon(SPREAD_PATH),
};

export default function SpreadHub() {
  const list = editions();
  if (!list.length) notFound();
  return (
    <article className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-black">The Spread</h1>
        <p className="text-muted">
          A monthly report on what independent stores charge for sealed trading card product, in six markets, built only from the store prices {SITE.name} reads every day.
          Each edition has its own permanent page and never changes after it is published.
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {list.map((e) => {
          const us = e.markets.find((m) => m.market === "US");
          return (
            <li key={e.id} className="card-surface p-4">
              <Link className="link text-lg font-bold" href={`${SPREAD_PATH}/${e.id}`}>{e.title}</Link>
              <p className="text-sm text-muted">
                Published {e.published}.{us?.gap ? ` The typical US store charged ${us.gap.toMedian.toFixed(1)}% more than the cheapest for the same product.` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
