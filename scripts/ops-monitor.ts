// Runs in GitHub Actions every three hours (ops-monitor.yml). Each check
// returns ok / warn / fail. Every result is written to ops-status.json, which the
// workflow publishes on this repo's `ops-status` branch for Empire HQ
// (riftcompare.com/admin/hq) and the one Monday report (owner, 2026-11-02:
// "one Monday email", amber only on the dashboard). Only a FAIL fails the run,
// and a failed run is GitHub's email to the owner: red is the only thing that
// mails. Add a check here for every new scheduled job, API or limit.
import { FAMILY_DIR, FEED_FILE, familyFeeds } from "@/lib/family";
import fs from "node:fs";
import path from "node:path";
import { SITE } from "@/site.config";
import type { Meta } from "@/lib/site-types";
import { SITE_HOST } from "@/lib/site";
import { readKitFile } from "@/lib/kit-store";
import { crawlVerdict } from "@/lib/import/crawl";
import { ebayPriceVerdict } from "@/lib/no-ebay-prices";

type Result = { name: string; status: "ok" | "warn" | "fail"; detail: string };
const site = (process.env.NEXT_PUBLIC_SITE_URL || `https://${SITE_HOST}`).replace(/\/$/, "");
// Until the site is live (the SITE_URL repository variable is set at launch),
// the live checks warn instead of failing every three hours.
const live = !!process.env.NEXT_PUBLIC_SITE_URL;

async function check(name: string, fn: () => Promise<Omit<Result, "name">>): Promise<Result> {
  try {
    return { name, ...(await fn()) };
  } catch (e) {
    return { name, status: "fail", detail: (e as Error).message };
  }
}

async function main() {
  const meta = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/public/meta.json"), "utf8")) as Meta;
  const ageH = (Date.now() - new Date(meta.updatedAt).getTime()) / 3_600_000;
  const results = await Promise.all([
    check("Live site", async () => {
      if (!live) return { status: "warn", detail: "SITE_URL repository variable not set — live checks skipped" };
      const r = await fetch(site, { signal: AbortSignal.timeout(20000) });
      return r.ok ? { status: "ok", detail: `${r.status}` } : { status: "fail", detail: `HTTP ${r.status}` };
    }),
    check("The sealed hub", async () => {
      if (!live) return { status: "warn", detail: "SITE_URL repository variable not set — live checks skipped" };
      const r = await fetch(`${site}/sealed`, { signal: AbortSignal.timeout(20000) });
      return r.ok ? { status: "ok", detail: `${r.status}` } : { status: "fail", detail: `HTTP ${r.status}` };
    }),
    // Sealed only (2026-11-06): every old single-card URL must keep redirecting to its set, never 404.
    check("Retired card URLs redirect", async () => {
      if (!live) return { status: "warn", detail: "SITE_URL repository variable not set — live checks skipped" };
      const map = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/redirects/cards.json"), "utf8")) as { bySet: Record<string, string[]> };
      const [, slugs] = Object.entries(map.bySet).find(([s, l]) => s && l.length)!;
      const r = await fetch(`${site}/card/${slugs[0]}`, { redirect: "manual", signal: AbortSignal.timeout(20000) });
      const to = r.headers.get("location") ?? "";
      return (r.status === 301 || r.status === 308) && /\/(sets\/|sealed)/.test(to)
        ? { status: "ok", detail: `${r.status} → ${to.replace(site, "")}` }
        : { status: "fail", detail: `/card/${slugs[0]} answered HTTP ${r.status}${to ? ` → ${to}` : ""}, not a permanent redirect to its set` };
    }),
    check("Daily price import", async () =>
      ageH < 30 ? { status: "ok", detail: `${ageH.toFixed(1)}h old` } : { status: ageH < 54 ? "warn" : "fail", detail: `data is ${ageH.toFixed(0)}h old — check the Refresh prices workflow` },
    ),
    check("Store imports", async () => {
      const bad = Object.entries(meta.stores).filter(([, s]) => !s.ok || s.matched === 0);
      return bad.length ? { status: bad.length > SITE.stores.length / 3 ? "fail" : "warn", detail: bad.map(([k, s]) => `${k}: ${s.error ?? "0 matched"}`).join("; ") } : { status: "ok", detail: `${SITE.stores.length} stores` };
    }),
    // TCG Prices has no eBay prices (owner, 2026-11-14): eBay is the pinned tagged search only, never a price row,
    // "Best price" or "Cheapest in". An eBay offer in the published data is red.
    check("No eBay prices", async () => ({ ...ebayPriceVerdict(path.join(process.cwd(), "data/public")) })),
    // Our own crawl of the games no sister covers (scripts/crawl-uncovered.ts, before every import; lib/import/crawl.ts).
    check("Own store crawl", async () => {
      let listed: unknown[] = [];
      try {
        listed = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/crawl/stores.json"), "utf8")) as unknown[];
      } catch {}
      if (!Array.isArray(listed) || !listed.length) return { status: "ok", detail: "no stores probed yet (data/crawl/stores.json empty): run the Crawl probe workflow" };
      return crawlVerdict(meta, listed.length, Date.now());
    }),
    // Search Console index-diet tracking (scripts/gsc-weekly.ts, Mondays): a missing credential or a stale week is amber, never red.
    check("Search Console weekly", async () => {
      let last: { date: string; impressions28d: number } | null = null;
      try {
        const lines = fs.readFileSync(path.join(process.cwd(), "data/gsc/weekly.jsonl"), "utf8").trim().split("\n").filter(Boolean);
        last = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
      } catch {}
      if (!last) return { status: "warn", detail: "no week recorded yet: needs Bill's Search Console sign-in (GSC_SERVICE_ACCOUNT_JSON secret, GSC_PROPERTY variable)" };
      const age = (Date.now() - new Date(last.date).getTime()) / 86_400_000;
      return age <= 10 ? { status: "ok", detail: `last week recorded ${last.date}, ${last.impressions28d} impressions in 28 days` } : { status: "warn", detail: `last week recorded ${last.date} (${age.toFixed(0)} days ago): check the Search Console weekly workflow` };
    }),
    // The index gate (lib/indexing.ts): how many product pages ask to be indexed. None means the data is stale or the gate broke.
    check("Index gate", async () => {
      const { products, indexSignals, setById } = await import("@/lib/data");
      const { cardIndexable } = await import("@/lib/indexing");
      const sealed = products().filter((p) => p.kind === "sealed");
      const n = sealed.filter((p) => cardIndexable(p, indexSignals(p), setById(p.setId))).length;
      return n > 0 ? { status: "ok", detail: `${n} of ${sealed.length} sealed product pages qualify for the index and sitemap` } : { status: "fail", detail: `0 of ${sealed.length} sealed product pages qualify for the index: the data is older than 14 days or the gate is broken` };
    }),
    // The Compare Empire network feed (scripts/family-sync.ts): sisters' "Also in this cluster"
    // blocks read it from GitHub, so a stale one silently empties their tiles for this site.
    check("Family feed", async () => {
      try {
        const f = JSON.parse(fs.readFileSync(path.join(FAMILY_DIR, FEED_FILE), "utf8")) as { generatedAt: string; items: unknown[] };
        const age = (Date.now() - new Date(f.generatedAt).getTime()) / 3_600_000;
        const sisters = familyFeeds().map((x) => x.site);
        if (age > 54) return { status: "fail", detail: `family-feed.json is ${age.toFixed(0)}h old — check the Refresh prices workflow's family step` };
        return { status: age > 30 ? "warn" : "ok", detail: `${f.items.length} items, ${age.toFixed(1)}h old; ${sisters.length} sister feeds (${sisters.join(", ") || "none yet"})` };
      } catch {
        return { status: "fail", detail: "data/public/family/family-feed.json missing — check the Refresh prices workflow's family step" };
      }
    }),
    // Amazon's Creators API (scripts/amazon-asins.ts, daily): informational until Amazon grants access ("off" without
    // secrets, "refused" until the store's account qualifies), then a warning if a market's finder stops running.
    check("Amazon ASIN finder", async () => {
      const dir = path.join(process.cwd(), "data/amazon");
      const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^status-[A-Z]+\.json$/.test(f)) : [];
      if (!files.length) return { status: "ok", detail: "not run yet (no AMAZON_CREATORS_* secrets, or no sealed products)" };
      const parts: string[] = [];
      let stale = 0;
      for (const f of files) {
        const s = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { at: string; state: string; known?: number; found?: number };
        const age = (Date.now() - new Date(s.at).getTime()) / 3_600_000;
        if (s.state === "ok" && age > 54) stale++;
        parts.push(`${f.slice(7, -5)}: ${s.state}${s.known != null ? `, ${s.known} ASINs` : ""}, ${age.toFixed(0)}h ago`);
      }
      return { status: stale ? "warn" : "ok", detail: parts.join("; ") };
    }),
    // The model-kit import (SITE.kits, scripts/import-kits.ts): its own file,
    // its own stores.
    ...(SITE.kits
      ? [
          check("Model kit import", async () => {
            const f = readKitFile();
            if (!f.generatedAt) return { status: "fail", detail: "data/public/kits.json missing — check the Refresh prices workflow's kit step" };
            const age = (Date.now() - new Date(f.generatedAt).getTime()) / 3_600_000;
            const bad = Object.entries(f.stores).filter(([, s]) => !s.ok || s.matched === 0);
            const total = SITE.kits!.stores.length;
            if (age > 54) return { status: "fail", detail: `kit data is ${age.toFixed(0)}h old` };
            if (f.kits.length < 100) return { status: "fail", detail: `only ${f.kits.length} kits` };
            if (bad.length) return { status: bad.length > total / 3 ? "fail" : "warn", detail: bad.map(([k, s]) => `${k}: ${s.error ?? "0 matched"}`).join("; ") };
            return { status: age > 30 ? "warn" : "ok", detail: `${f.kits.length} kits from ${total} stores, ${age.toFixed(1)}h old` };
          }),
        ]
      : []),
  ]);
  for (const r of results) console.log(`${r.status.toUpperCase().padEnd(4)} ${r.name}: ${r.detail}`);
  // Empire HQ's copy (status and our own sentences only: the branch is public, like this log).
  const overall = results.some((r) => r.status === "fail") ? "fail" : results.some((r) => r.status === "warn") ? "warn" : "ok";
  const status = { v: 1, site: SITE_HOST, at: new Date().toISOString(), overall, checks: results };
  fs.writeFileSync(process.env.OPS_STATUS_FILE || "ops-status.json", JSON.stringify(status, null, 1) + "\n");
  const bad = results.filter((r) => r.status === "fail");
  if (bad.length) {
    // A failed run makes GitHub email the repo owner (no email service needed). Warnings
    // wait for Empire HQ and the Monday report.
    console.error(`
${bad.length} check(s) failed: ${bad.map((r) => r.name).join(", ")}`);
    process.exit(1);
  }
}
main();
