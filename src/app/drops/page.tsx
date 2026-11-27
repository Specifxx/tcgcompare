import type { Metadata } from "next";
import Link from "@/components/Link";
import { SITE } from "@/site.config";
import { canon } from "@/lib/site";
import { boardGap, boardRows, boardUpdatedAt } from "@/lib/drop-board-data";
import { GAP_CAMPAIGN } from "@/lib/drop-board";
import { ShareButton } from "@/components/ShareButton";
import { DROP_LOG_DAYS } from "@/lib/sniper-board";
import { DropBoard } from "@/components/DropBoard";
import { TopHunters } from "@/components/TopHunters";
import { TELEGRAM_URL } from "@/components/DiscordCta";

// THE DEAL BOARD (owner, 2026-11-26; lib/drop-board.ts). One static copy, rebuilt with each data release.
export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Deal board: sealed TCG price drops and restocks, voted by collectors",
  description: "Every price drop and restock our Sealed Sniper has checked at the store in the last two weeks, across Pokémon, Magic, One Piece and more. Vote a deal hot or cold, or flag it gone.",
  ...canon("/drops"),
};

export default function Drops() {
  const rows = boardRows();
  const updated = boardUpdatedAt();
  const live = rows.filter((r) => r.state !== "gone").length;
  const top = boardGap();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">Deal board · checked at the store before it is posted</p>
        <h1 className="font-display text-3xl font-black sm:text-4xl">Sealed deals, voted by collectors</h1>
        <p className="max-w-2xl text-sm text-muted">
          Price drops of 10% or more and restocks of boxes, bundles and trainer boxes at independent stores. Got one, or found it gone? Use the arrows. Votes order this board and nothing else: <Link className="link" href="/methodology">no store pays to be here</Link>.
        </p>
      </header>
      {top && (
        // The one number the board leads with (Cluely study, move 1): today's widest gap between stores for a product on it.
        <section aria-label="Today's price gap" className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5">
          <p className="shrink-0">
            <span className="block font-display text-4xl font-black leading-none tabular-nums text-open">{top.gap.diff}</span>
            <span className="eyebrow mt-1 block">gap between stores today</span>
          </p>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm sm:text-base">
              <Link className="font-semibold hover:underline" href={`/card/${top.slug}`}>{top.name}</Link> ranges <strong className="tabular-nums">{top.gap.low}</strong> to <strong className="tabular-nums">{top.gap.high}</strong> across {top.gap.stores} {top.gap.where} stores today. Same sealed product.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link className="link text-sm font-semibold" href={`/card/${top.slug}`}>See all {top.gap.stores} stores</Link>
              <ShareButton path={`/drops?utm_campaign=${GAP_CAMPAIGN}`} name="Deal board" medium="drop" text={top.line} label="Share" />
            </div>
          </div>
        </section>
      )}
      {rows.length > 0 ? (
        <>
          <p className="text-sm text-muted" aria-live="off">
            <strong className="font-semibold text-ink tabular-nums">{rows.length}</strong> {rows.length === 1 ? "drop" : "drops"} in the last {DROP_LOG_DAYS} days · <strong className="font-semibold text-ink tabular-nums">{live}</strong> still in stock at our last check
          </p>
          <DropBoard rows={rows} />
        </>
      ) : (
        <section className="card flex flex-col gap-2 p-5">
          <h2 className="text-lg font-bold">No drops on the board yet</h2>
          <p className="max-w-xl text-sm text-muted">The Sniper checks every store twice a day and posts at most three drops a day, each one confirmed at the store first. The next one lands here. Until then, see what came <Link className="link" href="/restocks">back in stock</Link> or <Link className="link" href="/tools/deal-finder">today&apos;s deals</Link>.</p>
        </section>
      )}
      <TopHunters site="tcgprices" />
      <section aria-label="Get drops as they happen" className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold">Get the next drop the minute it is checked</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">The same drops, sent to Discord and Telegram as they are found. Free, at most three a day.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {SITE.discordInvite && <a href={SITE.discordInvite} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-full bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4752C4]">Join the Discord</a>}
          <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-full bg-[#1c7fb0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#176a93]">Telegram</a>
        </div>
      </section>
      <p className="text-xs text-muted">
        {updated && <>Board updated {new Date(updated).toUTCString()}. </>}Prices are each store&apos;s own, in its own currency. Stock can sell out between our checks: the store&apos;s page has the final word.
      </p>
    </div>
  );
}
