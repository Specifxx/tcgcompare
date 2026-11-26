"use client";
// Counts a visit a widget brought (src/lib/embed.ts, open-embed.ts): one Vercel event, embed_visit { medium, page }, once per
// browser tab, when the address carries utm_source=embed. `medium` is which widget (widget, daily, index), `page` the kind of
// page they landed on (data, card, daily, home). Nothing is stored about the visitor or the site that embedded it; Vercel →
// Analytics → Events shows the total, and the /data page's own visits are in Pages. DECISIONS.md, 2026-11-26.
import { useEffect } from "react";
import { track } from "@vercel/analytics";
import { pageType } from "@/lib/return-visit";

export function EmbedArrival() {
  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("utm_source") !== "embed" || sessionStorage.getItem("embed_visit")) return;
      sessionStorage.setItem("embed_visit", "1");
      track("embed_visit", { medium: (q.get("utm_medium") || "widget").replace(/[^a-z0-9-]/gi, "").slice(0, 20), page: pageType(location.pathname) });
    } catch {}
  }, []);
  return null;
}
