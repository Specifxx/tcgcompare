import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Vercel Web Analytics silently drops a custom event with more than 16 properties (measured on riftcompare.com, 2026-11-20).
// buy_click here has exactly 16: a new key must replace one, or fold into an existing key.
test("buy_click and buy_click_geo carry at most 16 properties", () => {
  const tracker = readFileSync("src/components/BuyClickTracker.tsx", "utf8");
  const call = tracker.slice(tracker.indexOf('track("buy_click", {'), tracker.indexOf("});", tracker.indexOf('track("buy_click", {')));
  const keys = [...call.matchAll(/(?:\{|,|\n)\s*([a-z_]+)(?=:|,\s*\n)/g)].map((m) => m[1]);
  assert.ok(keys.length > 0 && keys.length <= 16, `buy_click has ${keys.length} properties: ${keys.join(", ")}`);
  const route = readFileSync("src/app/go/route.ts", "utf8");
  const evt = route.slice(route.indexOf("const evt = {"), route.indexOf("};", route.indexOf("const evt = {")));
  const geo = [...evt.matchAll(/\n\s*([a-z_]+)[:,]/g)].map((m) => m[1]);
  assert.ok(geo.length > 0 && geo.length <= 16, `buy_click_geo has ${geo.length} properties`);
});
