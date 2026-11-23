const SYM: Record<string, string> = { USD: "$", GBP: "£", CAD: "C$", AUD: "A$", EUR: "€", SGD: "S$" };

export function money(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  const v = cents / 100;
  const s = v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(2);
  return `${SYM[currency] ?? currency + " "}${s}`;
}

export function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const h = (now - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return "under an hour ago";
  if (h < 48) return Math.round(h) === 1 ? "1 hour ago" : `${Math.round(h)} hours ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** "Jun 26, 2026" from an ISO date (US-first, owner 2026-11-22); the input back when it is not a date. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
