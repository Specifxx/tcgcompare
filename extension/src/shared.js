// Helpers shared by the service worker, the content script and the popup.
const MARKET_LABEL = { US: "US", UK: "UK", CA: "Canada", AU: "Australia", EU: "Europe", SG: "Singapore" };
const MARKETS = ["US", "UK", "CA", "AU", "EU", "SG"];

/** Every link to our site says it came from the extension, and from which part of it. Nothing else is added. */
function tagged(url, content) {
  const u = new URL(url);
  u.searchParams.set("utm_source", "chrome-extension");
  u.searchParams.set("utm_medium", "extension");
  u.searchParams.set("utm_campaign", CONFIG.id);
  u.searchParams.set("utm_content", content);
  return u.toString();
}

/** The visitor's market from their own time zone, until they pick one. */
function guessMarket() {
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();
  if (tz.startsWith("australia/")) return "AU";
  if (tz === "europe/london") return "UK";
  if (tz.startsWith("europe/")) return "EU";
  if (tz === "asia/singapore") return "SG";
  if (/^america\/(toronto|vancouver|edmonton|winnipeg|halifax|regina|st_johns|montreal|moncton|whitehorse|yellowknife|iqaluit)/.test(tz)) return "CA";
  return "US";
}

async function getSettings() {
  const s = await chrome.storage.sync.get(["market", "panel"]);
  return { market: MARKETS.includes(s.market) ? s.market : guessMarket(), panel: s.panel !== false };
}

function money(cents, currency) {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "symbol" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
