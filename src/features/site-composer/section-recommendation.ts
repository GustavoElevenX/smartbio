import type { PresenceSectionType } from "@/features/presence/presence.types";
import type { BusinessShape, SuggestedSection } from "./site-composer.types";

function section(sectionType: PresenceSectionType, purpose: string, priority: SuggestedSection["priority"] = "recommended"): SuggestedSection {
  return { sectionType, purpose, priority, suggestedContent: {}, sourceBindings: [], reasoning: `Recomendada para ${purpose.toLowerCase()}.` };
}

export function recommendSections(shape: BusinessShape): SuggestedSection[] {
  const result = [section("hero", "Apresentar a proposta de valor e a ação principal", "essential")];
  if (shape.hasCatalog) result.push(section("products", shape.productCount > 8 ? "Destacar itens e conduzir ao catálogo completo" : "Apresentar a oferta"));
  if (shape.serviceCount) result.push(section("services", "Explicar os serviços disponíveis"));
  if (shape.hasPortfolio) result.push(section("portfolio", "Demonstrar trabalhos e resultados"));
  if (shape.hasTestimonials) result.push(section("testimonials", "Reforçar confiança com evidências verificadas"));
  if (shape.locationCount) result.push(section("locations", "Apresentar unidades sem presumir geolocalização"));
  result.push(section("faq", "Reduzir dúvidas antes da decisão", "optional"));
  result.push(section("conversion_cta", "Conectar a página ao objetivo principal", "essential"));
  return result;
}
