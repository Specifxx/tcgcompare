"use client";

import Link from "@/components/Link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { ASK_AI_VISITOR_DAILY_CAP } from "@/lib/ask-ai";
import { ASK_EXAMPLES, askPick, askSearchUrl, askSeeAll, parseAsk, type AskGame, type AskRoute } from "@/lib/ask";
import { Icon } from "./Icon";

// "Ask our prices" (lib/ask.ts, DECISIONS.md 2026-11-18): the phone bottom nav's Search tab opens this sheet (a native modal <dialog>, the
// page behind inert) instead of a page load. A sentence in, our own pages and the top live search hits out, no model and no cost: the
// hits come from /api/search (CDN-cached per query). It never opens by itself (pop-up rules): only a tap on Search opens it. Without
// this component mounted the Search tab is a plain link to /search.

export const ASK_OPEN_EVENT = "ask-open";

interface Hit {
  slug: string;
  href?: string;
  name: string;
  set: string;
  image: string | null;
  price: string;
}

export function AskSheet({ games }: { games: AskGame[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // The in-words answer (lib/ask-ai.ts): offered only when the build says it is on (NEXT_PUBLIC_ASK_AI=1) and answered only when the server has
  // its key; a button press asks, never a keystroke, and a visitor gets ASK_AI_VISITOR_DAILY_CAP of them a day (counted in their own browser).
  const aiOn = process.env.NEXT_PUBLIC_ASK_AI === "1";
  const [ai, setAi] = useState<{ q: string; answer: string | null; picks: Hit[] } | "busy" | "none" | null>(null);
  useEffect(() => setAi(null), [q]);
  async function askAi() {
    const key = `ask-ai-${new Date().toISOString().slice(0, 10)}`;
    let n = 0;
    try {
      n = Number(localStorage.getItem(key)) || 0;
    } catch {}
    if (n >= ASK_AI_VISITOR_DAILY_CAP) return setAi("none");
    try {
      localStorage.setItem(key, String(n + 1));
    } catch {}
    setAi("busy");
    track("ask_ai", { words: ask.words.slice(0, 60) });
    try {
      const r = await fetch(`/api/ask?q=${encodeURIComponent(q.trim().slice(0, 120))}`);
      const j = (await r.json()) as { ai: boolean; answer?: string | null; picks?: number[]; hits?: Hit[] };
      if (!j.ai) return setAi("none");
      setAi({ q, answer: j.answer ?? null, picks: (j.picks ?? []).map((i) => j.hits?.[i]).filter((h): h is Hit => !!h) });
    } catch {
      setAi("none");
    }
  }

  useEffect(() => {
    const open = () => {
      setReady(true);
      requestAnimationFrame(() => {
        ref.current?.showModal();
        track("ask_open", { page: pathname.slice(0, 60) });
        input.current?.focus();
      });
    };
    window.addEventListener(ASK_OPEN_EVENT, open);
    return () => window.removeEventListener(ASK_OPEN_EVENT, open);
  }, [pathname]);

  // Closes on navigation (a tapped result or route).
  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  const ask = parseAsk(q, games);
  const url = askSearchUrl(ask);
  useEffect(() => {
    clearTimeout(timer.current);
    if (!url) return setHits(null);
    let live = true;
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(url);
        const j = (await r.json()) as { hits: Hit[] };
        if (live) {
          setHits(j.hits);
          track("ask_query", { words: ask.words.slice(0, 60), hits: j.hits.length });
        }
      } catch {
        if (live) setHits([]);
      }
    }, 300);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const seeAll = askSeeAll(ask);
  const shownHits = hits ? askPick(ask, hits) : [];
  const route = (r: AskRoute) => (
    <Link key={r.href} href={r.href} prefetch={false} onClick={() => track("ask_route", { to: r.href })} className="flex items-center justify-between rounded-xl border border-line bg-raised px-3 py-3 text-sm font-semibold">
      <span>{r.label}</span>
      <span aria-hidden="true">→</span>
    </Link>
  );

  return (
    <dialog
      ref={ref}
      data-ask=""
      aria-label="Ask our prices"
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl border-0 bg-surface p-0 text-ink shadow-lift"
    >
      {ready && (
        <div className="mx-auto max-w-[640px] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Ask our prices</h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-raised">
              <Icon name="close" size={18} />
            </button>
          </div>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (seeAll) window.location.assign(seeAll.href);
            }}
            className="relative mt-2"
          >
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <Icon name="search" size={16} />
            </span>
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cheapest Surging Sparks booster box…"
              aria-label="Ask in plain words"
              enterKeyHint="search"
              autoComplete="off"
              className="h-12 w-full rounded-full border border-line bg-bg pl-9 pr-4 text-base outline-none focus:border-ink/40"
            />
          </form>
          {!q && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Try asking">
              {ASK_EXAMPLES.map((x) => (
                <button key={x} type="button" onClick={() => setQ(x)} className="rounded-full border border-line px-3 py-2 text-sm text-muted">
                  {x}
                </button>
              ))}
            </div>
          )}
          {aiOn && !ask.link && ask.words.split(" ").length >= 2 && (ai === null || ai === "none") && (
            <button type="button" onClick={askAi} disabled={ai === "none"} className="mt-3 h-11 w-full rounded-full border border-line text-sm font-semibold disabled:text-muted">
              {ai === "none" ? "Answers in words are unavailable right now" : "Answer in words"}
            </button>
          )}
          {ai === "busy" && <p className="mt-3 text-sm text-muted">Reading our price files…</p>}
          {ai && typeof ai === "object" && (
            <div className="mt-3 rounded-xl border border-line bg-raised px-3 py-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">AI answer, from this site&apos;s own results</p>
              <p className="mt-1">{ai.answer ?? (ai.picks.length ? "These match best:" : "Nothing here answers that well. Try the results below or the whole site.")}</p>
              {ai.picks.length > 0 && (
                <ul className="mt-2 divide-y divide-line">
                  {ai.picks.map((h) => (
                    <li key={h.slug}>
                      <Link href={h.href ?? `/card/${h.slug}`} prefetch={false} onClick={() => track("ask_ai_click", { slug: h.slug.slice(0, 80) })} className="flex min-h-11 items-center justify-between gap-3 py-2">
                        <span className="min-w-0 truncate font-semibold">{h.name}</span>
                        <span className="tabular shrink-0 font-bold">{h.price}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {ask.routes.length > 0 && <div className="mt-3 grid gap-2">{ask.routes.map(route)}</div>}
          {shownHits.length > 0 && (
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
              {shownHits.map((h) => (
                <li key={h.slug}>
                  <Link href={h.href ?? `/card/${h.slug}`} prefetch={false} onClick={() => track("ask_result_click", { slug: h.slug.slice(0, 80) })} className="flex min-h-14 items-center gap-3 px-3 py-2">
                    {h.image ? <img src={h.image} alt="" width={40} height={40} loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-md bg-raised object-contain" /> : <span className="h-10 w-10 shrink-0 rounded-md bg-raised" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{h.name}</span>
                      <span className="block truncate text-xs text-muted">{h.set}</span>
                    </span>
                    <span className="tabular shrink-0 text-sm font-bold">{h.price}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {hits && hits.length === 0 && url && <p className="mt-3 text-sm text-muted">Nothing on this site matches those words. Try the product&apos;s name, or search the whole site.</p>}
          {seeAll && (
            <Link href={seeAll.href} prefetch={false} className="mt-3 flex h-12 items-center justify-center rounded-full bg-ink text-sm font-bold text-bg">
              {seeAll.label}
            </Link>
          )}
          <p className="mt-3 text-xs text-muted">Each price is the product&apos;s headline price: open one to compare every store. Answers come from this site&apos;s own price files, with no guessing and nothing stored about you.</p>
        </div>
      )}
    </dialog>
  );
}
