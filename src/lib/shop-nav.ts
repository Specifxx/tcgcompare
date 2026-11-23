// The shopping half of the navigation (owner, 2026-11-09: "a collector or someone deep in a space wants to navigate it fast").
// A Yu-Gi-Oh! sealed buyer thinks product type (booster box, structure deck, tin, collection) and then which set. The header
// dropdowns (components/Header.tsx) and the phone menu's shop groups (lib/nav.ts navGroups `shop`) both read this ONE
// list. It reads only the loaders the hub pages already read, and every link is a hub that exists (a hub exists only with products),
// so there is no dead end and no new query. Server-side: lib/nav.ts stays free of data.
import { products } from "@/lib/data";
import { sealedHubs, sealedSets } from "@/lib/hubs";
import { rankProducts } from "@/lib/home-demand";
import type { NavGroup, NavLink } from "@/lib/nav";

export interface ShopMenus {
  sealed: NavGroup[];
  sets: NavGroup[];
}
export interface ShopNav {
  menus: ShopMenus;
  /** The phone menu's groups, before "Deals & stock" (they were the sidebar's too, until 2026-11-13). */
  groups: NavGroup[];
}

const cap = (list: NavLink[], n: number, all: NavLink): NavLink[] => (list.length > n ? [...list.slice(0, n), all] : list);

let memo: { at: unknown; v: ShopNav } | null = null;
export function shopNav(): ShopNav {
  const at = products();
  if (memo && memo.at === at) return memo.v;
  const v = build();
  memo = { at, v };
  return v;
}

function build(): ShopNav {
  const types: NavLink[] = sealedHubs().map((h) => ({ href: `/sealed/${h.slug}`, label: h.label }));
  const listed = sealedSets();
  // The sets shoppers open most, not the six newest of 31 games (2026-11-23: the menu led with sets few visitors know). A set's
  // place is its best product's place in the home page's ranking (lib/home-demand.ts); sets with no ranked product keep date order.
  const place = new Map<number, number>();
  rankProducts(products().filter((p) => p.kind === "sealed")).forEach((p, i) => { if (!place.has(p.setId)) place.set(p.setId, i); });
  const released = listed.filter((s) => !s.upcoming).map((s, i) => ({ s, i })).sort((a, b) => (place.get(a.s.id) ?? 1e9) - (place.get(b.s.id) ?? 1e9) || a.i - b.i).map((x) => x.s);
  const setLinks: NavLink[] = released.map((s) => ({ href: `/sets/${s.slug}`, label: s.name }));
  const all: NavLink = { href: "/sealed", label: "All sealed" };
  const sealed: NavGroup[] = types.length ? [{ title: "By product type", links: [...types, all] }] : [];
  const sets: NavGroup[] = [{ title: "Popular sets", links: cap(setLinks, 6, { href: "/sets", label: `All ${listed.length} sets` }) }];
  const groups: NavGroup[] = [
    ...(types.length ? [{ title: "Sealed by type", links: [...types, all] }] : []),
    { title: "Sets", links: cap(setLinks, 6, { href: "/sets", label: "Every set" }) },
  ];
  return { menus: { sealed, sets }, groups };
}
