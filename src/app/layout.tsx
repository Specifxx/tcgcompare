import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
// The cart list's styles (components/cart): imported here, never from a component, so node tests can load them.
import "@/components/cart/cart.css";
import "@/components/cart/cart-drawer.css";
import "@/components/vault/vault.css";
import "@/components/site-reviews/site-reviews.css";
// The site's own look on top of the shared one (src/content/site.css; empty on a site that needs none).
import "@/content/site.css";
import { SITE } from "@/site.config";
import { SITE_URL } from "@/lib/site";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import { Neo } from "@/components/Neo";
import { CHRISTMAS_FESTIVE_LAYER, SEASON_BOOT_SCRIPT } from "@/lib/season";
import { Header } from "@/components/Header";
import { GameBar } from "@/components/GameBar";
import { Footer } from "@/components/Footer";
import { PreorderStrip } from "@/components/PreorderStrip";
import { HolidayStrip } from "@/components/HolidayStrip";
import { holidayNav } from "@/lib/holiday-nav";
import { PrefsProvider } from "@/components/ClientPrefs";
import { QuickView } from "@/components/QuickView";
import { RateCard } from "@/components/site-reviews/RateCard";
import { SignInCorner } from "@/components/account/SignInCorner";
import { BuyClickTracker } from "@/components/BuyClickTracker";
import { ReturnNudge } from "@/components/ReturnNudge";
import { LeaveNudge } from "@/components/LeaveNudge";
import { AdFreeSync } from "@/components/premium/AdFreeSync";
import { ADFREE_BOOT_SCRIPT } from "@/lib/premium-member";
import { AiReferralTracker } from "@/components/AiReferralTracker";
import { ShareArrival } from "@/components/ShareArrival";
import { EmbedArrival } from "@/components/EmbedArrival";
import { DockAds } from "@/components/DockAds";
import { GutterAds } from "@/components/GutterAds";
import { BottomNav } from "@/components/BottomNav";
import { NavBoost } from "@/components/NavBoost";
import { AskSheet } from "@/components/AskSheet";
import { adSearch, cardAds } from "@/lib/card-ads";
import { ReturnBeacon } from "@/components/ReturnBeacon";
import { SinceLastVisit } from "@/components/SinceLastVisit";
import { AdRouteGate } from "@/components/AdRouteGate";
import { ImageFallback } from "@/components/ImageFallback";

// Type (owner, 2026-11-28: "it looks extremely vibe coded … maybe it's the font"): Archivo for every word, a sturdy grotesque
// cut for print and retail, set a touch wide in headings, and IBM Plex Mono for every figure, so prices read like a ledger.
// Geist (Vercel's face, on every template) is gone. Both bundled (OFL, src/app/fonts/*-OFL.txt): no font request at build or at
// runtime. Display is optional, not swap: the faces are preloaded, so a warm visit renders in them from the first paint, and a
// slow first visit keeps the size-adjusted fallback for that page instead of re-wrapping every line when the font lands (MTG
// Compare measured CLS 0.209 with swap). --font-display stays a name for the same face, so headings and old class names work.
const display = localFont({
  src: [{ path: "./fonts/Archivo-Variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-display",
  display: "optional",
});
const sans = localFont({
  src: [{ path: "./fonts/Archivo-Variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-sans",
  display: "optional",
});
const mono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexMono-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/IBMPlexMono-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "optional",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  keywords: SITE.keywords,
  applicationName: SITE.name,
  openGraph: { type: "website", siteName: SITE.name, url: "/" },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/", types: { "application/rss+xml": "/feed.xml" } },
  // Large image previews and full snippets in Google (Search, Discover, Images), as RiftCompare does.
  // A page that sets its own `robots` (noindex) replaces this whole object.
  robots: { googleBot: { "max-image-preview": "large", "max-snippet": -1 } },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } : undefined,
  },
};

// Dark by default (lib/theme.ts); the browser bar follows the default, not a saved light choice.
export const viewport: Viewport = { themeColor: "#0f1013", colorScheme: "dark light" };

const ADSENSE = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The boot scripts stamp data-theme and data-season on this element before React hydrates; React must not report that.
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} data-festive={CHRISTMAS_FESTIVE_LAYER ? "on" : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT + SEASON_BOOT_SCRIPT + ADFREE_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://tcgplayer-cdn.tcgplayer.com" />
        {/* Impact's verifier reads the tag exactly as it issues it: `value`, not `content`. */}
        {SITE.impactSiteVerification && <meta name="impact-site-verification" {...{ value: SITE.impactSiteVerification }} />}
        {/* Trustpilot's one-time domain check for the business profile (owner, 2026-11-26). Harmless once verified. */}
        <meta name="trustpilot-one-time-domain-verification-id" content="0956e35c-e796-4331-985d-8c2a0f7387f2" />
        {ADSENSE && <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`} crossOrigin="anonymous" />}
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
          Skip to content
        </a>
        <Neo />
        {/* Clicks that feel instant on the real URLs: intent prefetch, the main tabs warmed when idle, a line of light on tap. */}
        <NavBoost warm={["/", "/sealed", "/sets", "/games", "/tools/deal-finder"]} />
        <PrefsProvider>
          <Header />
          <GameBar />
          {/* ONE line under the header at most (the minimal look, 2026-11-13: two promo bars sat above every headline): the sale's
              in season, else the open pre-order's. The other keeps its link on every page in the header's Deals menu (lib/nav.ts). */}
          {holidayNav() ? <HolidayStrip /> : <PreorderStrip />}
          {/* ONE navigation since 2026-11-13 (owner: "we're making things too complicated"): the header. The sidebar that repeated
              its menus down the left of every desktop page is gone; the page is one centred column (tailwind.config.ts max-w-page). */}
          {/* Retention lever 2 (2026-11-18): a returning visitor's first page of a day, only when something they looked at is cheaper. */}
          {SITE.priceAlerts && <SinceLastVisit wrap="page" />}
          <main id="main" className="relative min-w-0 flex-1">
            <div className="page py-6">{children}</div>
            {/* The gutter ads (owner, 2026-11-25): a labelled TCGplayer column in the empty right side of a wide window, from 1440px. */}
            <AdRouteGate>
              <GutterAds ads={cardAds({ limit: 14 })} search={adSearch()} sides="right" />
            </AdRouteGate>
          </main>
          <Footer />
          <QuickView />
          {/* Rate us (owner, 2026-11-03): the corner card, asking only after real use; RiftCompare keeps the ratings. */}
          <RateCard />
          {/* The phone dock (the side rails are gone, owner 2026-11-13): eBay and TCGplayer tiles along the foot of a narrow screen, after a scroll. */}
          <AdRouteGate><DockAds ads={cardAds({ limit: 10 })} /></AdRouteGate>
          {(SITE.bottomNav ?? "off") !== "off" && <BottomNav mode={SITE.bottomNav ?? "off"} />}
          {SITE.ask && <AskSheet games={(SITE.lines ?? []).map((l) => ({ slug: l.slug, short: l.short, name: l.name }))} />}
        </PrefsProvider>
        <Analytics />
        <BuyClickTracker />
        <ReturnNudge />
        <SignInCorner />
        <LeaveNudge />
        <AdFreeSync />
        <AiReferralTracker />
        <ShareArrival />
        <EmbedArrival />
        <ReturnBeacon />
        <ImageFallback />
      </body>
    </html>
  );
}
