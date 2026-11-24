import Link from "@/components/Link";
import { longDate, preorderPath } from "@/lib/preorders";
import { openPreorder } from "@/lib/preorder-nav";
import { StripClose } from "./StripClose";

// One line under the header on every page while a release is on pre-order,
// linking its landing page: Rift Compare's season banner did the same for
// /radiance-preorders, which became its most visited page. Since 2026-11-13 a
// page has ONE such line: while a sale's strip shows (HolidayStrip), this one
// waits (app/layout.tsx) and the header's Deals menu carries the link instead.
export function PreorderStrip() {
  const next = openPreorder();
  if (!next) return null;
  return (
    <div className="relative border-b border-line bg-surface" data-promo-strip="preorder">
      <p className="truncate py-1.5 page pr-10 text-center text-xs text-muted sm:text-sm">
        <Link href={preorderPath(next)} className="hover:text-fg">
          <b className="text-fg">{next.name}</b> pre-orders are open · out {longDate(next.releasedOn)} · <span className="link">compare every store →</span>
        </Link>
      </p>
      <StripClose strip="preorder" />
    </div>
  );
}
