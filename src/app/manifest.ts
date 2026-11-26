import type { MetadataRoute } from "next";
import { SITE } from "@/site.config";

// The installable app (DECISIONS.md, 2026-11-26 "The collection app"): add TCG Prices to a phone's home screen and it opens on My
// collection, full screen, like an app from a store, with nothing to download. PNG icons (Android's install needs 192 and 512;
// the maskable one keeps the logo inside the safe circle) drawn from icon.svg. public/sw.js gives /collection its offline copy.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE.name,
    short_name: SITE.shortName,
    description: `Your card collection's value, every game, with the cheapest place to buy what you want next.`,
    start_url: "/collection?src=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: SITE.theme.pageDark,
    theme_color: SITE.theme.pageDark,
    categories: ["shopping", "entertainment", "utilities"],
    icons: [
      { src: "/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "My collection", short_name: "Collection", url: "/collection?src=app-shortcut", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
      { name: "Today's deals", short_name: "Deals", url: "/drops?src=app-shortcut", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
      { name: "Search prices", short_name: "Search", url: "/search?src=app-shortcut", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
