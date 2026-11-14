import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchResults } from "@/components/SearchResults";

// The search results page (2026-11-14): where Enter goes in the search box when no suggestion is picked. One static shell
// for everyone, like /cart: the browser reads ?q= and asks /api/search (CDN-cached per lower-cased query), so no function
// renders per query and nothing reads the request. A results page is noindex and never in the sitemap.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Search",
  description: "Search every sealed product we compare: booster boxes, cases, packs, tins and decks.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};

export default function SearchPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="mb-6 font-display text-3xl font-black">Search</h1>
      <Suspense fallback={null}>
        <SearchResults />
      </Suspense>
    </div>
  );
}
