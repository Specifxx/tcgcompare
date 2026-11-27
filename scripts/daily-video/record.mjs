// Records short phone-sized screen clips of live pages for the daily company video.
// Runs in GitHub Actions (the cloud container cannot reach our sites) and locally.
//
//   node record.mjs demos.json outdir
//
// demos.json: [{ "id": "cw-banner", "steps": [ {"goto": "https://..."}, {"wait": 1200},
//   {"scroll": 900, "ms": 2500}, {"click": "text=Booster Box"}, {"type": ["input[type=search]", "surging"]},
//   {"press": "Enter"}, {"hover": "css"}, {"scrollTo": "text=Cyber Weekend", "ms": 1500},
//   {"upload": ["input[type=file]", "collection.csv", "csv text"]} ] }]
// Every clip is 432x768 CSS px (9:16), captured sharp at 1080x1920 through Chrome's screencast
// (--force-device-scale-factor: Playwright's own recordVideo keeps CSS pixels) and written as
// outdir/<id>.mp4 (H.264, 30 fps) when ffmpeg is on the PATH, else as JPEG frames + ffconcat. A step that fails is logged and
// skipped; a clip whose first goto fails is dropped (listed in outdir/report.json).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , demosFile, outDir = "clips"] = process.argv;
const demos = JSON.parse(fs.readFileSync(demosFile, "utf8"));
fs.mkdirSync(outDir, { recursive: true });
const report = [];

const browser = await chromium.launch({ args: ["--force-device-scale-factor=2.5"] });
for (const demo of demos) {
  const tmp = fs.mkdtempSync(path.join(outDir, ".rec-"));
  const ctx = await browser.newContext({
    viewport: { width: 432, height: 768 },
    deviceScaleFactor: 2.5,
    isMobile: true,
    hasTouch: true,
    locale: "en-US",
    timezoneId: "America/New_York",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 CompareEmpireDailyVideo",
  });
  // Keep the recording out of analytics and A/B counts.
  await ctx.route(/(va\.vercel-scripts\.com|\/_vercel\/insights|\/_vercel\/speed-insights|google-analytics\.com|googletagmanager\.com)/, (r) => r.abort());
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    const file = path.join(tmp, `f${String(frames.length).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, t: f.metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: 1080, maxHeight: 1920 });
  const log = [];
  let ok = true;
  const t0 = Date.now();
  for (const [i, s] of demo.steps.entries()) {
    try {
      if (s.goto) {
        const res = await page.goto(s.goto, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        if (res && res.status() >= 400) throw new Error(`HTTP ${res && res.status()}`);
        // Dismiss cookie / promo overlays that would hide the demo.
        for (const label of ["Accept", "Got it", "No thanks", "Close", "Dismiss"]) {
          const b = page.getByRole("button", { name: label, exact: true });
          if (await b.count().catch(() => 0)) await b.first().click({ timeout: 800 }).catch(() => {});
        }
      } else if (s.wait) await page.waitForTimeout(s.wait);
      else if (s.scroll) await smoothScroll(page, s.scroll, s.ms ?? 2000);
      else if (s.scrollTo) {
        const loc = page.locator(s.scrollTo).locator("visible=true").first();
        const box = await loc.boundingBox({ timeout: 5000 });
        if (!box) throw new Error("not found");
        await smoothScroll(page, box.y - 160, s.ms ?? 1500);
      } else if (s.click) await page.locator(s.click).first().click({ timeout: 6000 });
      else if (s.hover) await page.locator(s.hover).first().hover({ timeout: 6000 });
      else if (s.type) await page.locator(s.type[0]).first().pressSequentially(s.type[1], { delay: 90, timeout: 6000 });
      else if (s.press) await page.keyboard.press(s.press);
      else if (s.upload) {
        // A file chosen in a file input (hidden ones too), e.g. a collection export for the import demo.
        const [sel, name, text] = s.upload;
        await page.locator(sel).first().setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(String(text)) }, { timeout: 6000 });
      }
      else if (s.expect) {
        // A text the page must show, so a caption never claims something the page does not have.
        await page.getByText(s.expect, { exact: false }).locator("visible=true").first().waitFor({ timeout: 6000 });
      }
      log.push({ i, ok: true });
    } catch (e) {
      log.push({ i, ok: false, err: String(e.message || e).slice(0, 200) });
      if (i === 0 || s.expect) { ok = false; break; }
    }
  }
  await page.waitForTimeout(600);
  await cdp.send("Page.stopScreencast").catch(() => {});
  await ctx.close();
  let file = null;
  // The first frames show the blank page before the first goto: start at the first frame
  // after navigation (the screencast only sends a frame when something repainted).
  const keep = frames.slice(1);
  if (ok && keep.length > 1) {
    const lines = ["ffconcat version 1.0"];
    for (let k = 0; k < keep.length; k++) {
      const d = k + 1 < keep.length ? keep[k + 1].t - keep[k].t : 0.5;
      lines.push(`file '${path.resolve(keep[k].file)}'`, `duration ${Math.max(0.001, d).toFixed(3)}`);
    }
    lines.push(`file '${path.resolve(keep[keep.length - 1].file)}'`);
    const list = path.join(tmp, "list.ffconcat");
    fs.writeFileSync(list, lines.join("\n"));
    const mp4 = path.join(outDir, `${demo.id}.mp4`);
    try {
      execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list,
        "-vf", "fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:0:white,format=yuv420p",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", mp4]);
      file = `${demo.id}.mp4`;
    } catch (e) {
      log.push({ ffmpeg: String(e.message || e).slice(0, 200) });
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  report.push({ id: demo.id, ok: ok && !!file, frames: keep.length, seconds: (Date.now() - t0) / 1000, steps: log, file });
  console.log(demo.id, ok && file ? "OK" : "DROPPED", keep.length, "frames", JSON.stringify(log));
}
await browser.close();
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ at: new Date().toISOString(), clips: report }, null, 2));

async function smoothScroll(page, dy, ms) {
  const steps = Math.max(10, Math.round(ms / 33));
  for (let k = 0; k < steps; k++) {
    await page.evaluate((d) => window.scrollBy(0, d), dy / steps);
    await page.waitForTimeout(ms / steps);
  }
}
