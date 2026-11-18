import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { GET as search } from "@/app/api/search/route";
import { parseAsk, askSearchUrl, askPick } from "@/lib/ask";
import { ASK_AI_DEFAULT_DAILY_CAP, ASK_AI_MAX_TOKENS, ASK_AI_MODEL, ASK_AI_SYSTEM, askAiEnabled, buildAskPrompt, guardAnswer, makeDailyBudget, type AskHit } from "@/lib/ask-ai";

// The in-words answer of "Ask our prices" (lib/ask-ai.ts). Off unless ANTHROPIC_API_KEY and ASK_AI=1 are both set (a Vercel Production
// variable pair the owner adds); off it answers {ai:false} and the sheet stays rules-only. One Haiku call per NEW question: the CDN keeps
// an identical question for six hours, so a repeat costs nothing. Nothing about the visitor is read or stored: only the question words.
export const dynamic = "force-dynamic";

const OK = { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" };
const SHORT = { "Cache-Control": "public, s-maxage=300" };
const NONE = { "Cache-Control": "no-store" };
const budget = makeDailyBudget(Number(process.env.ASK_AI_DAILY_CAP) || ASK_AI_DEFAULT_DAILY_CAP);

export async function GET(req: Request) {
  if (!askAiEnabled(process.env)) return NextResponse.json({ ai: false }, { headers: SHORT });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 120);
  const ask = parseAsk(q);
  const url = askSearchUrl(ask);
  if (!url || ask.link) return NextResponse.json({ ai: true, answer: null, picks: [], hits: [] }, { headers: OK });
  const found = (await (await search(new Request(new URL(url, req.url)))).json()) as { hits: (AskHit & { image?: string | null })[] };
  const hits = askPick(ask, found.hits, 8);
  if (!hits.length) return NextResponse.json({ ai: true, answer: null, picks: [], hits: [] }, { headers: OK });
  if (!budget.take()) return NextResponse.json({ ai: false, reason: "cap" }, { headers: SHORT });
  try {
    const client = new Anthropic({ timeout: 8000, maxRetries: 0 });
    const msg = await client.messages.create({
      model: ASK_AI_MODEL,
      max_tokens: ASK_AI_MAX_TOKENS,
      thinking: { type: "disabled" },
      system: ASK_AI_SYSTEM,
      messages: [{ role: "user", content: buildAskPrompt(q, hits) }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const r = guardAnswer(text, hits);
    return NextResponse.json({ ai: true, ...r, hits: hits.map((h) => ({ slug: h.slug, href: h.href, name: h.name, set: h.set, image: h.image ?? null, price: h.price })) }, { headers: OK });
  } catch {
    return NextResponse.json({ ai: false, reason: "error" }, { headers: NONE });
  }
}
