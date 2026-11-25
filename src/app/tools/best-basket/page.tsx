import type { Metadata } from "next";
import { BestBasketView } from "@/components/basket/BestBasketView";

// BEST BASKET (owner, 2026-11-25; lib/basket-server.ts). A static shell like /cart: the list lives in the visitor's browser and the
// plan comes from /api/basket, so the page is the same for everyone. Personal: noindex, never in the sitemap.
export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Best Basket: the cheapest way to buy your sealed list",
  description: "Your shortlist split across stores for the lowest total with shipping.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/tools/best-basket" },
};

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-display text-3xl font-black">Best Basket</h1>
      <p className="mt-2 text-muted">
        The cheapest way to buy everything on your shortlist, shipping included: some products from one store, some from another, whichever adds up to less.
      </p>
      <BestBasketView />
    </div>
  );
}
