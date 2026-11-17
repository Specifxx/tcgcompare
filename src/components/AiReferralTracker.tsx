"use client";
// AI-assistant referrals (DECISIONS.md, 2026-11-17). A visit that arrives from ChatGPT, Perplexity, Claude, Gemini,
// Copilot and the like is recorded once per session as the Vercel Web Analytics event "ai_referral" (assistant, landing
// page), and later buy clicks carry the same assistant (window.__aiSource, read by BuyClickTracker) so Vercel →
// Analytics → Events shows AI visits and what they clicked. ChatGPT appends utm_source=chatgpt.com to its links; the
// others send a referrer. Nothing is stored beyond sessionStorage and no address or text is read.
import { useEffect } from "react";
import { track } from "@vercel/analytics";
import { aiSourceOf } from "@/lib/ai-referral";

export function AiReferralTracker() {
  useEffect(() => {
    try {
      let src: string | null = null;
      try { src = sessionStorage.getItem("ai_source"); } catch {}
      if (!src) {
        src = aiSourceOf(document.referrer, new URLSearchParams(location.search).get("utm_source"));
        if (!src) return;
        try { sessionStorage.setItem("ai_source", src); } catch {}
        track("ai_referral", { assistant: src, page: location.pathname.slice(0, 80) });
      }
      (window as unknown as { __aiSource?: string }).__aiSource = src;
    } catch {}
  }, []);
  return null;
}
