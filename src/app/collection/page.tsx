import type { Metadata } from "next";
import { VaultView } from "@/components/vault/VaultView";
import { VaultSyncBadge } from "@/components/vault/VaultAccount";
import { SITE } from "@/site.config";

// MY COLLECTION (competitor scan, 2026-11-08; src/lib/vault.ts). The list lives in the visitor's browser (and, signed in, with
// their account through the browser: lib/vault-sync.ts), so this page is the same static shell for everyone: no session, no
// database, nothing cached per user.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "My collection",
  description: `Track your card collection, singles and sealed, every game: what it is worth today and what it has made against what you paid. Free, nothing to install.`,
  // Personal page: never indexed, never in the sitemap. Not disallowed in robots.txt, so Google can see the noindex.
  robots: { index: false, follow: false },
  alternates: { canonical: "/collection" },
  // Added to an iPhone's home screen from here, it opens full screen under the site's own name (app manifest: src/app/manifest.ts).
  appleWebApp: { capable: true, title: SITE.shortName, statusBarStyle: "black-translucent" },
};

export default function CollectionPage() {
  return (
    <div className="mx-auto w-full max-w-3xl py-6 sm:py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">My collection</h1>
      <p className="mt-2 text-sm opacity-75">Cards and sealed, every game: what it is worth today, and what it has made against what you paid.</p>
      <p className="mt-2">
        <VaultSyncBadge />
      </p>
      <VaultView />
    </div>
  );
}
