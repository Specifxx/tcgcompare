"use client";

// "Put your collection on your home screen" (lib/app-install.ts): an in-page card on /collection, never a pop-up, and the visit's
// one prompt. Also registers the app's service worker (public/sw.js), from this page only, so My collection opens offline.
import { useEffect, useState } from "react";
import { claimPromptSlot, promptSlotHolder } from "@/lib/prompt-slot";
import { INSTALL_KEY, installWay, shouldOffer, type InstallWay } from "@/lib/app-install";
import { track } from "@/lib/vault";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: BIP | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BIP;
    window.dispatchEvent(new Event("ce-app-installable"));
  });
}

const standalone = () => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
};
const closedAt = (): number | null => {
  try {
    const v = Number(localStorage.getItem(INSTALL_KEY));
    return v > 0 ? v : null;
  } catch {
    return Date.now(); // no storage: never nag, it couldn't remember a close
  }
};

export function VaultInstall({ items }: { items: number }) {
  const [way, setWay] = useState<InstallWay>(null);
  const [show, setShow] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    if (new URLSearchParams(location.search).get("src") === "app") track("app_open", {});
  }, []);

  useEffect(() => {
    const decide = () => {
      const w = installWay(navigator.userAgent, !!deferred);
      if (!shouldOffer({ items, standalone: standalone(), way: w, closedAt: closedAt(), now: Date.now() })) return;
      const holder = promptSlotHolder();
      if (holder && holder !== "app-install") return;
      if (!claimPromptSlot("app-install")) return;
      setWay(w);
      setShow(true);
      track("app_install_shown", { way: w });
    };
    decide();
    window.addEventListener("ce-app-installable", decide);
    return () => window.removeEventListener("ce-app-installable", decide);
  }, [items]);

  if (!show || !way) return null;
  const close = () => {
    try {
      localStorage.setItem(INSTALL_KEY, String(Date.now()));
    } catch {
      /* blocked */
    }
    setShow(false);
    track("app_install_closed", { way });
  };
  const install = async () => {
    if (way === "ios") return setIosHelp(true);
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    track("app_install_choice", { outcome });
    deferred = null;
    if (outcome === "accepted") setShow(false);
  };

  return (
    <aside className="ce-app-install" aria-label="Add My collection to your home screen">
      <img src="/app/icon-192.png" alt="TCG Prices app" width={44} height={44} />
      <div>
        <strong>Your collection, one tap away</strong>
        <p className="ce-vault-muted">
          {iosHelp ? (
            <>
              Tap <span aria-label="the Share button">Share</span> <span aria-hidden="true">⎋</span> at the bottom of Safari, then <em>Add to Home Screen</em>. Nothing to
              download, and it opens full screen like an app.
            </>
          ) : (
            "Add it to your home screen: it opens full screen like an app, even with no signal. Nothing to download."
          )}
        </p>
        {!iosHelp && (
          <button type="button" className="ce-vault-btn is-primary" onClick={install}>
            {way === "ios" ? "Show me how" : "Add to home screen"}
          </button>
        )}
      </div>
      <button type="button" className="ce-app-close" onClick={close} aria-label="Close">
        ×
      </button>
    </aside>
  );
}
