// The site's navigation, once: the header's dropdowns (components/Header.tsx)
// and the phone menu's sheet (components/MobileMenu.tsx) read these groups.
// They were also the left rail's (owner, 2026-11-03), until the header became
// the ONE navigation (owner, 2026-11-13: "we're making things too complicated";
// DECISIONS.md): every link the rail had is in a dropdown, so still a real <a>
// in every page's server HTML. Prices first, tools next, guides and news last.
// Game-specific entries come from src/site.config.ts (kits, lines, creators),
// never from here.
import { SITE } from "@/site.config";
import { TOOLS } from "@/lib/tool-list";

// Pages that are empty until a week of daily prices exists. The caller (a server
// component) passes `history` from lib/data.ts historyOn(); this file is also read
// by the client menu, so it never touches the data files itself.
const NEEDS_HISTORY = new Set(["/movers", "/price-report"]);
export interface NavOptions {
  /** False on a site younger than a week: the history pages are left out. */
  history?: boolean;
  /** In season, the Black Friday or Cyber Monday page (lib/black-friday.ts saleStrip): first in Prices. */
  sale?: NavLink | null;
  /** The release on pre-order right now (lib/preorder-nav.ts), before the pre-order hub: its page keeps a link on every page while the sale has the strip. */
  preorder?: NavLink | null;
  /** The shopping groups (lib/shop-nav.ts: sealed by type, sets); the header passes them. Without them there is one flat "Prices" list. */
  shop?: NavGroup[];
}
const readyFor = (o: NavOptions) => (l: NavLink) => o.history !== false || !NEEDS_HISTORY.has(l.href);

/** Games named in the menus. */
export const NAV_GAMES = 8;

export interface NavLink {
  href: string;
  label: string;
}
export interface NavGroup {
  title: string;
  links: NavLink[];
}

export function navGroups(o: NavOptions = {}): NavGroup[] {
  const ready = readyFor(o);
  const prices: NavLink[] = [
    ...(o.sale ? [o.sale] : []),
    // The biggest games by name (SITE.lines is in market order), every other one a click away on /games.
    ...(SITE.lines ?? []).slice(0, NAV_GAMES).map((l) => ({ href: `/games/${l.slug}`, label: l.short })),
    ...((SITE.lines ?? []).length > NAV_GAMES ? [{ href: "/games", label: "All games" }] : []),
    { href: "/sealed", label: "Sealed products" },
    { href: "/sealed/booster-box", label: "Booster boxes" },
    { href: "/sets", label: "Sets" },
    ...(SITE.kits ? [{ href: "/kits", label: `${SITE.kits.label} kits` }] : []),
    ...(o.preorder ? [o.preorder] : []),
    { href: "/preorders", label: "Pre-orders" },
    { href: "/tools/deal-finder", label: "Today's deals" },
    { href: "/movers", label: "Price movers" },
    { href: "/restocks", label: "Back in stock" },
    { href: "/stores", label: "Stores we track" },
  ];
  // Three tools and the tools page, not every tool on every page (2026-11-19, "Fewer links on every page").
  const tools: NavLink[] = [...TOOLS.filter((t) => t.href !== "/tools/deal-finder").slice(0, 3).map((t) => ({ href: t.href, label: t.name })), { href: "/tools", label: "All free tools" }];
  const guides: NavLink[] = [
    { href: "/price-report", label: "Monthly price report" },
    { href: "/about", label: "Who runs this site" },
  ];
  if (o.shop) {
    // The product types and sets come first (owner, 2026-11-09), so the flat list keeps only what they do not cover.
    // The games are their own group, and the first (2026-11-23): on a site of 31 games the game is how a visitor finds
    // their way, and they were filed under "Deals & stock" between the sale and the pre-orders.
    const games = prices.filter((l) => l.href === "/games" || l.href.startsWith("/games/"));
    const covered = new Set(["/sealed", "/sealed/booster-box", "/sets", ...games.map((l) => l.href)]);
    const rest = prices.filter((l) => !covered.has(l.href));
    return [
      ...(games.length ? [{ title: "Games", links: games }] : []),
      ...o.shop,
      { title: "Deals & stock", links: rest.filter(ready) },
      { title: "Free tools", links: tools.filter(ready) },
      { title: "Guides & news", links: guides.filter(ready) },
    ];
  }
  return [
    { title: "Prices", links: prices.filter(ready) },
    { title: "Free tools", links: tools.filter(ready) },
    { title: "Guides & news", links: guides.filter(ready) },
  ];
}

/** The short row for the phone header: the pages most visitors want, in order. */
export function phoneNav(o: NavOptions = {}): NavLink[] {
  const ready = readyFor(o);
  return [
    ...(SITE.lines ?? []).slice(0, 5).map((l) => ({ href: `/games/${l.slug}`, label: l.short })),
    ...((SITE.lines ?? []).length > 5 ? [{ href: "/games", label: "All games" }] : []),
    { href: "/sealed", label: "Sealed" },
    { href: "/sets", label: "Sets" },
    ...(SITE.kits ? [{ href: "/kits", label: SITE.kits.label }] : []),
    { href: "/tools/deal-finder", label: "Deals" },
    { href: "/movers", label: "Movers" },
    { href: "/tools", label: "Tools" },
  ].filter(ready);
}
