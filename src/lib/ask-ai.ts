// "Ask our prices", the in-words answer (owner, 2026-11-18, balance confirmed, freeze lifted within ceilings). ONE small-model call per NEW
// question, grounded on the site's own search hits, and guarded: the model can only pick rows we already found, and any figure in its
// sentence must be one that is printed on those rows. Pure (no SDK, no network) so the tests cover the guard and the caps.
// Costs (Claude Haiku 5.5, US$0.10 in / US$0.50 out per MTok under 100K tokens; its tokenizer counts about 30% more): about 1,300 tokens in
// and 200 out is about US$0.00026 a question. Caps: ASK_AI_DAILY_CAP per server instance (default 300 ≈ US$0.08 a day), identical questions
// cost nothing again (CDN, six hours), and the visitor's own cap lives in the browser.

export const ASK_AI_MODEL = "claude-haiku-5-5";
export const ASK_AI_MAX_TOKENS = 220;
export const ASK_AI_DEFAULT_DAILY_CAP = 300;
export const ASK_AI_VISITOR_DAILY_CAP = 8;

export interface AskHit {
  slug: string;
  href?: string;
  name: string;
  set: string;
  price: string;
}

export interface AskAnswer {
  /** One or two plain sentences, or null when the model's wording was not safe to show. */
  answer: string | null;
  /** Indexes into the hits that were sent, at most three, no repeats. */
  picks: number[];
}

/** The feature is on only with BOTH the key and the switch: with either missing the sheet stays the rules-only version. */
export function askAiEnabled(env: Record<string, string | undefined>): boolean {
  return !!env.ANTHROPIC_API_KEY && env.ASK_AI === "1";
}

export const ASK_AI_SYSTEM =
  "You answer a shopper's question about trading card game sealed product prices on one price-comparison site. You are given numbered " +
  "search results from the site, each with a name, set and headline price. Use ONLY those results: never add a price, a store, a release " +
  "date or a fact that is not in them. If none of them fits the question, say so and pick nothing. Reply with JSON only: " +
  '{"answer":"one or two short plain sentences","picks":[result numbers that best answer, at most 3, best first]}.';

export function buildAskPrompt(question: string, hits: AskHit[]): string {
  const rows = hits.slice(0, 8).map((h, i) => `${i + 1}. ${h.name} | ${h.set} | ${h.price}`);
  return `Question: ${question.slice(0, 120)}\n\nResults:\n${rows.join("\n")}`;
}

const NUM = /\d[\d,.]*/g;
const norm = (s: string) => s.replace(/[,.]+$/, "");

/** Parses and guards the model's reply: picks must be real result numbers; an answer that names a figure not printed on the sent rows is dropped. */
export function guardAnswer(text: string, hits: AskHit[]): AskAnswer {
  const sent = hits.slice(0, 8);
  let j: unknown;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    j = m ? JSON.parse(m[0]) : null;
  } catch {
    j = null;
  }
  const o = (j && typeof j === "object" ? j : {}) as { answer?: unknown; picks?: unknown };
  const picks: number[] = [];
  if (Array.isArray(o.picks))
    for (const p of o.picks) {
      const n = typeof p === "number" ? p : NaN;
      if (Number.isInteger(n) && n >= 1 && n <= sent.length && !picks.includes(n - 1)) picks.push(n - 1);
      if (picks.length === 3) break;
    }
  let answer = typeof o.answer === "string" ? o.answer.replace(/\s+/g, " ").trim().slice(0, 260) : "";
  if (answer) {
    const allowed = new Set(sent.flatMap((h) => `${h.price} ${h.name} ${h.set}`.match(NUM) ?? []).map(norm));
    const used = (answer.match(NUM) ?? []).map(norm);
    // A result number such as "1." or "2" is not a claim: only figures with 2+ digits, or a decimal/thousands mark, are checked.
    const claims = used.filter((x) => x.replace(/\D/g, "").length >= 2 || /[.,]/.test(x));
    if (claims.some((x) => !allowed.has(x))) answer = "";
    if (/https?:|www\./i.test(answer)) answer = "";
  }
  return { answer: answer || null, picks };
}

/** A per-instance daily counter (soft cap: each server instance counts alone, the real ceiling is the Anthropic workspace limit). */
export function makeDailyBudget(cap: number) {
  let day = "";
  let used = 0;
  return {
    take(now = new Date()): boolean {
      const d = now.toISOString().slice(0, 10);
      if (d !== day) ((day = d), (used = 0));
      if (used >= cap) return false;
      used++;
      return true;
    },
    get used() {
      return used;
    },
  };
}
