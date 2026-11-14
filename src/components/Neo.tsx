"use client";
// The 2050 layer's one script (globals.css, "The 2050 layer"): it tells a tile where the pointer is, so its spotlight can follow.
// One passive listener on the document, mouse only, a frame at a time; it writes two custom properties and nothing else, so it
// can never shift layout. No effect with a touch screen or reduced motion.
import { useEffect } from "react";

export function Neo() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = (e.target as Element | null)?.closest?.(".way, .pc-link, .set-tile") as HTMLElement | null;
        if (!el) return;
        const box = (el.querySelector(".pc-plate") as HTMLElement | null) ?? el;
        const r = box.getBoundingClientRect();
        box.style.setProperty("--mx", `${e.clientX - r.left}px`);
        box.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => document.removeEventListener("pointermove", move);
  }, []);
  // How far down the page (CSS ties it to the scroll; without scroll timelines it stays at nothing).
  return <div className="neo-progress" aria-hidden="true" />;
}
