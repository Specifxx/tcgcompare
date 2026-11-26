"use client";

// Add single cards to the collection (lib/card-collection.ts): search every game TCG Singles DB carries, pick the printing,
// and the card joins the list valued at TCGplayer's market price in US$. Search asks Singles DB's open API after a pause in
// typing; nothing is sent but the words typed.
import { useRef, useState } from "react";
import { addItem, formatMoney, readVault, track, writeVault } from "@/lib/vault";
import { CARD_GAMES, cardId, cardImage, cardLabel, gameName, printingsOf, SINGLES_API, type OpenHit } from "@/lib/card-collection";
import { fetchSet } from "./useCardPrices";

type Picked = { hit: OpenHit; printings: { name: string; cents: number | null }[] };

export function VaultCards({ autoFocus = false }: { autoFocus?: boolean }) {
  const [game, setGame] = useState("pokemon");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<OpenHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const seq = useRef(0);

  const run = (v: string, g: string) => {
    clearTimeout(timer.current);
    setPicked(null);
    setHits(null);
    if (v.trim().length < 2) {
      setHits(null);
      return;
    }
    timer.current = setTimeout(() => {
      const n = ++seq.current;
      setBusy(true);
      fetch(`${SINGLES_API}/search?q=${encodeURIComponent(v.trim())}${g ? `&game=${g}` : ""}`, { credentials: "omit" })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((j: { hits?: OpenHit[] }) => n === seq.current && setHits(j.hits ?? []))
        .catch(() => n === seq.current && setHits([]))
        .finally(() => n === seq.current && setBusy(false));
    }, 300);
  };

  const choose = async (hit: OpenHit) => {
    const set = await fetchSet(`${hit.game}/${hit.set}`);
    const card = set?.cards.find((c) => c.id === hit.id);
    setPicked({ hit, printings: card ? printingsOf(card) : [{ name: "Normal", cents: hit.v || null }] });
  };

  const add = (p: Picked, printing: string, cents: number | null) => {
    const id = cardId({ game: p.hit.game, set: p.hit.set, tcgId: p.hit.id, printing });
    if (!id) return setNote("That card can't be added; try another printing.");
    const name = cardLabel(p.hit.n, p.hit.setName, p.hit.no, printing);
    writeVault(addItem(readVault(), { id, name, href: "/collection", image: cardImage(p.hit.id), market: "US", currency: "USD", addedCents: cents ?? 0 }));
    track("vault_add", { market: "US", via: "card", game: p.hit.game });
    setNote(`Added ${name}${cents ? ` (${formatMoney(cents, "USD")} today)` : " (no market price yet, so it is not valued)"}.`);
    setPicked(null);
    setHits(null);
    setQ("");
  };

  return (
    <div className="ce-vault-tools ce-cards">
      <label className="ce-vault-label" htmlFor="ce-cards-q">
        Add single cards
      </label>
      <div className="ce-cards-games" role="group" aria-label="Game">
        {[{ slug: "", name: "All games" }, ...CARD_GAMES.slice(0, 7)].map((g) => (
          <button
            key={g.slug || "all"}
            type="button"
            aria-pressed={game === g.slug}
            onClick={() => {
              setGame(g.slug);
              run(q, g.slug);
            }}
          >
            {g.name}
          </button>
        ))}
      </div>
      <input
        id="ce-cards-q"
        className="ce-vault-input"
        type="search"
        inputMode="search"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={game === "pokemon" || !game ? "Card name, set or number: charizard 4/102" : "Card name, set or number"}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setNote("");
          run(e.target.value, game);
        }}
      />
      {busy && <p className="ce-vault-muted" aria-live="polite">Searching…</p>}
      {hits && !busy && !hits.length && <p className="ce-vault-muted">No card found. Try the name and the number on the card.</p>}
      {picked ? (
        <div className="ce-cards-pick">
          <img src={cardImage(picked.hit.id)} alt={picked.hit.n} width={72} height={100} loading="lazy" />
          <div>
            <strong>{picked.hit.n}</strong>
            <div className="ce-vault-muted">
              {picked.hit.setName} {picked.hit.no} · {gameName(picked.hit.game)}
            </div>
            <div className="ce-cards-printings" role="group" aria-label="Which printing do you own?">
              {picked.printings.map((p) => (
                <button key={p.name} type="button" className="ce-vault-btn" onClick={() => add(picked, p.name, p.cents)}>
                  + {p.name}
                  {p.cents ? <span className="tabular"> {formatMoney(p.cents, "USD")}</span> : null}
                </button>
              ))}
            </div>
            <button type="button" className="ce-cards-back" onClick={() => setPicked(null)}>
              Back to results
            </button>
          </div>
        </div>
      ) : (
        hits &&
        hits.length > 0 && (
          <ul className="ce-cards-hits">
            {hits.map((h) => (
              <li key={`${h.game}-${h.id}`}>
                <button type="button" onClick={() => choose(h)} aria-label={`${h.n}, ${h.setName} ${h.no}: choose printing`}>
                  <img src={h.img} alt={h.n} width={44} height={61} loading="lazy" decoding="async" />
                  <span className="ce-cards-hitname">
                    <strong>{h.n}</strong>
                    <span className="ce-vault-muted">
                      {h.setName} {h.no}
                      {!game ? ` · ${gameName(h.game)}` : ""}
                    </span>
                  </span>
                  <span className="tabular ce-cards-v">{h.v ? formatMoney(h.v, "USD") : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
      {note && (
        <p className="ce-vault-muted" role="status">
          {note}
        </p>
      )}
      <p className="ce-vault-muted ce-cards-src">Card prices are TCGplayer&apos;s market price (recent sales) in US$, from TCG Singles DB.</p>
    </div>
  );
}
