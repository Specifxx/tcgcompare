"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchBox } from "./SearchBox";
import { FamilySearch } from "./FamilySearch";

interface Hit { slug: string; href?: string; name: string; set: string; image: string | null; price: string }

/** The results of /search?q=: read from the address in the browser (useSearchParams under the page's Suspense), so the page itself stays one static copy. */
export function SearchResults() {
  // useSearchParams (inside the page's Suspense) so a second search from this page's own box updates the list.
  const params = useSearchParams();
  const q: string | null = params ? (params.get("q") ?? "").trim().slice(0, 80) : null;
  const [hits, setHits] = useState<Hit[] | null>(null);
  useEffect(() => {
    if (q === null) return;
    setHits(null);
    if (q.length < 2) return setHits([]);
    let live = true;
    fetch(`/api/search?q=${encodeURIComponent(q.toLowerCase())}&limit=60`)
      .then((r) => r.json() as Promise<{ hits: Hit[] }>)
      .then((d) => live && setHits(d.hits))
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
          {hits === null ? `Searching for “${q}”…` : `${hits.length}${hits.length === 60 ? "+" : ""} result${hits.length === 1 ? "" : "s"} for “${q}”`}
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
      {hits && hits.length === 0 && q && q.length >= 2 && <p className="text-muted">Nothing matched. Try fewer words, or a set code.</p>}
      {q && q.length >= 2 && <FamilySearch q={q} />}
    </div>
  );
}
