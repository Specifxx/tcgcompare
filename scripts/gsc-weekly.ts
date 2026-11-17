// Weekly Search Console index-diet tracking (Grok growth report, item 10, owner 2026-11-17). Appends ONE row a week to
// data/gsc/weekly.jsonl (public with the source: counts and public URLs only, nothing private):
//   { date, impressions28d, clicks28d, pagesWithImpressions, sitemap: {submitted, indexed}, inspected: {n, indexed, crawledNotIndexed, other},
//     restore: [urls] }
// and rewrites data/gsc/restore.json, the list of product slugs the index gate must ask to be indexed after all.
//
// RESTORE RULE: a noindexed product page (it fails the gate in lib/indexing.ts) that had more than 10 impressions in the
// last 28 days is added to restore.json when total impressions fell more than 25% week on week. restore.json is read by
// indexSignals (lib/data.ts); a slug on it is indexable whatever the gate says, until the next run drops it.
//
// CREDENTIAL: needs the secret GSC_SERVICE_ACCOUNT_JSON (a Google service account key) and that account added as a USER of the
// Search Console property (Settings > Users and permissions), plus the repository variable GSC_PROPERTY ("sc-domain:tcgprices.app"
// or "https://tcgprices.app/"). Neither exists yet: only Bill can do that sign-in. Without them this script exits 0 and says so,
// and the ops monitor shows a warning (never a red).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface WeeklyRow { date: string; impressions28d: number; clicks28d: number; pagesWithImpressions: number; sitemap: { submitted: number; indexed: number } | null; inspected: { n: number; indexed: number; crawledNotIndexed: number; other: number }; restore: string[] }

/** Pure: the slugs to restore. `pages` are /card/ URLs with impressions in 28 days, `noindexed` the set of slugs the gate refuses. */
export function restoreList(prevImpr: number | null, impr: number, pages: { slug: string; impressions: number }[], noindexed: Set<string>): string[] {
  if (prevImpr == null || prevImpr <= 0 || impr >= prevImpr * 0.75) return [];
  return pages.filter((p) => p.impressions > 10 && noindexed.has(p.slug)).map((p) => p.slug).sort();
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
async function token(key: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ iss: key.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(key.private_key);
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${b64(sig)}` }) });
  const j = (await r.json()) as { access_token?: string };
  if (!j.access_token) throw new Error(`token HTTP ${r.status}`);
  return j.access_token;
}

async function main() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  const prop = process.env.GSC_PROPERTY;
  if (!raw || !prop) return console.log("[gsc] GSC_SERVICE_ACCOUNT_JSON / GSC_PROPERTY not set: Bill's Search Console sign-in is needed. Nothing recorded.");
  const { products, indexSignals, setById } = await import("@/lib/data");
  const { cardIndexable } = await import("@/lib/indexing");
  const { SITE_URL } = await import("@/lib/site");
  const auth = { Authorization: `Bearer ${await token(JSON.parse(raw))}`, "Content-Type": "application/json" };
  const api = "https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(prop);
  const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  const q = async (start: string, end: string, dims: string[]) => {
    const r = await fetch(`${api}/searchAnalytics/query`, { method: "POST", headers: auth, body: JSON.stringify({ startDate: start, endDate: end, dimensions: dims, rowLimit: 25000 }) });
    if (!r.ok) throw new Error(`searchAnalytics HTTP ${r.status}`);
    return ((await r.json()) as { rows?: { keys: string[]; clicks: number; impressions: number }[] }).rows ?? [];
  };
  const pageRows = await q(day(30), day(2), ["page"]);
  const impressions28d = pageRows.reduce((s, r) => s + r.impressions, 0);
  const clicks28d = pageRows.reduce((s, r) => s + r.clicks, 0);
  // Impressions a week ago: the same 28-day window ending a week earlier.
  const prevRows = await q(day(37), day(9), ["page"]);
  const prevImpr = prevRows.reduce((s, r) => s + r.impressions, 0);
  const file = path.join(process.cwd(), "data/gsc/weekly.jsonl");
  let sitemap: WeeklyRow["sitemap"] = null;
  try {
    const r = await fetch(`${api}/sitemaps/${encodeURIComponent(`${SITE_URL}/sitemaps/products.xml`)}`, { headers: auth });
    const c = ((await r.json()) as { contents?: { submitted?: string; indexed?: string }[] }).contents?.[0];
    if (c) sitemap = { submitted: Number(c.submitted ?? 0), indexed: Number(c.indexed ?? 0) };
  } catch {}
  // A sample of the sitemap's product URLs through URL Inspection (2,000 a day per property is the limit; 150 here).
  const qualifying = products().filter((p) => p.kind === "sealed" && cardIndexable(p, indexSignals(p), setById(p.setId)));
  const sample = qualifying.filter((_, i) => i % Math.max(1, Math.floor(qualifying.length / 150)) === 0).slice(0, 150);
  const inspected = { n: 0, indexed: 0, crawledNotIndexed: 0, other: 0 };
  for (const p of sample) {
    const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { method: "POST", headers: auth, body: JSON.stringify({ inspectionUrl: `${SITE_URL}/card/${p.slug}`, siteUrl: prop }) });
    if (!r.ok) break;
    const cov = ((await r.json()) as { inspectionResult?: { indexStatusResult?: { coverageState?: string } } }).inspectionResult?.indexStatusResult?.coverageState ?? "";
    inspected.n++;
    if (/^Submitted and indexed|^Indexed/i.test(cov)) inspected.indexed++;
    else if (/Crawled - currently not indexed/i.test(cov)) inspected.crawledNotIndexed++;
    else inspected.other++;
  }
  const noindexed = new Set(products().filter((p) => p.kind === "sealed" && !cardIndexable(p, indexSignals(p), setById(p.setId))).map((p) => p.slug));
  const pages = pageRows.flatMap((r) => { const m = /\/card\/([^/?#]+)$/.exec(r.keys[0]); return m ? [{ slug: m[1], impressions: r.impressions }] : []; });
  const restore = restoreList(prevImpr, impressions28d, pages, noindexed);
  const row: WeeklyRow = { date: day(0), impressions28d, clicks28d, pagesWithImpressions: pageRows.length, sitemap, inspected, restore };
  fs.appendFileSync(file, JSON.stringify(row) + "\n");
  fs.writeFileSync(path.join(process.cwd(), "data/gsc/restore.json"), JSON.stringify({ at: row.date, slugs: restore }));
  console.log("[gsc]", JSON.stringify(row));
}
if (process.argv[1]?.endsWith("gsc-weekly.ts")) main().catch((e) => { console.error("[gsc] failed:", e.message); process.exit(1); });
