// Posts this run's restocks to a Discord channel through an incoming webhook (the DISCORD_RESTOCKS_WEBHOOK secret). A no-op
// until the secret exists; never fatal; at most 10 lines a run, dearest first; display only (no price claim, no ranking).
import { productById } from "../src/lib/data";
import { SITE } from "../src/site.config";
import { readRestocks } from "../src/lib/restocks";
import { SITE_URL } from "../src/lib/site";
import { CURRENCY } from "../src/lib/site-types";
import { money } from "../src/lib/format";
import { shortName } from "../src/lib/names";

async function main() {
  const hook = process.env.DISCORD_RESTOCKS_WEBHOOK;
  if (!hook) {
    console.log("restocks-discord: DISCORD_RESTOCKS_WEBHOOK not set, nothing posted");
    return;
  }
  const file = readRestocks();
  const stores = new Map(SITE.stores.map((s) => [s.key, s]));
  const lines = (file?.events ?? [])
    .filter((e) => e.t === file!.updatedAt)
    .map((e) => ({ e, p: productById(e.p), s: stores.get(e.s) }))
    .filter((r) => r.p && r.s)
    .sort((a, b) => b.e.c - a.e.c)
    .slice(0, 10)
    .map(({ e, p, s }) => `**${shortName(p!.name)}** back in stock at ${s!.name}, ${money(e.c, CURRENCY[s!.market])}: <${SITE_URL}/card/${p!.slug}>`);
  if (!lines.length) {
    console.log("restocks-discord: nothing new this run");
    return;
  }
  const r = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: `Back in stock (${SITE.name}):\n${lines.join("\n")}`.slice(0, 1900), allowed_mentions: { parse: [] } }) });
  console.log(`restocks-discord: ${lines.length} lines, HTTP ${r.status}`);
}
main().catch((e) => { console.log(`restocks-discord: ${(e as Error).message}`); });
