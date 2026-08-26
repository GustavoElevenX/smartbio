import { evaluateCondition } from "@/features/capabilities/rules";
import type { BusinessLocation, RouteResult, RoutingDestination, RoutingRule } from "@/types";

export function resolveRoute(
  context: Record<string, unknown>,
  rules: RoutingRule[],
  destinations: RoutingDestination[],
  fallbackDestinationId?: string,
  locations: BusinessLocation[] = [],
): RouteResult {
  const selectedLocationId = typeof context.location_id === "string"
    ? context.location_id
    : typeof context.locationId === "string"
      ? context.locationId
      : undefined;
  if (selectedLocationId) {
    const location = locations.find((item) => item.id === selectedLocationId && item.isActive);
    const destination = location?.routingDestinationId
      ? destinations.find((item) => item.id === location.routingDestinationId)
      : undefined;
    if (destination) return { destination, fallback: false, reason: `Destino da unidade ${location?.name || selectedLocationId} aplicado.` };
  }
  const ordered = rules.filter((rule) => rule.isActive).toSorted((a, b) => b.priority - a.priority);
  const matched = ordered.find((rule) => evaluateCondition(rule.condition, context));
  const destinationId = matched?.destinationId || fallbackDestinationId;
  const destination = destinations.find((item) => item.id === destinationId);
  return {
    destination,
    ruleId: matched?.id,
    fallback: !matched,
    reason: matched ? `Regra de prioridade ${matched.priority} aplicada.` : destination ? "Fallback geral explicitamente configurado aplicado." : selectedLocationId ? "A unidade selecionada não possui um destino confiável." : "Nenhum destino confiável disponível.",
  };
}
