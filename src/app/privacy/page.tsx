import type { Metadata } from "next";
import { SITE } from "@/site.config";
import { canon } from "@/lib/site";
import { StaticPage } from "@/components/StaticPage";

export const revalidate = 86400;
export const metadata: Metadata = { title: "Privacy policy", ...canon("/privacy") };

export default function Privacy() {
  return (
    <StaticPage title="Privacy policy">
      <p>Last updated 26 November 2026.</p>
      <p>{SITE.name} itself stores nothing about you. We use Vercel Web Analytics, which counts page views and clicks on buy buttons without cookies and without identifying you. Your choice of market and theme is kept in your own browser.</p>
      {SITE.priceAlerts && (
        <p>
          Price alerts are the one exception. If you ask to be emailed when a price drops, the form sends your email address, the product, your market and your price to our shared alert service, which keeps them only for that alert, emails you once to confirm, and deletes them when you stop the alert or after six months. {SITE.name} itself never stores them.
        </p>
      )}
      <p>
        Accounts are optional and kept by our shared account service. If you sign in, it keeps your email address and, so your collection follows you to
        your other devices, the products and quantities in your collection. If you switch on the weekly collection email, it sends that email to your
        account&apos;s address once a week until you switch it off or use the stop link in any of them; switching it off never deletes your collection.
      </p>
      <p>
        Our Chrome extension collects nothing either: it downloads one public price file from this site without cookies, keeps it and your market choice in your
        browser, runs only on TCGplayer product pages, and sends nothing about you or the pages you visit anywhere. Details on <a href="/extension">the extension page</a>.
      </p>
      <p>Buy links are affiliate links: eBay, TCGplayer and Amazon may set their own cookies when you follow one, under their own privacy policies.</p>
      <p>Questions: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.</p>
    </StaticPage>
  );
}
