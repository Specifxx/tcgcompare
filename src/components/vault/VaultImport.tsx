"use client";

// Bring a collection from another app or a spreadsheet (lib/card-collection.ts readImport/matchRow): Collectr, the TCGplayer
// app, ManaBox, Dex or a home-made sheet, as CSV. Rows are matched to ONE card by set and number (or exact name), names
// agreeing; everything else is listed back as not matched, never guessed. Shown before anything is added.
import { useRef, useState } from "react";
import { addItem, readVault, track, writeVault, VAULT_MAX_ITEMS } from "@/lib/vault";
import { CARD_GAMES, cardId, cardImage, cardLabel, matchRow, matchSet, readImport, SINGLES_API, type ImportMatch, type OpenSetsFile } from "@/lib/card-collection";
import { fetchSet } from "./useCardPrices";

const setsMemo = new Map<string, Promise<OpenSetsFile | null>>();
function fetchSets(game: string) {
  if (!setsMemo.has(game))
    setsMemo.set(
      game,
      fetch(`${SINGLES_API}/sets/${game}`, { credentials: "omit" })
        .then((r) => (r.ok ? (r.json() as Promise<OpenSetsFile>) : null))
        .catch(() => null),
    );
  return setsMemo.get(game)!;
}

export function VaultImport() {
  const input = useRef<HTMLInputElement>(null);
  const [game, setGame] = useState("pokemon");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ found: Extract<ImportMatch, { kind: "card" }>[]; missed: Extract<ImportMatch, { kind: "miss" }>[] } | null>(null);
  const [note, setNote] = useState("");

  const read = async (f: File | undefined) => {
    setNote("");
    setResult(null);
    if (!f) return;
    if (f.size > 2_000_000) return setNote("That file is over 2 MB. Split it and import the parts.");
    const { rows, missing } = readImport(await f.text(), game);
    if (missing.length) return setNote(`We couldn't read that file: it needs ${missing.join(" and ")}. Export it as CSV with a header row.`);
    setBusy(true);
    const games = [...new Set(rows.map((r) => r.game))];
    const setsByGame = Object.fromEntries(await Promise.all(games.map(async (g) => [g, await fetchSets(g)] as const)));
    if (games.every((g) => !setsByGame[g])) {
      setBusy(false);
      return setNote("The card catalogue didn't answer. Try again in a minute.");
    }
    const setOf = rows.map((r) => (setsByGame[r.game] ? matchSet(r.set, setsByGame[r.game]!.sets) : null));
    const needed = [...new Set(rows.map((r, i) => (setOf[i] ? `${r.game}/${setOf[i]}` : "")).filter(Boolean))].slice(0, 150);
    const files = Object.fromEntries(await Promise.all(needed.map(async (k) => [k, await fetchSet(k)] as const)));
    const matches = rows.map((r, i) => matchRow(r, setOf[i] ? (files[`${r.game}/${setOf[i]}`] ?? null) : null));
    setResult({ found: matches.filter((m): m is Extract<ImportMatch, { kind: "card" }> => m.kind === "card"), missed: matches.filter((m): m is Extract<ImportMatch, { kind: "miss" }> => m.kind === "miss") });
    setBusy(false);
    track("vault_import_read", { rows: rows.length, found: matches.filter((m) => m.kind === "card").length });
  };

  const add = () => {
    if (!result) return;
    let list = readVault();
    let added = 0;
    for (const m of result.found) {
      const id = cardId({ game: m.row.game, set: m.set, tcgId: m.card.id, printing: m.printing });
      if (!id || list.length >= VAULT_MAX_ITEMS) continue;
      const today = m.card.p[m.printing] ?? 0;
      list = addItem(list, { id, name: cardLabel(m.card.n, m.setName, m.card.no, m.printing), href: "/collection", image: cardImage(m.card.id), market: "US", currency: "USD", addedCents: m.row.paidCents || today, qty: m.row.qty });
      added++;
    }
    writeVault(list);
    track("vault_import_add", { added });
    setNote(`Added ${added} card${added === 1 ? "" : "s"} to your collection.${list.length >= VAULT_MAX_ITEMS ? ` Your collection holds ${VAULT_MAX_ITEMS} different items at most.` : ""}`);
    setResult(null);
  };

  return (
    <details className="ce-vault-tools ce-vault-details">
      <summary className="ce-vault-label">Import from another app or a spreadsheet</summary>
      <p className="ce-vault-muted">
        Export your collection as CSV from Collectr, the TCGplayer app, ManaBox or a spreadsheet, and drop it here. We match each row by its set and
        card number; anything we can&apos;t match for certain is listed, not guessed. Nothing is added until you say so.
      </p>
      <div className="ce-cards-games" role="group" aria-label="Game for rows that don't name one">
        {CARD_GAMES.slice(0, 7).map((g) => (
          <button key={g.slug} type="button" aria-pressed={game === g.slug} onClick={() => setGame(g.slug)}>
            {g.name}
          </button>
        ))}
      </div>
      <div className="ce-vault-backup">
        <button type="button" className="ce-vault-btn" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Reading…" : "Choose a CSV file"}
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          onChange={(e) => {
            read(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {result && (
        <div className="ce-import-result" role="status">
          <p>
            <strong>{result.found.length}</strong> matched{result.missed.length ? <>, <strong>{result.missed.length}</strong> not matched</> : null}.
            {result.found.some((m) => m.assumed) ? " Rows that didn't say which printing got the plain one; change it by removing and re-adding the card." : ""}
          </p>
          {result.found.length > 0 && (
            <button type="button" className="ce-vault-btn is-primary" onClick={add}>
              Add {result.found.length} card{result.found.length === 1 ? "" : "s"}
            </button>
          )}
          {result.missed.length > 0 && (
            <details>
              <summary>Not matched ({result.missed.length})</summary>
              <ul className="ce-import-missed">
                {result.missed.slice(0, 200).map((m) => (
                  <li key={m.row.line}>
                    Row {m.row.line}: {m.row.name}
                    {m.row.set ? ` · ${m.row.set}` : ""}
                    {m.row.number ? ` ${m.row.number}` : ""} <span className="ce-vault-muted">({m.why})</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {note && (
        <p className="ce-vault-muted" role="status">
          {note}
        </p>
      )}
    </details>
  );
}
