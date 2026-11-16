import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { SEASON_BOOT_SCRIPT, seasonAt } from "@/lib/season";

test("Halloween runs through 31 October and Christmas takes over on 1 November", () => {
  assert.equal(seasonAt(new Date(2026, 9, 24)), "halloween");
  assert.equal(seasonAt(new Date(2026, 9, 31, 23, 59)), "halloween");
  assert.equal(seasonAt(new Date(2026, 10, 1, 0, 0)), "christmas");
  assert.equal(seasonAt(new Date(2026, 9, 15)), null);
});

test("boot script agrees with seasonAt", () => {
  for (const d of [new Date(2026, 9, 20), new Date(2026, 10, 1)]) {
    const attrs: Record<string, string> = {};
    const RealDate = Date;
    const ctx = {
      location: { search: "" },
      document: { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } },
      Date: class extends RealDate { constructor() { super(d.getTime()); } },
    };
    vm.runInNewContext(SEASON_BOOT_SCRIPT, ctx);
    assert.equal(attrs["data-season"] ?? null, seasonAt(d));
  }
});

test("Black Friday week is an event layer on top of the season (data-event), 20 to 30 November in 2026", async () => {
  const { eventAt, blackFridayWindow } = await import("@/lib/season");
  assert.deepEqual(blackFridayWindow(2026), [20261120, 20261130]);
  assert.equal(eventAt(new Date(2026, 10, 19)), null);
  assert.equal(eventAt(new Date(2026, 10, 20)), "blackfriday");
  assert.equal(eventAt(new Date(2026, 10, 30)), "blackfriday");
  assert.equal(eventAt(new Date(2026, 11, 1)), null);
  assert.equal(seasonAt(new Date(2026, 10, 27)), "christmas", "the season is untouched");
  for (const [d, want] of [[new Date(2026, 10, 27), "blackfriday"], [new Date(2026, 10, 10), undefined]] as const) {
    const attrs: Record<string, string> = {};
    const RealDate = Date;
    const ctx = {
      location: { search: "" },
      document: { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } },
      Date: class extends RealDate { constructor() { super(d.getTime()); } },
    };
    vm.runInNewContext(SEASON_BOOT_SCRIPT, ctx);
    assert.equal(attrs["data-event"], want);
  }
});
