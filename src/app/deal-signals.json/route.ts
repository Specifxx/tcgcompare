import { notFound } from "next/navigation";
import { buildSignals, dealAgentOn } from "@/lib/deal-signals";

// The deal agent's verdicts (lib/deal-signals.ts). A prototype: 404 unless NEXT_PUBLIC_DEAL_AGENT=1 at build.
// Built with the deploy and served as a file; no function runs for it.
export const dynamic = "force-static";

export function GET() {
  if (!dealAgentOn()) notFound();
  return new Response(JSON.stringify(buildSignals()), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, s-maxage=86400" } });
}
