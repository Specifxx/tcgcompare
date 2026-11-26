"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { track } from "@vercel/analytics";
import { SearchBox } from "./SearchBox";
import { FamilySearch } from "./FamilySearch";

interface Hit { slug: string; href?: string; name: string; set: string; image: string | null; price: string }

/** The results of /search?q=: read from the address in the browser (useSearchParams under the page's Suspense), so the page itself stays one static copy. */
export function SearchResults() {
  // useSearchParams (inside the page's Suspense) so a second search from this page's own box updates the list.
  const params = useSearchParams();
  // Read the query only after mount. The page is force-static, so its HTML was rendered with NO query (Next gives a
  // force-static page empty search params); using the address's query in the first render made hydration disagree with
  // that HTML (React #418/#422 on every /search?q=, found by the QA guard 2026-11-26). The first render now matches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const q: string | null = mounted && params ? (params.get("q") ?? "").trim().slice(0, 80) : null;
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [corrected, setCorrected] = useState<string | null>(null);
  const [popular, setPopular] = useState<Hit[]>([]);
  useEffect(() => {
    if (q === null) return;
    setHits(null);
    setCorrected(null);
    setPopular([]);
    if (q.length < 2) return setHits([]);
    let live = true;
    fetch(`/api/search?q=${encodeURIComponent(q.toLowerCase())}&limit=60`)
      .then((r) => r.json() as Promise<{ hits: Hit[]; corrected?: string; popular?: Hit[] }>)
      .then((d) => {
        if (!live) return;
        setHits(d.hits);
        setCorrected(d.corrected ?? null);
        setPopular(d.popular ?? []);
        // Funnel (owner's UX review, 24): searches that found nothing, so the next fix is the one people need.
        if (!d.hits.length) track("search_none", { q: q.toLowerCase().slice(0, 40), page: "search" });
        else if (d.corrected) track("search_corrected", { q: q.toLowerCase().slice(0, 40), to: d.corrected.slice(0, 40) });
      })
      .catch(() => live && setHits([]));
    return () => {
      live = false;
    };
  }, [q]);
  return (
    <div className="flex flex-col gap-6">
      <SearchBox big />
      {q !== null && q.length >= 2 && (
        <p className="text-sm text-muted" aria-live="polite">
          {hits === null
            ? `Searching for “${q}”…`
            : corrected
              ? <>Showing {hits.length}{hits.length === 60 ? "+" : ""} result{hits.length === 1 ? "" : "s"} for <b className="text-ink">“{corrected}”</b>. No exact match for “{q}”.</>
              : `${hits.length}${hits.length === 60 ? "+" : ""} result${hits.length === 1 ? "" : "s"} for “${q}”`}
        </p>
      )}
      {hits && hits.length > 0 && (
        <ul className="flex flex-col gap-1">
          {hits.map((h) => (
            <li key={h.href ?? h.slug}>
              <a href={h.href ?? `/card/${h.slug}`} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-raised">
                {h.image ? <img src={h.image} alt={h.name} width={40} height={56} className="h-14 w-10 rounded object-contain" loading="lazy" /> : <span className="h-14 w-10" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{h.name}</span>
                  <span className="block truncate text-xs text-muted">{h.set}</span>
                </span>
                <span className="tabular text-sm font-semibold text-brand">{h.price}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {hits && hits.length === 0 && q && q.length >= 2 && (
        <div className="flex flex-col gap-3">
          <p className="text-muted">Nothing matched “{q}”. Try fewer words or a set code, or <a className="link" href="/sealed">browse every sealed product</a>.</p>
          {popular.length > 0 && (
            <>
              <h2 className="text-lg font-bold">Popular right now</h2>
              <ul className="flex flex-col gap-1">
                {popular.map((h) => (
                  <li key={h.href ?? h.slug}>
                    <a href={h.href ?? `/card/${h.slug}`} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-raised">
                      {h.image ? <img src={h.image} alt={h.name} width={40} height={56} className="h-14 w-10 rounded object-contain" loading="lazy" /> : <span className="h-14 w-10" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{h.name}</span>
                        <span className="block truncate text-xs text-muted">{h.set}</span>
                      </span>
                      <span className="tabular text-sm font-semibold text-brand">{h.price}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {q && q.length >= 2 && <FamilySearch q={q} />}
    </div>
  );
}
