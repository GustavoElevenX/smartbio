import type { BusinessShape } from "./site-composer.types";

export type ContentDensity = "compact" | "balanced" | "detailed";

export function recommendContentDensity(shape: BusinessShape): ContentDensity {
  if (shape.model === "b2b" || shape.model === "professional" || shape.hasQualification) return "detailed";
  if (shape.productCount > 30 || shape.serviceCount > 8) return "balanced";
  return "compact";
}
