import type { PreorderCopy } from "@/lib/site-types";

// Copy for /preorders and /preorders/<set slug>. A fact we cannot source is left out; a set without copy here
// still gets a page from its data.
export const PREORDER_COPY: PreorderCopy = {
  intro:
    "Every upcoming trading card game release, each with its own page comparing every store's booster box and sealed pre-order price, cheapest first in your currency. Sets stay listed for six weeks after release, when the most people shop for a box.",
  faq: [
    { q: "When do pre-orders open?", a: "Most stores list a new set a few weeks to two months before release. Each release page adds a store as soon as its listing appears, and refreshes every store daily." },
    { q: "Is it cheaper to pre-order or to wait for release?", a: "Booster boxes often sit near MSRP during pre-order; singles are usually cheapest a few weeks after release. If you want to open product, pre-ordering at a good price is reasonable." },
    { q: "Do the prices include shipping?", a: "No. Every price is the store's item price before shipping, in the store's own currency, so compare the stores in your market." },
  ],
  sets: {},
};
