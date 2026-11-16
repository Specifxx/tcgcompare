import type { Post } from "./types";
import { boosterBoxCost } from "./booster-box-cost";
import { tcgplayerVsStores } from "./tcgplayer-vs-stores";
import { swuCarbonitePrice } from "./swu-carbonite-price";
import { fabBoosterBoxPrices } from "./fab-booster-box-prices";

// A post here answers one question the day's prices answer, written around real numbers (tokens, lib/game-study.ts).
export const POSTS: Post[] = [boosterBoxCost, tcgplayerVsStores, swuCarbonitePrice, fabBoosterBoxPrices];
