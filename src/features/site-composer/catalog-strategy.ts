import type { CatalogPresentationStrategy, CatalogStrategyThresholds } from "./site-composer.types";

export const DEFAULT_CATALOG_THRESHOLDS: CatalogStrategyThresholds = {
  inlineMax: 8,
  featuredMax: 30,
  categoriesMax: 100,
};

export function chooseCatalogStrategy(
  productCount: number,
  thresholds: CatalogStrategyThresholds = DEFAULT_CATALOG_THRESHOLDS,
): CatalogPresentationStrategy {
  if (productCount <= thresholds.inlineMax) return "inline_all";
  if (productCount <= thresholds.featuredMax) return "featured_then_catalog";
  if (productCount <= thresholds.categoriesMax) return "categories_then_catalog";
  return "search_first";
}
