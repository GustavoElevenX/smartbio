import type { BusinessShape } from "./site-composer.types";

export function recommendConversionStrategy(shape: BusinessShape) {
  if (shape.hasQualification || shape.model === "b2b") return ["qualificar_demanda", "handoff_comercial"];
  if (shape.hasScheduling) return ["escolher_servico", "agendar"];
  if (shape.hasReservation) return ["consultar_disponibilidade", "reservar"];
  if (shape.hasCatalog) return ["escolher_produto", "iniciar_pedido"];
  return ["manifestar_interesse", "contato"];
}
