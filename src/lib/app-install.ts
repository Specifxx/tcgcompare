// "Add to home screen" for My collection (DECISIONS.md, 2026-11-26 "The collection app"). Pure decisions; the card is
// components/vault/VaultInstall.tsx. It is the visit's ONE prompt (lib/prompt-slot.ts) and shows only when all hold:
// the visitor has something in their collection, is not already in the installed app, can install on this browser
// (Chrome/Edge/Samsung offer it themselves; iPhone and iPad Safari need the Share sheet), and hasn't closed it in 30 days.
export const INSTALL_KEY = "ce_app_install_v1";
export const INSTALL_SILENCE_DAYS = 30;

export type InstallWay = "native" | "ios" | null;

export function installWay(ua: string, hasNativePrompt: boolean): InstallWay {
  if (hasNativePrompt) return "native";
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua));
  // Only Safari can add to the home screen on older iOS; other iOS browsers say so with CriOS/FxiOS/EdgiOS.
  if (ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)) return "ios";
  return null;
}

export function shouldOffer(o: { items: number; standalone: boolean; way: InstallWay; closedAt: number | null; now: number }): boolean {
  if (o.items < 1 || o.standalone || !o.way) return false;
  if (o.closedAt && o.now - o.closedAt < INSTALL_SILENCE_DAYS * 86_400_000) return false;
  return true;
}
