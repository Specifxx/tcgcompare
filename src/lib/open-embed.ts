// The Sealed Price Index widget (/embed/price-index/<game|all>): a small card with today's level, the week's change and
// a credited link to /data. Plain HTML, no script, noindex (the plain link under the snippet is what search engines follow).
import { esc } from "./embed";

export interface IndexWidget { site: string; siteUrl: string; title: string; level: number | null; week: number | null; n: number; median: number | null; date: string | null }

const pct = (v: number | null) => (v == null ? "week-on-week change builds up from here" : `${v > 0 ? "+" : ""}${v.toFixed(1)}% over 7 days`);

export function indexWidgetHtml(w: IndexWidget): string {
  const href = `${w.siteUrl}/data?utm_source=embed&utm_medium=index`;
  const tone = w.week == null ? "#64748b" : w.week >= 0 ? "#15803d" : "#b91c1c";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(w.title)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}html,body{background:transparent;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}a{text-decoration:none;color:inherit}
.c{display:block;padding:14px;border:1px solid #d6dae1;border-radius:12px;background:#fff;color:#0f172a}.c:hover{border-color:#2563eb}
.h{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b}.l{font-size:34px;font-weight:900;margin-top:2px}.w{font-size:13px;font-weight:700;color:${tone}}
.m{font-size:12px;color:#475569;margin-top:6px}.f{margin-top:4px;text-align:right;font-size:10px;color:#94a3b8}</style></head>
<body><a class="c" href="${esc(href)}" target="_blank" rel="noopener"><div class="h">${esc(w.title)}</div><div class="l">${w.level == null ? "&ndash;" : w.level.toFixed(1)}</div><div class="w">${esc(pct(w.week))}</div><div class="m">${w.n} products${w.median ? `, median US store price $${(w.median / 100).toFixed(2)}` : ""}${w.date ? ` &middot; ${esc(w.date)}` : ""}. Base 100 on the first day.</div></a><div class="f">Data: ${esc(w.site)}, CC BY 4.0</div></body></html>`;
}

export function indexWidgetSnippet(siteUrl: string, siteName: string, slug: string, title: string): string {
  return `<iframe src="${siteUrl}/embed/price-index/${slug}" width="100%" height="150" style="border:0" loading="lazy" title="${esc(title)}"></iframe>\n<p style="font-size:12px;margin:2px 0 0"><a href="${siteUrl}/data">Sealed trading card price data from ${esc(siteName)}</a></p>`;
}
