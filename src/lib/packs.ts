// A booster box's single pack (owner, 2026-11-15: Reddit users on the Star Wars Unlimited post asked for single pack
// prices beside the box prices). The pair is told by name only inside one set: "Homeworlds - Booster Display" and
// "Homeworlds - Booster Pack" share the stem "Homeworlds", while "Homeworlds Carbonite Edition - Booster Pack" has another
// (an edition is never mixed). A promo pack ("Promo Pack: Black") ends differently and pairs with nothing. No pack count
// is claimed: this only shows what one pack costs.
import type { Product } from "@/lib/site-types";

const BOX = /\s*[-–:]?\s*booster (?:display|box)\s*$/i;
const PACK = /\s*[-–:]?\s*booster pack\s*$/i;

/** The name without its trailing "Booster Display / Box / Pack", lower-cased, or null for any other product. */
export function boxStem(p: Pick<Product, "name" | "sealedType">): string | null {
  if (p.sealedType !== "Booster Box" || !BOX.test(p.name)) return null;
  return p.name.replace(BOX, "").trim().toLowerCase();
}
export function packStem(p: Pick<Product, "name" | "sealedType">): string | null {
  if (p.sealedType !== "Booster Pack" || !PACK.test(p.name)) return null;
  return p.name.replace(PACK, "").trim().toLowerCase();
}

/** The one single pack of a booster box among `inSet` (the same set's products), or null when none or two fit. */
export function packOfBox<T extends Pick<Product, "name" | "sealedType" | "setId">>(box: T, inSet: readonly T[]): T | null {
  const stem = boxStem(box);
  if (!stem) return null;
  const packs = inSet.filter((p) => p.setId === box.setId && packStem(p) === stem);
  return packs.length === 1 ? packs[0] : null;
}
