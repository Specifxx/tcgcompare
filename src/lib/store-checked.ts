// When each store's price was last read (owner's UX review, 2026-11-23, P0 2: "show relative freshness per store"). A store our
// own crawl reads: the crawl's last full read of it (meta.crawl.seen, "host|market"). A store a sister site reads: that sister's
// data time (meta.sisters[..].at). Otherwise unknown: the row then says nothing rather than guess. Pure over the meta it is given.
import type { Meta } from "./site-types";

export function storeCheckedMap(meta: Meta | null | undefined, stores: readonly { key: string; base?: string; market?: string }[], keys: Iterable<string>): Record<string, string> {
  if (!meta) return {};
  const want = new Set(keys);
  const out: Record<string, string> = {};
  const bySister = new Map<string, string>();
  for (const s of Object.values(meta.sisters ?? {})) {
    if (!s.at) continue;
    for (const k of s.stores ?? []) if (want.has(k) && (!bySister.has(k) || bySister.get(k)! < s.at)) bySister.set(k, s.at);
  }
  const seen = meta.crawl?.seen ?? {};
  for (const st of stores) {
    if (!want.has(st.key)) continue;
    let host = "";
    try {
      host = st.base ? new URL(st.base).host.replace(/^www\./, "") : "";
    } catch {
      host = "";
    }
    const crawled = host ? seen[`${host}|${st.market ?? ""}`] ?? seen[`www.${host}|${st.market ?? ""}`] : undefined;
    const at = [crawled, bySister.get(st.key)].filter((x): x is string => !!x).sort().pop();
    if (at) out[st.key] = at;
  }
  return out;
}
