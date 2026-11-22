import type { Metadata } from "next";
import { SITE } from "@/site.config";
import { canon } from "@/lib/site";
import { StaticPage } from "@/components/StaticPage";
import { CHROME_EXTENSION_URL, EXTENSION_NAME } from "@/lib/extension";

export const revalidate = 86400;
export const metadata: Metadata = {
  title: "Chrome extension: sealed price checker",
  description: `${EXTENSION_NAME}: see the cheapest store price for a booster box, ETB or bundle right on its TCGplayer page. Free, no account, nothing tracked.`,
  ...canon("/extension"),
};

export default function ExtensionPage() {
  const install = CHROME_EXTENSION_URL ? `${CHROME_EXTENSION_URL}?utm_source=tcgprices&utm_medium=site&utm_campaign=extension` : "";
  return (
    <StaticPage title="The TCG Prices Chrome extension">
      <p>
        Open a sealed product on TCGplayer and a small panel shows the cheapest in-stock price we track at independent stores in your market, beside TCGplayer&apos;s
        market price, with a button to buy at that store, one to compare every store on {SITE.name}, and one to the game&apos;s own price site (DexCompare, Rift Compare, MTG Compare and the rest). It covers booster boxes, Elite Trainer Boxes, bundles, cases and decks for every game we list.
      </p>
      {install ? (
        <p>
          <a className="btn-primary" href={install} rel="noopener">
            Add to Chrome, free
          </a>
        </p>
      ) : (
        <p>
          <strong>In review at the Chrome Web Store.</strong> The install button appears here as soon as Google approves it.
        </p>
      )}
      <h2>What it does</h2>
      <ul>
        <li>On a TCGplayer product page it reads the product number in the page&apos;s address and, only when that exact product is in our price list, shows the panel. It never guesses from a title, and it shows nothing on products we don&apos;t track.</li>
        <li>The toolbar button searches every sealed product we track, with your market&apos;s cheapest store price. &quot;Find the product on this page&quot; fills the search box with the page&apos;s title when you press it, so you can pick the right product yourself.</li>
        <li>Select any text, right-click, and choose &quot;Search TCG Prices&quot; to look it up on this site.</li>
        <li>Close the panel on a product and it stays closed for that product. You can turn the panel off in the toolbar popup.</li>
      </ul>
      <h2>Privacy</h2>
      <p>
        The extension has no account and collects nothing about you. It downloads one public price file from {SITE.domain} about twice a day, without cookies, and keeps
        it in your browser. It sends no browsing history, page content or personal data anywhere. Your market and panel setting are kept in Chrome&apos;s own settings
        storage. It runs only on TCGplayer product pages; the page title is read only when you press &quot;Find the product on this page&quot;.
      </p>
      <h2>How it earns</h2>
      <p>
        The extension changes no links on TCGplayer or any other site and adds no code to them. Its own &quot;Buy at&quot; and &quot;Check eBay&quot; buttons go
        through our site, which adds the store&apos;s or eBay&apos;s affiliate tag where one exists: we may earn a commission when you buy, at no cost to you. The
        buttons are labelled, and commission never changes which price is shown as cheapest.
      </p>
      <h2>Permissions</h2>
      <ul>
        <li><strong>Read your data on tcgplayer.com product pages:</strong> to read the product number from the address and draw the panel.</li>
        <li><strong>{SITE.domain}:</strong> to download the public price file.</li>
        <li><strong>Storage:</strong> to keep that file and your settings in your browser.</li>
        <li><strong>Context menu, active tab:</strong> for the right-click search, and to read the current tab&apos;s title only when you ask.</li>
      </ul>
      <p>
        Prices are each store&apos;s own, in its own currency, from our last daily update; check the store before you buy. Questions or a wrong price:{" "}
        <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
      </p>
    </StaticPage>
  );
}
