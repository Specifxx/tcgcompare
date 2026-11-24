import type { Metadata } from "next";
import Link from "@/components/Link";
import { SITE } from "@/site.config";
import { dealRows } from "@/lib/tools";
import { shortName } from "@/lib/names";
import { DealFinder } from "./DealFinder";
import { ShareButton } from "@/components/ShareButton";

export const revalidate = 86400; // data only changes with a release (DECISIONS.md, "Vercel cost")
export const metadata: Metadata = {
  title: `${SITE.gameShort} Deal Finder — cards selling below market`,
  description: `Every in-stock ${SITE.game} card and sealed product listed below its TCGplayer market price at stores and on eBay, in the US, UK, Canada, Australia and Europe. Free, updated daily.`,
  // No `images` key: the sibling opengraph-image.tsx (today's top deals) is the preview.
  alternates: { canonical: "/tools/deal-finder" },
  openGraph: { type: "website", siteName: SITE.name, url: "/tools/deal-finder" },
  twitter: { card: "summary_large_image" },
};

export default function Page() {
  const rows = dealRows().map((r) => ({ ...r, name: shortName(r.name) }));
  return (
    <div>
      <h1 className="font-display text-3xl font-black">{SITE.gameShort} Deal Finder</h1>
      <p className="mt-2 text-sm text-muted" title="Prices are converted to US$ for the comparison; each store charges its own currency.">{rows.length} in-stock listings 8–60% under TCGplayer market right now. <Link className="link" href="/methodology">How it works</Link></p>
      <ShareButton path="/tools/deal-finder" name={`${SITE.gameShort} Deal Finder`} medium="tool" text={`${rows.length} sealed products in stock below TCGplayer market today, on ${SITE.name}`} className="mt-3" />
      <DealFinder rows={rows} />
    </div>
  );
}
