// The sitemap's lastmod for a product page: the day its TCGplayer reference price last moved (data/history), never later
// than the import's own time. Stamping every URL with the import time told Google nothing, so it learns to ignore the
// field; a product with no history gets no lastmod at all rather than an invented one. PURE.
import { dayToDate } from "./series";
import type { Series } from "./series";

export function productLastmod(series: Series, cap: Date): Date | undefined {
  const last = series[series.length - 1];
  if (!last) return undefined;
  const d = new Date(`${dayToDate(last[0])}T00:00:00.000Z`);
  return d.getTime() > cap.getTime() ? cap : d;
}
