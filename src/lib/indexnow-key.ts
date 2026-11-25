// IndexNow's key is public by design: the protocol proves ownership by serving it at keyLocation, and it grants
// nothing else (no account, no read access). It was a GitHub secret + Vercel variable that was never set, so every
// refresh logged "INDEXNOW_KEY not set — skipped" and Bing reported tcgprices.app as not using IndexNow (25 Nov).
// INDEXNOW_KEY, when set, still wins (route and script read the same value).
export const INDEXNOW_PUBLIC_KEY = "056890b1b7038dfce029aa3f408d966d";
export function indexNowKey(): string {
  return process.env.INDEXNOW_KEY || INDEXNOW_PUBLIC_KEY;
}
