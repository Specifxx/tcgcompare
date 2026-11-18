"use client";

import Link from "@/components/Link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CART_OPEN_EVENT, cartCount, onCartChange, readCart } from "@/lib/cart-list";
import { CartIcon } from "./cart/CartIcon";
import { Icon } from "./Icon";
import { isActivePath } from "./NavLink";

// The phone bottom nav (owner, 2026-11-18, after Catchback's). READ DECISIONS.md "The mobile bottom tab bar is deleted" (Rift, 2026-09-18)
// FIRST: an earlier bar rode up the screen because it tried to compute where the browser's address bar was (calc(100lvh - 100dvh), then a
// visualViewport "lift"), and floated when the visitor pinch-zoomed. THIS bar does no position arithmetic at all:
//
//   • `fixed inset-x-0 bottom-0`, the same placement the phone dock (AdDock.tsx) has run in production since 2026-11-06, with
//     `env(safe-area-inset-bottom)` padding. It moves on `transform` only (CLS 0), never `bottom`, never a measured number.
//   • Browser only (nothing in the server HTML: SEO and the first paint are untouched) and phones only (below 768px).
//   • OFF unless the visitor opts in with `?bn=1` (kept in localStorage; `?bn=0` clears it) or the site's mode is "on". The owner tries
//     it on his own phone first (DECISIONS.md, 2026-11-18). `SITE.bottomNav` is the rollback: "off" ignores everything, including ?bn=1.
//   • Hides on scroll down, shows on scroll up and at the top; hides while pinch-zoomed (the layout/visual viewport split that floated
//     the old bar), while a text field has focus (the keyboard), while any dialog, the menu or the cart drawer is open, and on a page
//     with the phone buy bar, and whenever an Add to cart button is in the strip it would cover (so it never sits on one).
//   • It and the ad dock alternate: the dock shows on scroll down (the nav is away), the nav on scroll up (the dock yields to
//     `html[data-bottomnav]`). A phone screen still holds one bar at a time.

export type BottomNavMode = "off" | "optin" | "on";

export interface BottomNavState {
  narrow: boolean;
  scrollY: number;
  /** The scroll direction as last settled: "up", "down", or "" before the visitor has moved. */
  dir: "up" | "down" | "";
  zoomed: boolean;
  typing: boolean;
  modal: boolean;
  buybar: boolean;
  /** An Add to cart button is inside the strip the bar would cover. */
  covers: boolean;
  enabled: boolean;
}

/** The scroll distance below which the bar always shows (the top of a page). */
export const NAV_TOP = 80;
/** The least a scroll must move, in px, to flip the direction (finger jitter and iOS rubber-banding never flip it). */
export const NAV_DELTA = 10;
/** The bar's height above the safe area. */
export const NAV_H = 56;
const OPT_KEY = "bn";

/** Whether the bar shows. Pure, for the tests. */
export function bottomNavShows(s: BottomNavState): boolean {
  if (!s.enabled || !s.narrow || s.zoomed || s.typing || s.modal || s.buybar || s.covers) return false;
  if (s.scrollY < NAV_TOP) return true;
  return s.dir === "up";
}

/** The next scroll direction given the last settled one, where the scroll was, and where it is now. Pure, for the tests. */
export function nextDir(dir: "up" | "down" | "", anchor: number, y: number): { dir: "up" | "down" | ""; anchor: number } {
  // The anchor is the scroll position the direction was last decided at: it follows the page while the direction holds and stays
  // put until the page has moved NAV_DELTA the other way.
  if (y > anchor + NAV_DELTA) return { dir: "down", anchor: y };
  if (y < anchor - NAV_DELTA) return { dir: "up", anchor: y };
  if (dir === "down" && y > anchor) return { dir, anchor: y };
  if (dir === "up" && y < anchor) return { dir, anchor: y };
  return { dir, anchor };
}

/** Whether the visitor has the bar: the site's mode, then `?bn=` (1 keeps it, 0 clears it), then what they kept. */
export function bottomNavEnabled(mode: BottomNavMode, search: string, stored: string | null): { enabled: boolean; store: "1" | "0" | null } {
  if (mode === "off") return { enabled: false, store: null };
  const q = new URLSearchParams(search).get("bn");
  if (q === "1") return { enabled: true, store: "1" };
  if (q === "0") return { enabled: false, store: "0" };
  if (mode === "on") return { enabled: stored !== "0", store: null };
  return { enabled: stored === "1", store: null };
}

interface Tab {
  key: string;
  label: string;
  href?: string;
  also?: string[];
  icon: ReactNode;
}

const SVG = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

// A function, so no JSX runs when the module loads (the tests import this file before React exists globally).
const tabs = (): Tab[] => [
  { key: "home", label: "Home", href: "/", icon: <svg {...SVG}><path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5" /></svg> },
  { key: "search", label: "Search", href: "/search", icon: <Icon name="search" size={22} /> },
  { key: "deals", label: "Deals", href: "/tools/deal-finder", also: ["/movers", "/restocks"], icon: <Icon name="tag" size={22} /> },
  { key: "cart", label: "Cart", icon: <CartIcon size={22} /> },
  { key: "menu", label: "Menu", icon: <Icon name="menu" size={22} /> },
];

/** Whether an Add to cart button is in the strip along the foot of the screen the bar would cover: the bar then stays away, so it never sits on one. */
function coversCart(): boolean {
  const strip = window.innerHeight - NAV_H - 12;
  return [...document.querySelectorAll(".ce-cart-add, .ce-cart-inline")].some((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > strip && r.top < window.innerHeight;
  });
}

function narrowNow(): boolean {
  return window.matchMedia("(max-width: 767px)").matches;
}

export function BottomNav({ mode }: { mode: BottomNavMode }) {
  const pathname = usePathname() || "/";
  const [enabled, setEnabled] = useState(false);
  const [shown, setShown] = useState(false);
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLElement>(null);

  // The opt-in, read once in the browser (never in the server HTML).
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(OPT_KEY);
    } catch {
      /* storage blocked: the query alone decides, for this page */
    }
    const r = bottomNavEnabled(mode, location.search, stored);
    if (r.store !== null) {
      try {
        localStorage.setItem(OPT_KEY, r.store);
      } catch {
        /* nothing to keep it in */
      }
    }
    setEnabled(r.enabled);
  }, [mode]);

  useEffect(() => {
    if (!enabled) return;
    const sync = () => setCount(cartCount(readCart()));
    sync();
    return onCartChange(sync);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    let dir: "up" | "down" | "" = "";
    let anchor = window.scrollY;
    let typing = false;
    let frame = 0;
    const modal = () =>
      // The cart drawer is always in the DOM, aria-modal but inert and aria-hidden while closed: only an open one counts.
      [...document.querySelectorAll("dialog[open], [aria-modal='true']")].some((el) => !el.closest("[inert], [aria-hidden='true']")) || document.body.style.overflow === "hidden" || root.style.overflow === "hidden";
    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY); // iOS rubber-banding reports negative values past the top
      const n = nextDir(dir, anchor, y);
      dir = n.dir;
      anchor = n.anchor;
      const vv = window.visualViewport;
      setShown(
        bottomNavShows({
          enabled: true,
          narrow: narrowNow(),
          scrollY: y,
          dir,
          // Pinch-zoomed: the visual viewport is smaller than the layout one and a fixed bar is drawn at the zoomed scale.
          zoomed: !!vv && vv.scale > 1.02,
          typing,
          modal: modal() || root.matches(".capacitor-native"),
          buybar: !!document.querySelector("[data-buybar]"),
          covers: coversCart(),
        }),
      );
    };
    const later = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      typing = !!t?.matches?.("input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable='true']");
      later();
    };
    const onBlur = () => {
      typing = false;
      later();
    };
    update();
    window.addEventListener("scroll", later, { passive: true });
    window.addEventListener("resize", later, { passive: true });
    window.visualViewport?.addEventListener("resize", later);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    const mo = new MutationObserver(later);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "aria-modal", "style", "data-buybar"] });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", later);
      window.removeEventListener("resize", later);
      window.visualViewport?.removeEventListener("resize", later);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      mo.disconnect();
    };
  }, [enabled, pathname]);

  // Room under the footer (set once: below the fold, so no layout shift), the dock yields to the bar, nothing focused scrolls under it,
  // and while hidden the bar is out of the tab order.
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.setAttribute("data-bottomnav-on", "");
    document.body.style.paddingBottom = `calc(${NAV_H}px + env(safe-area-inset-bottom))`;
    return () => {
      root.removeAttribute("data-bottomnav-on");
      document.body.style.paddingBottom = "";
    };
  }, [enabled]);
  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current as (HTMLElement & { inert?: boolean }) | null;
    if (el) el.inert = !shown;
    root.toggleAttribute("data-bottomnav", shown);
    if (!shown) return;
    root.style.scrollPaddingBottom = `calc(${NAV_H}px + env(safe-area-inset-bottom))`;
    return () => {
      root.style.scrollPaddingBottom = "";
      root.removeAttribute("data-bottomnav");
    };
  }, [shown]);

  if (!enabled) return null;

  const click = (key: string) => {
    // One event per tap, read by the site's analytics through the same attribute the other controls use.
    if (key === "cart") window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT));
    if (key === "menu") document.querySelector<HTMLButtonElement>("button[aria-controls='site-menu']")?.click();
  };

  const cls = (active: boolean) =>
    `relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold leading-none outline-offset-[-3px] ${active ? "text-ink" : "text-muted"}`;

  return (
    <nav
      ref={ref}
      aria-label="Quick links"
      aria-hidden={shown ? undefined : true}
      data-bottomnav-bar={shown ? "shown" : "hidden"}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden ${
        shown ? "translate-y-0 transition-transform duration-200 ease-out motion-reduce:transition-none" : "invisible translate-y-full"
      }`}
    >
      <ul className="mx-auto flex max-w-[640px] items-stretch">
        {tabs().map((t) => {
          const active = t.href ? isActivePath(pathname, t.href, t.also) && (t.href !== "/" || pathname === "/") : false;
          return (
            <li key={t.key} className="flex min-w-0 flex-1">
              {t.href ? (
                <Link href={t.href} prefetch={false} aria-current={active ? "page" : undefined} data-bn={t.key} className={cls(active)}>
                  {active && <span aria-hidden="true" className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-ink" />}
                  {t.icon}
                  <span>{t.label}</span>
                </Link>
              ) : (
                <button type="button" data-bn={t.key} aria-haspopup="dialog" aria-label={t.key === "cart" && count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : t.label} onClick={() => click(t.key)} className={cls(false)}>
                  <span className="relative">
                    {t.icon}
                    {t.key === "cart" && count > 0 && (
                      <span aria-hidden="true" className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-ink px-1 text-center text-[10px] font-bold leading-4 text-bg">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </span>
                  <span>{t.label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
