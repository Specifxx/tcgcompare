import { SITE } from "@/site.config";

// The one per-site file of the cart list (src/lib/cart-list.ts): the name stores see
// in utm_source and the cart attribute. Everything else in components/cart is shared.
// From SITE.domain, so a copied engine never credits the site it was copied from.
export const CART_SITE = SITE.domain;
