import type { PresenceSectionType } from "@/features/presence/presence.types";
import type { BusinessShape, SuggestedSection } from "./site-composer.types";

function section(sectionType: PresenceSectionType, purpose: string, priority: SuggestedSection["priority"] = "recommended", suggestedContent: Record<string, unknown> = {}, sourceBindings: string[] = []): SuggestedSection {
  return { sectionType, purpose, priority, suggestedContent, sourceBindings, reasoning: `Recomendada para ${purpose.toLowerCase()}.` };
}

export function recommendSections(shape: BusinessShape): SuggestedSection[] {
  const heroVariant = shape.model === "b2b" ? "editorial" : shape.hasCatalog ? "product_focus" : shape.model === "professional" ? "minimal" : "split";
  const result = [section("hero", "Apresentar a proposta de valor e a ação principal", "essential", { badges: [], alignment: "left", variant: heroVariant }, ["brand", "conversionGoals", "businessProfile"] )];
  if (shape.hasCatalog) result.push(section("products", shape.productCount > 8 ? "Destacar itens e conduzir ao catálogo completo" : "Apresentar a oferta", "recommended", { layout: shape.productCount > 8 ? "featured" : "grid", maxItems: Math.min(8, Math.max(1, shape.productCount)), showPrice: true }, ["commercialConfig.catalogItems", "commercialConfig.catalogCategories"]));
  if (shape.serviceCount) result.push(section("services", "Explicar os serviços disponíveis", "recommended", { dataSource: "commercial_data", layout: shape.serviceCount > 4 ? "featured" : "grid", showPrice: true }, ["commercialConfig.serviceOfferings"]));
  if (shape.model === "b2b" || shape.hasQualification) result.push(section("benefits", "Explicar valor, processo e critérios antes do contato", "recommended", { items: [
    { id: "benefit-context", title: "Contexto antes do contato", description: "Organize as informações essenciais para uma conversa comercial produtiva." },
    { id: "benefit-fit", title: "Qualificação objetiva", description: "Direcione cada oportunidade de acordo com necessidade e aderência." },
    { id: "benefit-handoff", title: "Handoff com continuidade", description: "Leve respostas e intenção para quem fará o atendimento." },
  ] }, ["businessProfile", "commercialConfig.qualificationRules"]));
  if (shape.hasPortfolio) result.push(section("portfolio", "Demonstrar trabalhos e resultados"));
  if (shape.hasTestimonials) result.push(section("testimonials", "Reforçar confiança com evidências verificadas"));
  if (shape.locationCount) result.push(section("locations", "Apresentar unidades sem presumir geolocalização", "recommended", { showOpeningHours: true, showPhone: true, showMapLink: true }, ["commercialConfig.locations"]));
  result.push(section("faq", "Reduzir dúvidas antes da decisão", "optional"));
  result.push(section("conversion_cta", "Conectar a página ao objetivo principal", "essential"));
  return result;
}
