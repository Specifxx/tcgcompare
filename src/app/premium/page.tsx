import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PremiumPanel } from "@/components/premium/PremiumPanel";
import { SITE } from "@/site.config";
import { SITE_URL } from "@/lib/site";

const SITE_NAME = SITE.name;
const CONTACT_EMAIL = SITE.supportEmail;
import { PREMIUM_PRICE_LINE } from "@/lib/premium-member";

// TCG Prices Premium (owner, 2026-11-10): a RiftCompare Premium account works here. Static; the browser asks RiftCompare.
const DESCRIPTION = `Premium for ${SITE_NAME}: no banner ads, up to 200 price alerts and a watch list on every device. ${PREMIUM_PRICE_LINE}. Comparing prices stays free.`;
export const metadata: Metadata = {
  title: `${SITE_NAME} Premium: no ads, 200 price alerts`,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/premium` },
};

export default function PremiumPage() {
  return (
    <div className="page max-w-3xl py-12">
      <Breadcrumbs items={[{ name: "Premium" }]} />
      <div className="prose-site mt-6">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-strong">New · 14 days free</p>
        <h1 className="font-display text-3xl font-black mt-1">
          {SITE_NAME} <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Premium</span>
        </h1>
        <p className="mt-3 text-lg">
          Comparing sealed prices stays free, and so do price alerts and the weekly biggest-drops email. Premium is for people who watch a lot of products and want a calmer site.
        </p>
      </div>
      <div className="mt-6">
        <PremiumPanel />
      </div>
      <div className="prose-site mt-8">
        <h2>What you get</h2>
        <ul>
          <li><strong>No banner ads.</strong> The sponsored banners and the phone dock disappear while you are signed in. Price tables, the stores in them and their order do not change.</li>
          <li><strong>Up to 200 price alerts</strong> instead of 25.</li>
          <li><strong>A watch list</strong> at <a href="/watches">My watches</a>: every alert you have set, with the lowest in-stock price now, and a button to stop each.</li>
        </ul>
        <h2>How it works</h2>
        <ul>
          <li>Sign in with an emailed link, no password.</li>
          <li>14 days free through Stripe; first charge on day 15.</li>
          <li>Cancel any time from <strong>Manage billing</strong>.</li>
          <li>One account for all our price comparison sites. If it lapses, your free alerts keep working.</li>
        </ul>
        <h2>What it does not do</h2>
        <ul>
          <li>Change which stores show, or their order.</li>
          <li>Hide any price.</li>
          <li>Promise stock: a fast seller can be gone by the time you click.</li>
        </ul>
        <p className="text-sm text-muted">Prices are the lowest in-stock store price, before postage.</p>
        <p className="text-sm text-muted">Questions? <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>. Billing: Manage billing on this page once you are signed in.</p>
      </div>
    </div>
  );
}
