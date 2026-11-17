import { test } from "node:test";
import assert from "node:assert/strict";
import { productLastmod } from "../src/lib/sitemap-lastmod";

const cap = new Date("2026-11-17T09:00:00Z");

test("lastmod is the day of the newest history point", () => {
  const day = Date.UTC(2026, 10, 15) / 86_400_000;
  assert.equal(productLastmod([[day - 3, 100], [day, 120]], cap)?.toISOString().slice(0, 10), "2026-11-15");
});

test("no history means no lastmod, and a future day is capped at the import time", () => {
  assert.equal(productLastmod([], cap), undefined);
  const future = Date.UTC(2026, 10, 20) / 86_400_000;
  assert.equal(productLastmod([[future, 1]], cap)?.getTime(), cap.getTime());
});
