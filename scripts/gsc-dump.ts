// One-off Search Console read for the "3x Google clicks" work (2026-11-19). Writes data/gsc/dump.json on a claude/** branch
// only (never main): daily totals, top queries and pages, query x page, sitemaps, and URL Inspection of a sample per sitemap kind.
import fs from "node:fs";
import crypto from "node:crypto";

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
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON, prop = process.env.GSC_PROPERTY;
  if (!raw || !prop) throw new Error("no credential");
  const { urlsOfType, SITEMAP_TYPES } = await import("@/lib/sitemap-split");
  const auth = { Authorization: `Bearer ${await token(JSON.parse(raw))}`, "Content-Type": "application/json" };
  const api = "https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(prop);
  const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  const q = async (dims: string[], start = "2026-11-01", end = day(0), limit = 5000, extra: object = {}) => {
    const r = await fetch(`${api}/searchAnalytics/query`, { method: "POST", headers: auth, body: JSON.stringify({ startDate: start, endDate: end, dimensions: dims, rowLimit: limit, dataState: "all", ...extra }) });
    if (!r.ok) return { error: `HTTP ${r.status} ${await r.text()}` };
    return ((await r.json()) as { rows?: unknown[] }).rows ?? [];
  };
  const out: Record<string, unknown> = { at: new Date().toISOString() };
  out.byDate = await q(["date"]);
  out.byDateType = { image: await q(["date"], undefined, undefined, 100, { type: "image" }), discover: await q(["date"], undefined, undefined, 100, { type: "discover" }) };
  out.queries = await q(["query"]);
  out.pages = await q(["page"]);
  out.queryPage = await q(["query", "page"]);
  out.country = await q(["country"]);
  out.device = await q(["device"]);
  try { out.sitemaps = await (await fetch(`${api}/sitemaps`, { headers: auth })).json(); } catch (e) { out.sitemaps = String(e); }
  const inspected: unknown[] = [];
  for (const t of SITEMAP_TYPES) {
    const urls = urlsOfType(t).map((e) => e.url);
    const n = t === "products" ? 60 : 15;
    const step = Math.max(1, Math.floor(urls.length / n));
    const sample = urls.filter((_, i) => i % step === 0).slice(0, n);
    for (const u of sample) {
      const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { method: "POST", headers: auth, body: JSON.stringify({ inspectionUrl: u, siteUrl: prop }) });
      if (!r.ok) { inspected.push({ t, u, error: r.status }); continue; }
      const s = ((await r.json()) as { inspectionResult?: { indexStatusResult?: Record<string, unknown> } }).inspectionResult?.indexStatusResult ?? {};
      inspected.push({ t, u, total: urls.length, coverage: s.coverageState, verdict: s.verdict, lastCrawl: s.lastCrawlTime, robots: s.robotsTxtState, indexing: s.indexingState, fetch: s.pageFetchState, googleCanonical: s.googleCanonical, userCanonical: s.userCanonical, referring: s.referringUrls, sitemap: s.sitemap });
    }
  }
  out.inspected = inspected;
  out.sitemapCounts = Object.fromEntries(SITEMAP_TYPES.map((t) => [t, urlsOfType(t).length]));
  fs.mkdirSync("data/gsc", { recursive: true });
  fs.writeFileSync("data/gsc/dump.json", JSON.stringify(out, null, 1));
  console.log("[gsc-dump] done", inspected.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
