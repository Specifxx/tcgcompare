// The deal board's rows, built on the server from the Sniper's drop log and the latest import (lib/drop-board.ts has the rules).
import { SITE } from "@/site.config";
import { priceOf, productById, refCents, setById } from "./data";
import { goHref } from "./affiliate";
import { money } from "./format";
import { imageAt } from "./image";
import { lineById } from "./lines";
import { shortName } from "./names";
import { CURRENCY } from "./site-types";
import { readDropLog, type LoggedDrop } from "./sniper-board";
import { BOARD_MAX, dropState, underMarket, type BoardRow } from "./drop-board";

function rowOf(d: LoggedDrop): BoardRow | null {
  const p = productById(d.p);
  const s = SITE.stores.find((x) => x.key === d.s);
  if (!p || !s) return null;
  const cur = CURRENCY[s.market];
  const line = lineById(setById(p.setId)?.line);
  // The store's cheapest in-stock price for this product at our latest check: what the card says is true now.
  const live = priceOf(p.id)
    .offers.filter((o) => o.source === s.key && o.inStock)
    .sort((a, b) => a.cents - b.cents)[0];
  const state = dropState(d.c, live?.cents ?? null);
  const under = state === "gone" ? null : underMarket(live?.cents ?? d.c, s.market, refCents(p.id));
  return {
    id: d.id,
    at: d.at,
    kind: d.kind,
    slug: p.slug,
    name: shortName(p.name),
    img: imageAt(p.image, "200w"),
    game: line ? { id: line.id, short: line.short, color: line.color } : null,
    store: s.name,
    market: s.market,
    price: money(d.c, cur),
    ...(d.was ? { was: money(d.was, cur), pct: d.pct } : {}),
    ...(under ? { under } : {}),
    state,
    ...(state === "moved" && live ? { now: money(live.cents, cur) } : {}),
    ...(live ? { go: goHref(live, p.id, "drops") } : {}),
  };
}

/** The newest drops, newest first, at most BOARD_MAX. */
export function boardRows(): BoardRow[] {
  return (readDropLog()?.drops ?? [])
    .map(rowOf)
    .filter((r): r is BoardRow => !!r)
    .slice(0, BOARD_MAX);
}

export const boardRow = (id: string): BoardRow | null => {
  const d = readDropLog()?.drops.find((x) => x.id === id);
  return d ? rowOf(d) : null;
};

export const boardUpdatedAt = (): string | null => readDropLog()?.updatedAt ?? null;
