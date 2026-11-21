import { buildExtensionFeed } from "@/lib/extension-feed";

// The Chrome buying assistant's price file (lib/extension-feed.ts). Built with the deploy and served as a file: no
// function runs for it, and only a release changes it. Open to every origin so the extension can read it.
export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(buildExtensionFeed()), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, s-maxage=86400", "Access-Control-Allow-Origin": "*" },
  });
}
