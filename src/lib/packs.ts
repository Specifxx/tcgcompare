// A booster box's single pack (owner, 2026-11-15: Reddit users on the Star Wars Unlimited post asked for single pack
// prices beside the box prices). The pair is told by name only inside one set: "Homeworlds - Booster Display" and
// "Homeworlds - Booster Pack" share the stem "Homeworlds", while "Homeworlds Carbonite Edition - Booster Pack" has another
// (an edition is never mixed). A promo pack ("Promo Pack: Black") ends differently and pairs with nothing. No pack count
// is claimed: this only shows what one pack costs.
//
// A trailing printing tag ("Booster Box [1st Edition]", "Booster Pack [1st Edition]", "[Second Edition]", "[2nd Print]",
// as TCGplayer names every Yu-Gi-Oh! set) is part of the stem, so a 1st Edition box pairs with its 1st Edition pack and
// never with an Unlimited one. Any other bracket ("Sleeved Booster Pack [Cell]") is not a printing and pairs with nothing.
import type { Product } from "@/lib/site-types";

const BOX = /\s*[-–:]?\s*booster (?:display|box)\s*$/i;
const PACK = /\s*[-–:]?\s*booster pack\s*$/i;
const PRINTING = /\s*\[([^\]]*\b(?:edition|print|printing))\]\s*$/i;

function stem(name: string, kind: RegExp): string | null {
  const tag = PRINTING.exec(name);
  const base = tag ? name.slice(0, tag.index) : name;
  if (!kind.test(base)) return null;
  const s = base.replace(kind, "").trim().toLowerCase();
  if (!s) return null;
  return tag ? `${s} [${tag[1].trim().toLowerCase()}]` : s;
}

/** The name without its trailing "Booster Display / Box / Pack" (printing tag kept), lower-cased, or null for any other product. */
export function boxStem(p: Pick<Product, "name" | "sealedType">): string | null {
  return p.sealedType === "Booster Box" ? stem(p.name, BOX) : null;
}
export function packStem(p: Pick<Product, "name" | "sealedType">): string | null {
  return p.sealedType === "Booster Pack" ? stem(p.name, PACK) : null;
}

/** The one single pack of a booster box among `inSet` (the same set's products), or null when none or two fit. */
export function packOfBox<T extends Pick<Product, "name" | "sealedType" | "setId">>(box: T, inSet: readonly T[]): T | null {
  const stem = boxStem(box);
  if (!stem) return null;
  const packs = inSet.filter((p) => p.setId === box.setId && packStem(p) === stem);
  return packs.length === 1 ? packs[0] : null;
}
