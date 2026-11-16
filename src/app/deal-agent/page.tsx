import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DealAgent } from "@/components/DealAgent";
import { dealAgentOn } from "@/lib/deal-signals";

// DEAL AGENT PROTOTYPE (flag NEXT_PUBLIC_DEAL_AGENT=1; otherwise a 404, never linked, never in the sitemap).
// A wishlist kept in this browser only, judged against /deal-signals.json (lib/deal-agent.ts). The same static shell for everyone.
export const dynamic = "force-static";
export const metadata: Metadata = { title: "Deal agent (prototype)", robots: { index: false, follow: false }, alternates: { canonical: "/deal-agent" } };

export default function Page() {
  if (!dealAgentOn()) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl py-6 sm:py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Deal agent</h1>
      <p className="mt-2 text-sm opacity-75">Add what you want. We tell you when its price is genuinely low, and say why. Saved in this browser only. Prototype.</p>
      <DealAgent />
    </div>
  );
}
