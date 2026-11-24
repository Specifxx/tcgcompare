import type { Metadata } from "next";
import Link from "@/components/Link";
import { SITE } from "@/site.config";
import { canon } from "@/lib/site";
import { productById } from "@/lib/data";
import { readRestocks } from "@/lib/restocks";
import { CURRENCY } from "@/lib/site-types";
import { money } from "@/lib/format";
import { shortName } from "@/lib/names";
import { TELEGRAM_URL } from "@/components/DiscordCta";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Back in stock: sealed trading card product at independent stores",
  description: "Booster boxes, bundles and decks that were sold out at an independent store and are in stock again, from our twice-daily store checks. Compare every store before you buy.",
  ...canon("/restocks"),
  alternates: { canonical: "/restocks", types: { "application/rss+xml": "/restocks.xml" } },
};

const DAY = 86_400_000;
export default function Restocks() {
  const file = readRestocks();
  const stores = new Map(SITE.stores.map((s) => [s.key, s]));
  const rows = (file?.events ?? [])
    .map((e) => ({ e, p: productById(e.p), s: stores.get(e.s) }))
    .filter((r): r is { e: typeof r.e; p: NonNullable<typeof r.p>; s: NonNullable<typeof r.s> } => !!r.p && !!r.s);
  const cut = (file ? Date.parse(file.updatedAt) : 0) - DAY * 2;
  const recent = rows.filter((r) => Date.parse(r.e.t) >= cut);
  const earlier = rows.filter((r) => Date.parse(r.e.t) < cut);
  const list = (items: typeof rows) => (
    <ol className="card-surface divide-y divide-ink-800">
      {items.slice(0, 60).map((r) => (
        <li key={`${r.e.p}|${r.e.s}|${r.e.r}|${r.e.t}`} className="flex items-center justify-between gap-3 p-3 text-sm">
          <Link className="min-w-0 flex-1 truncate hover:underline" href={`/card/${r.p.slug}`}>{shortName(r.p.name)}</Link>
          <span className="shrink-0 text-muted">{r.s.name}</span>
          <span className="shrink-0 tabular-nums">{money(r.e.c, CURRENCY[r.s.market])}</span>
        </li>
      ))}
    </ol>
  );
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-brand-400">Restock tracker · checked twice a day</p>
        <h1 className="font-display text-3xl font-black">Back in stock</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted" title="A row is a store, not a ranking: open the product to compare every store and the TCGplayer price. Stock can sell out between checks.">Sealed product a store had sold out and now lists in stock again. <Link className="link" href="/methodology">How it works</Link></p>
      </header>
      <section aria-label="Restock alerts" className="card-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold">Get restock alerts on Discord or Telegram</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">Our Sealed Sniper posts restocks and price drops of 10% or more as they show up, each checked at the store just before it is posted. At most three drops a day, free, no ads.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {SITE.discordInvite && <a href={SITE.discordInvite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4752C4]">Join the Discord</a>}
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg bg-[#229ED9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1C8BC0]">Telegram</a>
        </div>
      </section>
      {rows.length === 0 && <p className="card-surface p-4 text-sm text-muted">No restocks recorded yet. They appear after the next price check.</p>}
      {recent.length > 0 && <section><h2 className="mb-2 text-xl font-bold">Last 2 days</h2>{list(recent)}</section>}
      {earlier.length > 0 && <section><h2 className="mb-2 text-xl font-bold">Earlier this week</h2>{list(earlier)}</section>}
      {file && <p className="text-xs text-muted">Updated {new Date(file.updatedAt).toUTCString()}. Prices are each store&apos;s own, in its own currency.</p>}
    </div>
  );
}
