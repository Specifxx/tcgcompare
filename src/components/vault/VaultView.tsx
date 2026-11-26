"use client";

// /collection: the visitor's collection (src/lib/vault.ts), valued from this site's static /prices.json. One total per
// market (prices are never converted), the change since the items were added, the change since the last look, and a
// share line with the real totals. Signed in, the list also follows the member's account (lib/vault-sync.ts) and can be
// valued in a weekly email they switch on here (VaultWeekly).
import { useEffect, useMemo, useState } from "react";
import {
  collectionCsv,
  formatMoney,
  itemKey,
  lastLook,
  onVaultChange,
  pctChange,
  readDays,
  readVault,
  recordDay,
  setItemQty,
  shareText,
  sinceAdded,
  totalsByMarket,
  valueItems,
  writeDays,
  writeVault,
  type DayTotal,
  type MarketTotal,
  type PriceFile,
  type ValuedItem,
  type VaultItem,
} from "@/lib/vault";
import { track as trackShare } from "@vercel/analytics";
import { VAULT_SITE } from "./vault-config";
import { bragLink, bragModel, prepareBrag, shareBrag, whenIdle } from "@/lib/brag-card";

/** The brag card's accent on its dark ground: the site's indigo, lightened to read on navy. */
const BRAG_ACCENT = "#818cf8";
import { VaultHistory } from "./VaultHistory";
import { VaultBackup, VaultSearch } from "./VaultTools";
import { VaultWeekly } from "./VaultAccount";
import { startVaultSync } from "@/lib/vault-sync";
import { usePremium } from "@/components/premium/usePremium";
import { MEMBER_HISTORY_DAYS } from "@/lib/premium-member";

/** The stash brag card (lib/brag-card.ts, 2026-11-26, community plan move 4): this market's total, its change since the
 * items were added, and the three most valuable lines. Only the numbers this page shows. */
function stashCard(valued: ValuedItem[], t: MarketTotal, since: { from: number; to: number } | null, host: string) {
  const pct = since ? pctChange(since.from, since.to) : null;
  const mine = valued
    .filter((i) => i.market === t.market && i.nowCents != null)
    .sort((a, b) => (b.nowCents ?? 0) * b.qty - (a.nowCents ?? 0) * a.qty);
  return bragModel({
    site: VAULT_SITE.name,
    host,
    accent: BRAG_ACCENT,
    kicker: "My sealed stash",
    title: `${t.units === 1 ? "1 sealed item" : `${t.units} sealed items`} at today's ${t.market} store prices`,
    value: formatMoney(t.nowCents, t.currency),
    pill:
      since && pct
        ? { text: `${pct > 0 ? "+" : ""}${pct}% (${formatMoney(Math.abs(since.to - since.from), t.currency)}) since I added them`, tone: since.to > since.from ? "up" : "down" }
        : null,
    rows: mine.slice(0, 3).map((i) => ({ label: i.qty > 1 ? `${i.qty} × ${i.name}` : i.name, value: formatMoney((i.nowCents ?? 0) * i.qty, i.currency) })),
    image: mine[0]?.image ?? null,
    imageShape: "box",
    cta: "Track yours free",
    date: new Date(),
  });
}

function Change({ from, to, currency, label }: { from: number; to: number; currency: string; label: string }) {
  const pct = pctChange(from, to);
  const diff = to - from;
  if (pct == null) return null;
  const cls = diff > 0 ? "is-up" : diff < 0 ? "is-down" : "";
  return (
    <span className={`ce-vault-change ${cls}${label ? " is-pill" : ""}`}>
      {diff > 0 ? "▲" : diff < 0 ? "▼" : "•"} {formatMoney(Math.abs(diff), currency)} ({pct > 0 ? "+" : ""}
      {pct}%) {label}
    </span>
  );
}

function Spark({ days, market }: { days: DayTotal[]; market: string }) {
  const pts = days.filter((x) => x.m === market);
  if (pts.length < 2) return <p className="ce-vault-muted">Your value line builds one point a day, each day you open this page. Come back tomorrow.</p>;
  const lo = Math.min(...pts.map((p) => p.c));
  const hi = Math.max(...pts.map((p) => p.c));
  const span = hi - lo || 1;
  const xy = pts.map((p, n) => [(n / (pts.length - 1)) * 300, 48 - ((p.c - lo) / span) * 40] as const);
  const line = xy.map(([x, y], n) => `${n ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const up = pts[pts.length - 1].c >= pts[0].c;
  const id = `ce-vault-fill-${market}`;
  return (
    <svg viewBox="0 0 300 56" role="img" aria-label={`Collection value over ${pts.length} days`} className={`ce-vault-spark ${up ? "is-up" : "is-down"}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L300 56 L0 56 Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Signed out: what the collection does, and the way in. */
function CollectionSignIn() {
  return (
    <div className="ce-vault-empty">
      <p>
        <strong>Sign in to start your collection.</strong> Add every box, pack and tin you own with <em>I own this</em>, and see what it is worth
        today and how much it has moved since you added it.
      </p>
      <p className="ce-vault-muted">
        A free account, no password: Google, Discord or an emailed link. Your collection follows you to every device, and you can get its value by
        email once a week. Premium adds a year of value history and a spreadsheet export, 14 days free.
      </p>
      <a className="ce-vault-btn" href="/account?src=collection&next=/collection">
        Sign in or create a free account
      </a>
    </div>
  );
}

export function VaultView() {
  const premium = usePremium();
  const member = premium.status === "member";
  const [items, setItems] = useState<VaultItem[] | null>(null);
  const [file, setFile] = useState<PriceFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sync = () => setItems(readVault());
    sync();
    fetch("/prices.json", { credentials: "omit" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: PriceFile) => setFile(j))
      .catch(() => setFailed(true));
    return onVaultChange(sync);
  }, []);

  // Signed in: keep the account's copy in step (lib/vault-sync.ts). Signed out it does nothing.
  useEffect(() => {
    if (premium.status === "member" || premium.status === "free") startVaultSync();
  }, [premium.status]);

  const valued = useMemo(() => (items ? valueItems(items, file) : []), [items, file]);
  const totals = useMemo(() => totalsByMarket(valued), [valued]);
  useEffect(() => {
    const t = totals.find((x) => x.nowCents > 0);
    if (!t) return;
    return whenIdle(() => void prepareBrag(stashCard(valued, t, sinceAdded(valued, t.market), location.host)));
  }, [valued, totals]);

  // The previous look, read once before today's totals are recorded over it.
  const [prevDays] = useState<DayTotal[]>(() => (typeof window === "undefined" ? [] : readDays()));
  useEffect(() => {
    if (!file || !totals.length) return;
    let next = readDays();
    for (const t of totals) if (t.nowCents > 0) next = recordDay(next, t.market, t.nowCents, new Date(), member ? MEMBER_HISTORY_DAYS : undefined);
    writeDays(next);
    // once per load of the price file
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, member]);

  // My collection needs an account (owner, 2026-11-19: "you can only use my collection if you are signed in"). The list itself still
  // lives in this browser; signing in is what opens it.
  if (premium.status === "loading" || items == null) return <p className="ce-vault-muted">Loading your collection…</p>;
  if (premium.status === "out") return <CollectionSignIn />;
  if (!items.length)
    return (
      <div className="ce-vault-empty">
        <p>
          <strong>Your collection is empty.</strong> Open any product and tap <em>I own this</em>. This page then shows what everything is worth at
          today&apos;s store prices, and how much it has moved since you added it.
        </p>
        <p className="ce-vault-muted">It is saved to your account, so it follows you to your phone and computer.</p>
        <VaultSearch file={file} />
        <a className="ce-vault-btn" href="/">
          Browse products
        </a>
        <VaultBackup />
      </div>
    );

  // The stash brag card (stashCard below): drawn ahead in idle time, shared as a file where the phone can, else saved, with
  // the tracked link copied. Counted only when it really went out.
  const share = async (t: MarketTotal, since: { from: number; to: number } | null) => {
    const url = bragLink(location.origin, "/collection", "stash");
    const text = shareText(VAULT_SITE.name, VAULT_SITE.what, t, since);
    const blob = await prepareBrag(stashCard(valued, t, since, location.host));
    const how = await shareBrag(blob, text, url, `my-stash-${new Date().toISOString().slice(0, 10)}`);
    if (how === "cancelled" || how === "failed") return;
    if (how === "saved" || how === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    }
    trackShare("share", { kind: "collection", how });
    trackShare("brag_share", { kind: "stash", how });
  };

  const csv = () => {
    const url = URL.createObjectURL(new Blob([collectionCsv(valued)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${VAULT_SITE.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-collection-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ce-vault">
      {failed && <p className="ce-vault-muted">Today&apos;s prices didn&apos;t load. Your list is safe; try again in a moment.</p>}
      {file &&
        totals.map((t, n) => {
          const since = sinceAdded(valued, t.market);
          const prev = lastLook(prevDays, t.market);
          const mine = valued.filter((i) => i.market === t.market && i.nowCents != null && i.addedCents > 0);
          const best = mine.sort((a, b) => ((b.nowCents ?? 0) - b.addedCents) * b.qty - ((a.nowCents ?? 0) - a.addedCents) * a.qty)[0];
          const bestPct = best ? pctChange(best.addedCents, best.nowCents ?? 0) : null;
          return (
            <section key={t.market} className="ce-vault-total" aria-label={`Collection value in ${t.market}`}>
              <div className="ce-vault-label">
                Worth today · {t.market} stores, {t.currency}
              </div>
              <div className="ce-vault-big tabular">{formatMoney(t.nowCents, t.currency)}</div>
              <div className="ce-vault-moves">
                {since && <Change from={since.from} to={since.to} currency={t.currency} label="since you added them" />}
                {prev && <Change from={prev.c} to={t.nowCents} currency={t.currency} label={`since ${new Date(`${prev.d}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`} />}
              </div>
              {member ? (
                <Spark days={readDays()} market={t.market} />
              ) : (
                <p className="ce-vault-muted">
                  <a href="/premium">Premium</a> keeps a year of value history and exports your collection to a spreadsheet.
                </p>
              )}
              <dl className="ce-vault-stats">
                <div>
                  <dt>Items</dt>
                  <dd className="tabular">{t.units}</dd>
                </div>
                {best && bestPct != null && bestPct > 0 && (
                  <div>
                    <dt>Up most</dt>
                    <dd>
                      <a href={best.href}>{best.name}</a> <span className="ce-vault-change is-up">+{bestPct}%</span>
                    </dd>
                  </div>
                )}
                {t.unpriced > 0 && (
                  <div>
                    <dt>Not counted</dt>
                    <dd>{t.unpriced} out of stock everywhere today</dd>
                  </div>
                )}
              </dl>
              <div className="ce-vault-actions">
                <button type="button" className="ce-vault-btn is-primary" onClick={() => share(t, since)}>
                  {copied ? "Picture saved, link copied" : "Share my collection"}
                </button>
                {member && n === 0 && (
                  <button type="button" className="ce-vault-btn" onClick={csv}>
                    Export to spreadsheet
                  </button>
                )}
              </div>
            </section>
          );
        })}
      <VaultWeekly />
      {file && <VaultHistory items={valued} />}
      <VaultSearch file={file} />
      <ul className="ce-vault-list" aria-label="What you own">
        {valued.map((i) => {
          const key = itemKey(i);
          return (
            <li key={key} className="ce-vault-row">
              {i.image ? <img src={i.image} alt={i.name} width={56} height={56} loading="lazy" decoding="async" /> : <span className="ce-vault-ph" aria-hidden="true" />}
              <div className="ce-vault-name">
                <a href={i.href}>{i.name}</a>
                <div className="ce-vault-muted">
                  {i.market}
                  {i.nowCents != null && i.qty > 1 ? ` · ${formatMoney(i.nowCents, i.currency)} each` : ""}
                  {i.addedCents > 0 ? ` · ${formatMoney(i.addedCents, i.currency)} when added` : ""}
                </div>
              </div>
              <div className="ce-vault-price tabular">
                {i.nowCents != null ? formatMoney(i.nowCents * i.qty, i.currency) : <span className="ce-vault-muted">{file ? "Not in stock" : "…"}</span>}
                {i.nowCents != null && i.addedCents > 0 && <Change from={i.addedCents * i.qty} to={i.nowCents * i.qty} currency={i.currency} label="" />}
              </div>
              <span className="ce-vault-qty" aria-label={`How many ${i.name} you own`}>
                <button type="button" onClick={() => writeVault(setItemQty(readVault(), key, i.qty - 1))} aria-label={i.qty === 1 ? `Remove ${i.name}` : "One fewer"}>
                  −
                </button>
                <span className="tabular">{i.qty}</span>
                <button type="button" onClick={() => writeVault(setItemQty(readVault(), key, i.qty + 1))} aria-label="One more">
                  +
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="ce-vault-muted">
        Values are the cheapest in-stock store price in each item&apos;s region today, the price you would pay to buy it again. They are not what a
        buyer would pay you. Prices are never converted between currencies.
      </p>
      <VaultBackup />
    </div>
  );
}
