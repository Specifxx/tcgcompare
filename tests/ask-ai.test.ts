// "Ask our prices", the in-words answer (lib/ask-ai.ts): the guard and the caps. No network, no key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { askAiEnabled, buildAskPrompt, guardAnswer, makeDailyBudget } from "../src/lib/ask-ai";

const hits = [
  { slug: "a", name: "Surging Sparks Booster Box", set: "Surging Sparks", price: "$129.99" },
  { slug: "b", name: "Surging Sparks Elite Trainer Box", set: "Surging Sparks", price: "$54.50" },
];

test("off unless the key AND the switch are set", () => {
  assert.equal(askAiEnabled({}), false);
  assert.equal(askAiEnabled({ ANTHROPIC_API_KEY: "k" }), false);
  assert.equal(askAiEnabled({ ASK_AI: "1" }), false);
  assert.equal(askAiEnabled({ ANTHROPIC_API_KEY: "k", ASK_AI: "1" }), true);
});

test("the prompt carries the numbered rows and a cut question", () => {
  const p = buildAskPrompt("x".repeat(500), hits);
  assert.match(p, /1\. Surging Sparks Booster Box \| Surging Sparks \| \$129\.99/);
  assert.ok(p.length < 400);
});

test("picks must be real result numbers, unique, at most three", () => {
  const r = guardAnswer('{"answer":"The booster box is $129.99.","picks":[1,1,2,9,0,"x"]}', hits);
  assert.deepEqual(r.picks, [0, 1]);
  assert.equal(r.answer, "The booster box is $129.99.");
});

test("an answer naming a figure that is not on the rows is dropped, the picks stay", () => {
  const r = guardAnswer('{"answer":"It costs $99.99 at one store.","picks":[1]}', hits);
  assert.equal(r.answer, null);
  assert.deepEqual(r.picks, [0]);
});

test("links and non-JSON never reach the page", () => {
  assert.equal(guardAnswer('{"answer":"See https://evil.example","picks":[1]}', hits).answer, null);
  assert.deepEqual(guardAnswer("I think the first one.", hits), { answer: null, picks: [] });
});

test("the daily cap stops at the cap and resets the next day", () => {
  const b = makeDailyBudget(2);
  const d = new Date("2026-11-18T01:00:00Z");
  assert.equal(b.take(d), true);
  assert.equal(b.take(d), true);
  assert.equal(b.take(d), false);
  assert.equal(b.take(new Date("2026-11-19T01:00:00Z")), true);
});
