import test from "node:test";
import assert from "node:assert/strict";
import { POSTS } from "@/content/blog";
import { renderPost } from "@/lib/post-render";
import { beatRows, boxRows } from "@/lib/game-study";

// The guides' numbers are tokens over the committed data: no token may reach a reader unresolved, every table must
// have rows, and every internal link must land on a page this site serves.
test("guide tokens all resolve", () => {
  for (const p of POSTS) {
    const html = [renderPost(p.html), ...(p.faq ?? []).map((f) => renderPost(f.a))].join("\n");
    assert.ok(!html.includes("{{"), `${p.slug} leaves a token`);
    assert.ok(!/<td><\/td>|undefined|NaN|\$NaN/.test(html), `${p.slug} renders an empty or broken cell`);
  }
});

test("the per-game studies have rows", () => {
  assert.ok(boxRows().length >= 10);
  assert.ok(beatRows().length >= 5);
  for (const r of boxRows()) assert.ok(r.count >= 5 && r.median > 0);
  for (const r of beatRows()) assert.ok(r.compared >= 30 && r.storeCheaper <= r.compared);
});

test("each guide links to another guide and a tool", () => {
  for (const p of POSTS) {
    assert.ok(/href="\/blog\/[a-z0-9-]+"/.test(p.html), `${p.slug} has no inbound link to another guide`);
    assert.ok(/href="\/tools\/[a-z-]+"/.test(p.html), `${p.slug} links no tool`);
    assert.ok(p.description.length <= 160, `${p.slug} description too long`);
    assert.ok(p.title.length <= 70, `${p.slug} title too long`);
  }
});

test("every guide thumbnail file exists", async () => {
  const fs = await import("node:fs");
  for (const p of POSTS) if (p.image) assert.ok(fs.existsSync(`public${p.image.src}`), `${p.slug} image missing`);
});
