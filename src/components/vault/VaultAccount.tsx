"use client";

// The account side of My collection (lib/vault-sync.ts): where the list is saved, and the weekly value email. The email is
// opt-in, off until the member switches it on here, and goes only to their account's own address. This is a control on the
// page, never a prompt: it opens nothing and asks nothing on its own.
import { useEffect, useState } from "react";
import { usePremium } from "@/components/premium/usePremium";
import { setWeekly, syncStatus, SYNC_EVENT, type SyncStatus } from "@/lib/vault-sync";
import { track } from "@/lib/vault";

function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>(() => syncStatus());
  useEffect(() => {
    const on = () => setS(syncStatus());
    on();
    window.addEventListener(SYNC_EVENT, on);
    return () => window.removeEventListener(SYNC_EVENT, on);
  }, []);
  return s;
}

/** Under the page title: saved to the account, syncing, or waiting for a connection. */
export function VaultSyncBadge() {
  const premium = usePremium();
  const s = useSyncStatus();
  if (premium.status === "loading" || premium.status === "out") return <span className="ce-vault-sync">Sign in to save it to your account.</span>;
  const [cls, text] =
    s.phase === "offline"
      ? ["is-warn", "Saved on this device. It will reach your account when you're back online."]
      : s.phase === "syncing" || s.phase === "idle"
        ? ["is-busy", "Saving to your account…"]
        : s.phase === "signed-out"
          ? ["is-warn", "Sign in again to keep your collection in step across devices."]
          : ["is-ok", "Saved to your account, on every device you sign in on."];
  return (
    <span className={`ce-vault-sync ${cls}`} role="status" aria-live="polite">
      <span className="ce-vault-dot" aria-hidden="true" />
      {text}
    </span>
  );
}

const when = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/** The weekly value email: one switch, the address it goes to, and what happens next. */
export function VaultWeekly() {
  const premium = usePremium();
  const s = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  if (premium.status !== "member" && premium.status !== "free") return null;
  const on = optimistic ?? s.weekly;
  const ready = s.phase === "synced" || optimistic != null;
  const who = premium.info.who;

  const toggle = async () => {
    if (busy) return;
    const next = !on;
    setBusy(true);
    setError("");
    setOptimistic(next);
    const r = await setWeekly(next);
    setBusy(false);
    if (!r.ok) {
      setOptimistic(!next);
      setError(r.message);
      return;
    }
    track(next ? "vault_weekly_on" : "vault_weekly_off", {});
  };

  return (
    <section className={`ce-vault-weekly${on ? " is-on" : ""}`} aria-labelledby="ce-vault-weekly-h">
      <span className="ce-vault-weekly-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      </span>
      <div className="ce-vault-weekly-body">
        <h2 id="ce-vault-weekly-h">Weekly value email</h2>
        <p>
          {on
            ? s.lastSentAt
              ? `On. Last sent ${when(s.lastSentAt)}; the next one comes about a week later.`
              : "On. Your first one arrives within a day, then once a week."
            : "Once a week: what your collection is worth and what moved most. Free, and one tap to stop."}
          {who ? (
            <>
              {" "}
              <span className="ce-vault-muted">To {who}.</span>
            </>
          ) : null}
        </p>
        {error && (
          <p className="ce-vault-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="ce-vault-weekly-h"
        className="ce-vault-switch"
        disabled={busy || !ready}
        onClick={toggle}
      >
        <span className="ce-vault-knob" />
      </button>
    </section>
  );
}
