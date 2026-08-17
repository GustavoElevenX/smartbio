import type { PresencePage } from "@/features/presence/presence.types";

export interface SiteQualityWarning { code: string; message: string; pageId: string }

export function inspectPageQuality(page: PresencePage): SiteQualityWarning[] {
  const warnings: SiteQualityWarning[] = [];
  if (!page.sections.some((section) => section.type === "hero")) warnings.push({ code: "missing_hero", message: "A página não apresenta uma abertura clara.", pageId: page.id });
  if (!page.defaultConversionGoalId && !page.sections.some((section) => section.type === "conversion_cta")) warnings.push({ code: "missing_conversion", message: "Conecte a página a um objetivo de conversão.", pageId: page.id });
  if (page.sections.length > 12) warnings.push({ code: "high_density", message: "A página pode estar longa demais para leitura rápida.", pageId: page.id });
  return warnings;
}
