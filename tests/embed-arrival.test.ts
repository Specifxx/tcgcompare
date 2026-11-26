// The embed visit counter: one Vercel event for a visit a widget's link brought, nothing stored about anyone.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("every widget link is tagged utm_source=embed and the layout counts the arrival", () => {
  for (const f of ["src/app/embed/card/[slug]/route.ts", "src/app/embed/daily/route.ts", "src/lib/open-embed.ts"]) assert.match(fs.readFileSync(f, "utf8"), /utm_source=embed/, f);
  assert.match(fs.readFileSync("src/app/layout.tsx", "utf8"), /<EmbedArrival \/>/);
});

test("the counter sends one event per tab with only the widget and the kind of page", () => {
  const src = fs.readFileSync("src/components/EmbedArrival.tsx", "utf8");
  assert.match(src, /track\("embed_visit", \{ medium: [^}]*page: pageType\(location\.pathname\) \}\)/);
  assert.match(src, /sessionStorage\.getItem\("embed_visit"\)/);
  assert.doesNotMatch(src, /document\.referrer|localStorage|fetch\(/, "no referrer, no stored id, no request of its own");
});
