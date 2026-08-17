import type { PresencePage } from "@/features/presence/presence.types";

export interface SiteQualityWarning { code: string; message: string; pageId: string }

export function inspectPageQuality(page: PresencePage): SiteQualityWarning[] {
  const warnings: SiteQualityWarning[] = [];
  const hero = page.sections.find((section) => section.type === "hero");
  if (!hero) warnings.push({ code: "missing_hero", message: "A página não apresenta uma abertura clara.", pageId: page.id });
  else {
    const content = hero.content as { primaryAction?: unknown; media?: { assetId?: string } };
    if (!content.primaryAction && !page.defaultConversionGoalId) warnings.push({ code: "hero_missing_cta", message: "O Hero não possui uma ação principal nem herda uma meta da página.", pageId: page.id });
    if (!content.media?.assetId && !hero.style.backgroundAssetId) warnings.push({ code: "hero_missing_media", message: "O Hero não possui imagem. Use uma composição minimalista ou conecte mídia real.", pageId: page.id });
  }
  if (!page.defaultConversionGoalId && !page.sections.some((section) => section.type === "conversion_cta")) warnings.push({ code: "missing_conversion", message: "Conecte a página a um objetivo de conversão.", pageId: page.id });
  page.sections
    .filter((section) => section.type === "faq" && !((section.content as { items?: unknown[] }).items?.length))
    .forEach(() => warnings.push({ code: "empty_faq", message: "O FAQ está vazio. Adicione dúvidas reais ou remova a seção.", pageId: page.id }));
  const goalIds = new Set(page.sections.flatMap((section) => {
    const content = section.content as { primaryAction?: { conversionGoalId?: string }; secondaryAction?: { conversionGoalId?: string } };
    return [content.primaryAction?.conversionGoalId, content.secondaryAction?.conversionGoalId].filter((value): value is string => Boolean(value));
  }));
  if (goalIds.size > 2) warnings.push({ code: "conflicting_ctas", message: "A página conduz a muitas metas diferentes. Defina uma ação principal mais clara.", pageId: page.id });
  if (page.sections.length > 12) warnings.push({ code: "high_density", message: "A página pode estar longa demais para leitura rápida.", pageId: page.id });
  return warnings;
}
