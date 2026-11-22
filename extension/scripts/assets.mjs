// Draws a site's extension icons (16/32/48/128 from its icon SVG) and its Chrome Web Store images (1280x800
// screenshots, the 440x280 small tile and the 1400x560 marquee) with the pre-installed Playwright Chromium:
//   node extension/scripts/assets.mjs <siteId> <sample.json>
// sample.json holds one REAL product from the site's /extension.json ({ id, item, line, asOf }) so every number in
// a store image is a real price on its date. Icons go to sites/<id>/icons (committed); store images to
// sites/<id>/store (committed, uploaded by hand in the developer dashboard).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [id, samplePath] = process.argv.slice(2);
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "sites", `${id}.json`), "utf8"));
const svg = fs.readFileSync(path.resolve(ROOT, site.icon), "utf8");
const sample = JSON.parse(fs.readFileSync(samplePath, "utf8"));
const iconsDir = path.join(ROOT, "sites", id, "icons");
const storeDir = path.join(ROOT, "sites", id, "store");
fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(storeDir, { recursive: true });
const svgUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const s of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="${svgUri}" width="${s}" height="${s}" style="display:block"></body></html>`);
  await page.screenshot({ path: path.join(iconsDir, `${s}.png`), omitBackground: true });
}

const usd = (c) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
const it = sample.item;
const pct = it.m && it.p.US ? Math.round((1 - it.p.US / it.m) * 100) : 0;
const panel = `
<div class="card">
  <div class="head"><img src="${svgUri}"><b>${site.short}</b><span class="x">×</span></div>
  <div class="big"><span class="lbl">Cheapest store · US</span><span class="price">${usd(it.p.US)}</span></div>
  <div class="row"><span>TCGplayer market price</span><span>${usd(it.m)}</span></div>
  ${pct >= 3 ? `<div class="save">${pct}% under TCGplayer market</div>` : ""}
  <div class="row muted"><span>In stock at ${it.s} stores worldwide</span></div>
  ${sample.store ? `<a class="cta">Buy at ${sample.store} · ${usd(it.p.US)}</a>` : ""}
  <a class="cta2">Compare all ${it.s} stores →</a>
  ${sample.line?.sister ? `<a class="cta2">See it on ${sample.line.sister.name} →</a>` : ""}
  <a class="sis">Check eBay listings (Ad)</a>
  <div class="foot">Prices from our last daily update. Buy and eBay buttons are affiliate links: we may earn a commission, at no cost to you.</div>
</div>`;
const css = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.card{font:13px/1.35 system-ui,sans-serif;color:#0f172a;background:#fff;width:272px;border-radius:14px;box-shadow:0 10px 30px rgba(2,6,23,.35),0 0 0 1px rgba(2,6,23,.08);padding:12px 14px 10px}
.head{display:flex;align-items:center;gap:8px;margin-bottom:8px}.head img{width:20px;height:20px;border-radius:5px}.head b{flex:1}.x{font-size:20px;color:#64748b}
.big{display:flex;flex-direction:column;margin-bottom:6px}.lbl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
.price{font-size:24px;font-weight:700;color:${site.brand}}.row{display:flex;justify-content:space-between;padding:2px 0}.muted{color:#64748b}
.save{display:inline-block;margin:4px 0;padding:2px 8px;border-radius:99px;background:#dcfce7;color:#166534;font-weight:600;font-size:12px}
.cta{display:block;margin-top:10px;text-align:center;background:${site.brand};color:#fff;font-weight:600;padding:9px 10px;border-radius:10px}
.cta2{display:block;margin-top:6px;text-align:center;color:${site.brand};border:1.5px solid ${site.brand};font-weight:600;padding:7px 10px;border-radius:10px}
.sis{display:block;margin-top:6px;text-align:center;color:${site.brand};font-size:12px}.foot{margin-top:8px;font-size:10.5px;color:#94a3b8}
.bg{position:relative;overflow:hidden;background:radial-gradient(circle at 20% 10%,#1e2350,#07080d 70%);color:#fff}
.glow{position:absolute;inset:auto -20% -40% auto;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,${site.brand}55,transparent 60%)}
h1{font-size:54px;line-height:1.05;margin:0 0 18px;letter-spacing:-.02em}p.sub{font-size:22px;color:#c7d2fe;margin:0;line-height:1.4}
.brand{display:flex;align-items:center;gap:14px;font-size:26px;font-weight:800;margin-bottom:40px}.brand img{width:52px;height:52px;border-radius:12px}
.frame{background:#f8fafc;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.5);overflow:hidden;color:#0f172a}
.bar{display:flex;align-items:center;gap:8px;background:#e2e8f0;padding:10px 14px}.dot{width:12px;height:12px;border-radius:50%;background:#cbd5e1}
.url{flex:1;margin-left:10px;background:#fff;border-radius:8px;padding:6px 12px;font-size:14px;color:#475569}
.ghost{background:#e2e8f0;border-radius:8px}`;

async function shot(file, w, h, body) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><head><style>${css}</style></head><body>${body}</body></html>`);
  await page.screenshot({ path: path.join(storeDir, file) });
}

const productFrame = (panelHtml) => `
<div class="frame" style="width:700px;height:600px;position:relative">
  <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="url">tcgplayer.com/product/${sample.id}/…</span></div>
  <div style="display:flex;gap:24px;padding:28px">
    <div class="ghost" style="width:230px;height:300px"></div>
    <div style="flex:1">
      <div style="font-size:22px;font-weight:700;margin-bottom:14px">${it.n}</div>
      <div class="ghost" style="height:14px;width:70%;margin-bottom:10px"></div>
      <div class="ghost" style="height:14px;width:55%;margin-bottom:10px"></div>
      <div class="ghost" style="height:14px;width:62%;margin-bottom:30px"></div>
      <div class="ghost" style="height:44px;width:180px"></div>
    </div>
  </div>
  <div style="position:absolute;right:16px;bottom:16px">${panelHtml}</div>
</div>`;

await shot("screenshot-1-panel.png", 1280, 800, `
<div class="bg" style="width:1280px;height:800px;display:flex;align-items:center;gap:60px;padding:0 70px"><div class="glow"></div>
  <div style="width:430px;position:relative">
    <div class="brand"><img src="${svgUri}">${site.short}</div>
    <h1>The cheapest store price, right on the TCGplayer page</h1>
    <p class="sub">Open any booster box, ETB or bundle. See what independent stores charge, then compare them all in one click.</p>
  </div>
  <div style="position:relative">${productFrame(panel)}</div>
</div>`);

const popupRows = sample.popup
  .map((r) => `<li style="display:flex;justify-content:space-between;gap:10px;padding:9px 14px;border-top:1px solid #f1f5f9"><span style="flex:1">${r.n}<small style="display:block;color:#64748b">${r.sub}</small></span><b style="color:${site.brand}">${usd(r.c)}</b></li>`)
  .join("");
await shot("screenshot-2-search.png", 1280, 800, `
<div class="bg" style="width:1280px;height:800px;display:flex;align-items:center;gap:70px;padding:0 90px"><div class="glow"></div>
  <div style="width:470px;position:relative">
    <div class="brand"><img src="${svgUri}">${site.short}</div>
    <h1>Search every sealed product from your toolbar</h1>
    <p class="sub">${Object.keys(sample.lines).length} games, six markets, each store's own price in your currency. No account, nothing tracked.</p>
  </div>
  <div style="position:relative;width:380px;background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.5);font-size:14px;overflow:hidden">
    <div style="display:flex;align-items:center;gap:8px;padding:14px"><img src="${svgUri}" style="width:24px;height:24px;border-radius:6px"><b style="flex:1">${site.short}</b><span style="border:1px solid #cbd5e1;border-radius:8px;padding:5px 9px">US ▾</span></div>
    <div style="margin:0 14px;border:2px solid ${site.brand};border-radius:8px;padding:9px 10px">${sample.query}</div>
    <ul style="list-style:none;margin:10px 0 0;padding:0">${popupRows}</ul>
    <p style="color:#64748b;font-size:12px;margin:10px 14px 14px">Prices from our last daily update (${sample.asOf}).</p>
  </div>
</div>`);

const tile = (w, h, title, size) => `
<div class="bg" style="width:${w}px;height:${h}px;display:flex;flex-direction:column;justify-content:center;padding:0 ${Math.round(w * 0.07)}px"><div class="glow"></div>
  <div class="brand" style="margin-bottom:${Math.round(h * 0.06)}px;position:relative;font-size:${Math.round(size * 0.55)}px"><img src="${svgUri}" style="width:${size}px;height:${size}px">${site.short}</div>
  <div style="position:relative;font-size:${Math.round(size * 0.62)}px;font-weight:800;line-height:1.1;max-width:${Math.round(w * 0.86)}px">${title}</div>
</div>`;
await shot("tile-440x280.png", 440, 280, tile(440, 280, "Sealed TCG prices on every TCGplayer page", 46));
await shot("marquee-1400x560.png", 1400, 560, tile(1400, 560, "The cheapest store price for sealed TCG product, right on the TCGplayer page", 84));
await browser.close();
console.log(`${id}: icons and store images drawn`);
