// IndexNow (Bing, Yandex…) key file. scripts/indexnow-submit.ts pings with
// keyLocation=<site>/indexnow-key.txt, so the key never has to be a filename.
import { indexNowKey } from "@/lib/indexnow-key";
export const dynamic = "force-dynamic";
export function GET() {
  return new Response(indexNowKey(), { headers: { "Content-Type": "text/plain", "Cache-Control": "public, s-maxage=86400" } });
}
