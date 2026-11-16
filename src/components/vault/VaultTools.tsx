"use client";

// Add a product from the collection page, and move the list between devices as a file (no account, nothing sent to us).
import { useRef, useState } from "react";
import { addItem, backupText, mergeItems, parseBackup, readVault, writeVault, track, type PriceFile } from "@/lib/vault";
import { useMarket } from "@/components/ClientPrefs";
import { CURRENCY } from "@/lib/site-types";

type Hit = { id: number; href: string; name: string; set: string; image: string | null; kind: string };

export function VaultSearch({ file }: { file: PriceFile | null }) {
  const { market } = useMarket();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const search = (v: string) => {
    setQ(v);
    setNote("");
    clearTimeout(timer.current);
    if (v.trim().length < 2) return setHits([]);
    timer.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(v.trim())}&limit=6`, { credentials: "omit" })
        .then((r) => r.json())
        .then((j: { hits?: Hit[] }) => setHits((j.hits ?? []).filter((h) => h.id != null && h.kind !== "kit")))
        .catch(() => setHits([]));
    }, 250);
  };

  const add = (h: Hit) => {
    const cents = file?.products?.find((p) => p.id === String(h.id))?.prices?.[market]?.cents ?? 0;
    writeVault(addItem(readVault(), { id: String(h.id), name: h.name, href: h.href, image: h.image, market, currency: CURRENCY[market], addedCents: cents }));
    track("vault_add", { market, via: "search" });
    setNote(`Added ${h.name}${cents ? "" : ` (no ${market} store has it in stock today, so it is not valued yet)`}.`);
    setHits([]);
    setQ("");
  };

  return (
    <div className="ce-vault-tools">
      <label className="ce-vault-label" htmlFor="ce-vault-q">
        Add a product
      </label>
      <input id="ce-vault-q" className="ce-vault-input" type="search" autoComplete="off" placeholder="Search a booster box, tin, collection…" value={q} onChange={(e) => search(e.target.value)} />
      {hits.length > 0 && (
        <ul className="ce-vault-hits">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => add(h)}>
                <strong>{h.name}</strong>
                <span className="ce-vault-muted"> {h.set}</span>
                <span aria-hidden="true"> +</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="ce-vault-muted" role="status">{note}</p>}
    </div>
  );
}

export function VaultBackup() {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");

  const save = () => {
    const blob = new Blob([backupText(readVault())], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `collection-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    track("vault_backup", {});
  };
  const load = async (f: File | undefined) => {
    if (!f) return;
    const items = f.size < 1_000_000 ? parseBackup(await f.text()) : null;
    if (!items) return setNote("That isn't a collection file saved from this page.");
    writeVault(mergeItems(readVault(), items));
    setNote(`Loaded ${items.length} item${items.length === 1 ? "" : "s"}; anything already in your list kept its larger quantity.`);
  };
  return (
    <div className="ce-vault-tools">
      <div className="ce-vault-label">Move it to another device</div>
      <div className="ce-vault-backup">
        <button type="button" className="ce-vault-btn" onClick={save}>Save a backup file</button>
        <button type="button" className="ce-vault-btn" onClick={() => input.current?.click()}>Load a backup file</button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <p className="ce-vault-muted">Your list lives in this browser. The file is yours: it holds only the items and quantities, and loading it never sends anything to us.</p>
      {note && <p className="ce-vault-muted" role="status">{note}</p>}
    </div>
  );
}
