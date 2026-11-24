"use client";
// The ✕ on the one promo line under the header (owner's UX review, 2026-11-23, P0 6: "Collapse the promo and disclosure into one
// dismissible line"; ported from DexCompare). Closed, the line stays away for 7 days (page budget: dismissed = 7 days). The line
// is in the server HTML; a visitor who closed it sees it go once the page has loaded.
import { useEffect, useState } from "react";

export const STRIP_CLOSED_KEY = "promo-strip-closed";
const DAY = 86_400_000;

export function StripClose({ strip }: { strip: string }) {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    try {
      if (Number(localStorage.getItem(STRIP_CLOSED_KEY)) > Date.now()) setClosed(true);
    } catch {
      /* storage refused: the line shows */
    }
  }, []);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-promo-strip="${strip}"]`);
    if (el) el.style.display = closed ? "none" : "";
  }, [closed, strip]);
  return (
    <button
      type="button"
      aria-label="Hide this line for a week"
      title="Hide this line for a week"
      className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
      onClick={() => {
        try {
          localStorage.setItem(STRIP_CLOSED_KEY, String(Date.now() + 7 * DAY));
        } catch {
          /* not remembered: hidden for this page only */
        }
        setClosed(true);
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}
