import { CHROME_EXTENSION_URL } from "@/lib/extension";

// "Add to Chrome": the buying assistant's install button (DECISIONS.md 2026-11-22). Renders nothing until
// CHROME_EXTENSION_URL holds the approved Chrome Web Store listing, so it switches on with a one-line change.
// Desktop only (Chrome extensions don't run on phones), server-rendered, never above a price, no pop-up.
export function ExtensionCta({ className = "", from = "card" }: { className?: string; from?: string }) {
  if (!CHROME_EXTENSION_URL) return null;
  const href = `${CHROME_EXTENSION_URL}?utm_source=tcgprices&utm_medium=site&utm_campaign=extension&utm_content=${encodeURIComponent(from)}`;
  return (
    <aside aria-label="Chrome extension" className={`hidden items-center justify-between gap-3 rounded-xl border border-brand bg-brand-soft p-4 md:flex ${className}`}>
      <div>
        <p className="text-sm font-bold">See the cheapest store price on every TCGplayer page</p>
        <p className="mt-0.5 text-xs opacity-80">Our free Chrome extension puts this page&apos;s prices on TCGplayer, with one click to the cheapest store. No account, nothing tracked.</p>
      </div>
      <a href={href} target="_blank" rel="noopener" className="btn-primary shrink-0">
        Add to Chrome, free
      </a>
    </aside>
  );
}
