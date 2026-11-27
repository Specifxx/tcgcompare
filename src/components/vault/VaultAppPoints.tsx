"use client";

// TCG Prices' launch draw (owner's tap, 2026-11-26; lib/giveaway.ts APP_POINTS): when My collection is opened from a home-screen
// icon, one card offers the 25 points, once. It is this visit's one prompt (lib/prompt-slot.ts); the install card never shows in the
// app itself, so the two never meet. Closing it, or claiming, keeps it away for good on this device.
import { useEffect, useState } from "react";
import { claimPromptSlot } from "@/lib/prompt-slot";
import { readStored } from "@/lib/premium-member";
import { APP_POINTS, giveawayState } from "@/lib/giveaway";
import { giveawayCall } from "@/components/giveaway/GiveawayEnter";
import { track } from "@/lib/vault";

const KEY = "ce_app_points_v1";
const standalone = () => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
};
const done = () => {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return true;
  }
};
const remember = (v: string) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* private window: it may show again next visit */
  }
};

type View = null | { signedIn: false } | { signedIn: true; left: number };

export function VaultAppPoints() {
  const [view, setView] = useState<View>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!standalone() || done() || giveawayState() !== "open") return;
    if (!readStored()) {
      if (claimPromptSlot("app-points")) setView({ signedIn: false });
      return;
    }
    let live = true;
    giveawayCall({}).then((m) => {
      if (!live || m.error || !m.signedIn || !m.app || m.app.claimed || m.app.left <= 0) {
        if (m.app?.claimed) remember("claimed");
        return;
      }
      if (claimPromptSlot("app-points")) setView({ signedIn: true, left: m.app.left });
    });
    return () => {
      live = false;
    };
  }, []);

  if (!view) return null;
  const close = () => {
    remember("closed");
    setView(null);
  };
  const claim = async () => {
    setBusy(true);
    setMsg(null);
    let m = await giveawayCall({ action: "enter" });
    if (!m.error) m = await giveawayCall({ action: "app" });
    setBusy(false);
    if (m.error) return setMsg(m.error);
    remember("claimed");
    track("app_points", {});
    setMsg(`+${APP_POINTS} points. You're in the draw for a Delta Reign pack.`);
  };

  return (
    <div className="ce-app-install" role="region" aria-label="Launch draw">
      <img src="/app/icon-192.png" alt="TCG Prices app" width={44} height={44} />
      <div>
        <strong>You opened it from your home screen</strong>
        {msg ? (
          <p role="status">
            {msg} <a href="/giveaway">See your points</a>
          </p>
        ) : view.signedIn ? (
          <>
            <p>That&apos;s worth {APP_POINTS} free points in our launch draw for a Delta Reign booster pack. {view.left} of 500 left.</p>
            <button type="button" className="ce-vault-btn is-primary" onClick={claim} disabled={busy}>
              {busy ? "Adding…" : `Enter and get ${APP_POINTS} points`}
            </button>
          </>
        ) : (
          <>
            <p>Sign in free and you get {APP_POINTS} points in our launch draw for a Delta Reign booster pack, while the first 500 last.</p>
            <a className="ce-vault-btn is-primary" href="/account?src=app-points&next=/collection">
              Sign in free
            </a>
          </>
        )}
      </div>
      <button type="button" className="ce-app-close" onClick={close} aria-label="Close">
        ×
      </button>
    </div>
  );
}
