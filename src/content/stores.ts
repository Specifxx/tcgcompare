// The stores this site compares. It visits none of them itself: every row comes from a Compare Empire sister site's
// published data (lib/import/sisters.ts), and the daily import writes the stores that have an offer on a product
// here to data/public/stores.json. Never edit that file by hand. Never add a store on the family ban list.
import type { StoreConfig } from "@/lib/site-types";
import list from "../../data/public/stores.json";

export const STORES: StoreConfig[] = (list as Pick<StoreConfig, "key" | "name" | "base" | "market">[]).map((s) => ({ ...s, collections: [], kind: "sealed" }));
