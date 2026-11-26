import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "@/components/Link";
import { boardRow, boardRows } from "@/lib/drop-board-data";
import { KIND_LABEL } from "@/lib/drop-board";
import { DropBoard } from "@/components/DropBoard";
import { ShareButton } from "@/components/ShareButton";

// ONE DROP'S OWN PAGE: the link people paste into a group chat. Rendered on request and kept a day by the CDN
// (next.config.js CDN_PAGES), never ISR. A drop leaves the log after two weeks, so the page is noindex and out of the
// sitemap, and an id the log no longer holds goes to the board: a shared link never 404s.
export const dynamic = "force-dynamic";

const ID = /^[a-f0-9]{12}$/;
const find = (id: string) => (ID.test(id) ? boardRow(id) : null);

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const r = find(params.id);
  if (!r) return { title: "Deal board", robots: { index: false, follow: true } };
  const title = `${KIND_LABEL[r.kind]}: ${r.name} ${r.price} at ${r.store}`;
  return {
    title,
    description: `${r.name} at ${r.store} for ${r.price}${r.was ? `, down from ${r.was}` : ""}. Checked at the store before it was posted. Vote it hot or cold, or compare every store.`,
    alternates: { canonical: `/drops/${r.id}` },
    robots: { index: false, follow: true },
    openGraph: { title, url: `/drops/${r.id}`, ...(r.img ? { images: [{ url: r.img.replace(/_200w\.jpg$/, "_in_1000x1000.jpg") }] } : {}) },
  };
}

export default function Drop({ params }: { params: { id: string } }) {
  const r = find(params.id);
  if (!r) redirect("/drops");
  const more = boardRows().filter((x) => x.id !== r.id && x.state !== "gone").slice(0, 4);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link className="link" href="/drops">Deal board</Link>
      </nav>
      <DropBoard rows={[r]} single />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">Checked at the store just before it was posted. Stock can sell out between our checks: the store&apos;s page has the final word.</p>
        <ShareButton path={`/drops/${r.id}`} name={r.name} medium="drop" text={`${KIND_LABEL[r.kind]}: ${r.name} ${r.price} at ${r.store}`} label="Share this deal" />
      </div>
      {more.length > 0 && (
        <section aria-labelledby="more-drops" className="flex flex-col gap-3">
          <h2 id="more-drops" className="text-xl font-bold">More on the board</h2>
          <DropBoard rows={more} bare />
          <p><Link className="link text-sm" href="/drops">See every drop →</Link></p>
        </section>
      )}
    </div>
  );
}
