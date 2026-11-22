import { SITE } from "@/site.config";

// The one per-site file of the account pages and sign-in slides (src/components/account/*, owner 2026-11-22: "nice profile pages and
// sign in slides to encourage signing in"). Everything else in those components is the same on every card site that has accounts.
// TCG Prices runs no giveaway, so its slides are alerts, the collection and one account.
export const ACCOUNT_SITE = {
  /** RiftCompare's sister key: the account's signupSource is "sister:<key>:<surface>". */
  key: "tcgprices",
  name: "TCG Prices",
  /** What a collection here holds, and what an alert can be set on. */
  things: "booster boxes, bundles and decks for every game",
  /** Pages the corner slide never covers: account pages, and product pages (/card/), which already carry the leave-nudge test. */
  quietPaths: [/^\/account/, /^\/premium/, /^\/watches/, /^\/collection/, /^\/card\//],
  /** Product pages: a phone there has the sticky buy bar, so the corner slide shows on them from 1024px only. */
  productPath: /^\/card\//,
  discord: (SITE.discordInvite || null) as string | null,
  giveaway: null as { title: string; image: string; closesShort: string; open: () => boolean } | null,
};
