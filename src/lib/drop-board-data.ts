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
import { bragGap } from "./share";
import { MARKET_NAME } from "./sniper";
import type { Market } from "./site-types";
import { BOARD_MAX, GAP_MIN_PCT, dropState, gapLine, pickGap, underMarket, type BoardRow, type StoreGap } from "./drop-board";

/** The spread between in-stock stores for a product in one market, from the latest import; null when there is none worth saying. */
export function storeGap(productId: number, market: Market): StoreGap | null {
  const g = bragGap(priceOf(productId).offers, market);
  if (!g || g.pct < GAP_MIN_PCT) return null;
  const cur = g.low.currency;
  return { low: money(g.low.cents, cur), high: money(g.high.cents, cur), diff: money(g.high.cents - g.low.cents, cur), diffCents: g.high.cents - g.low.cents, pct: g.pct, stores: g.sellers, where: MARKET_NAME[market] };
}

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
  const gap = state === "gone" ? null : storeGap(p.id, s.market);
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
    ...(gap ? { gap: gapLine(shortName(p.name), gap) } : {}),
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

/** The banner's gap: one product on the board, still in stock, with the widest spread between stores (US first). */
export function boardGap(): { name: string; slug: string; gap: StoreGap; line: string } | null {
  const seen = new Set<number>();
  const rows = (readDropLog()?.drops ?? []).slice(0, BOARD_MAX).flatMap((d) => {
    const p = productById(d.p);
    const s = SITE.stores.find((x) => x.key === d.s);
    if (!p || !s || seen.has(p.id)) return [];
    seen.add(p.id);
    const gap = storeGap(p.id, s.market);
    return gap ? [{ name: shortName(p.name), slug: p.slug, market: s.market, gap }] : [];
  });
  const top = pickGap(rows);
  return top ? { name: top.name, slug: top.slug, gap: top.gap, line: gapLine(top.name, top.gap) } : null;
}
