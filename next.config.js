/** @type {import('next').NextConfig} */
// Cost notes (mirrors Rift Compare, DECISIONS.md "Cached pages refresh every 6
// to 24 hours"): public pages read committed JSON under data/, never the
// database, so the data files must ship with every server function.
// One CDN copy per catalogue URL (owner, 2026-11-04, the engine port; MTG Compare and OP Compare did the same on
// 2026-10-17, when ISR writes were the largest line of the bill): the card, kit, set, sealed, hub and pre-order pages are
// `dynamic = "force-dynamic"` and Vercel's CDN keeps each rendered copy for a day, serving it stale for another day while one
// render refreshes it. No ISR write, no data-cache entry per page, nothing prerendered at build. The header never covers
// /go (a redirect per click) or /api.
const CDN_CACHE = "public, s-maxage=86400, stale-while-revalidate=86400";
const CDN_PAGES = ["/card/:slug", "/sets/:slug", "/sealed/:type", "/games/:slug", "/games/:slug/:type", "/preorders/:slug", "/drops/:id"];

// Sealed only (owner, 2026-11-06): the card hubs and card tools are gone; each old URL is a 301 to the nearest sealed
// page, so links and search results keep working. A single card's own URL (/card/<slug>) is redirected by its page
// (lib/card-redirects.ts), because the same route still serves every sealed product.
const RETIRED = [];

module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Card art is served straight from TCGplayer's CDN at the size we ask for;
    // Vercel image optimisation is billed per source image, so it stays off.
    unoptimized: true,
  },
  experimental: {
    outputFileTracingIncludes: {
      // data/amazon: ASINs from the daily refresh; data/amazon-live: the prices this build fetched (lib/amazon-live.ts).
      "/**": ["./data/public/**/*", "./data/history/**/*", "./data/store-lows/**/*", "./data/open/index.json", "./data/spread/*.json", "./data/amazon/*.json", "./data/amazon-live/*.json", "./data/redirects/*.json"],
    },
  },
  async redirects() {
    return [{ source: "/deals", destination: "/tools/deal-finder", permanent: true }, ...RETIRED.map((r) => ({ ...r, statusCode: 301 }))];
  },
  // The shared account and alert service, on THIS site's own address (owner, 2026-11-19: sign-in never sends a visitor to another
  // site). Vercel proxies these three paths to the service; the browser's address bar never leaves this site. Only these paths.
  async rewrites() {
    return [
      { source: "/account-service/alerts/:path(confirm|manage|unsubscribe)", destination: "https://riftcompare.com/api/sister-alerts/:path" },
      { source: "/account-service/oauth/:provider(google|discord)", destination: "https://riftcompare.com/api/sister-premium/oauth/:provider" },
      { source: "/account-service/oauth/:provider(google|discord)/callback", destination: "https://riftcompare.com/api/auth/oauth/:provider/callback" },
    ];
  },
  async headers() {
    return [
      ...CDN_PAGES.map((source) => ({ source, headers: [{ key: "Vercel-CDN-Cache-Control", value: CDN_CACHE }] })),
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};
