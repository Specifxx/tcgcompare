// Sticky jump links under the header (owner's UX review, 2026-11-23, P1 13: "Add sticky anchors (Prices, History, Facts, FAQ)").
// Plain in-page anchors in the server HTML: no script, no layout shift (one 40px row), and the sections carry scroll-mt so the
// heading lands below the sticky header and this row.
export function JumpLinks({ links }: { links: { id: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="sticky top-[var(--hdr)] z-30 -mx-4 -my-4 border-b border-line bg-bg/90 px-4 backdrop-blur sm:mx-0 sm:rounded-b-xl sm:px-2">
      <ul className="scroller gap-1 py-1.5 text-sm">
        {links.map((l) => (
          <li key={l.id}>
            <a href={`#${l.id}`} className="inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3 text-muted hover:bg-raised hover:text-ink focus-visible:bg-raised focus-visible:text-ink">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
