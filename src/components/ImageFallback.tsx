"use client";
// Reliable images (owner's UX review, 2026-11-23, P1 15: "Two guide thumbnails were blank on first load … fall back to a
// placeholder"). One listener for the whole page: a product photo that fails (a store's or TCGplayer's CDN hiccup) is tried once
// more after 1.5 s, then shows the site's mark on its plate instead of a blank box. Tiles already reserve their box (aspect-square
// plates, width/height on every <img>), so neither step moves the layout.
import { useEffect } from "react";

const RETRY_MS = 1500;
const MARK = "/apple-icon.png";

export function ImageFallback() {
  useEffect(() => {
    const onError = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || img.src.endsWith(MARK)) return;
      if (!img.dataset.retried) {
        img.dataset.retried = "1";
        const src = img.currentSrc || img.src;
        window.setTimeout(() => {
          img.removeAttribute("srcset");
          img.src = src;
        }, RETRY_MS);
        return;
      }
      img.removeAttribute("srcset");
      img.src = MARK;
      img.style.objectFit = "contain";
      img.style.opacity = "0.35";
    };
    document.addEventListener("error", onError, true);
    return () => document.removeEventListener("error", onError, true);
  }, []);
  return null;
}
