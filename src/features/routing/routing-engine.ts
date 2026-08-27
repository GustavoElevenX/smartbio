import { evaluateCondition } from "@/features/capabilities/rules";
import { destinationMatchesCompletion } from "@/features/routing/completion-destination";
import type { JourneyCompletionType } from "@/features/ai-setup/ai-setup.schema";
import type { BusinessLocation, RouteResult, RoutingDestination, RoutingRule } from "@/types";

export function resolveRoute(
  context: Record<string, unknown>,
  rules: RoutingRule[],
  destinations: RoutingDestination[],
  fallbackDestinationId?: string,
  locations: BusinessLocation[] = [],
  completionType?: JourneyCompletionType,
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
    if (destination && (!completionType || destinationMatchesCompletion(destination, completionType))) return { destination, fallback: false, reason: `Destino ${completionType || destination.type} da unidade ${location?.name || selectedLocationId} aplicado.` };
  }
  const ordered = rules.filter((rule) => rule.isActive).toSorted((a, b) => b.priority - a.priority);
  const matched = ordered.find((rule) => {
    if (!evaluateCondition(rule.condition, context)) return false;
    const candidate = destinations.find((item) => item.id === rule.destinationId);
    if (completionType && !destinationMatchesCompletion(candidate, completionType)) return false;
    return !selectedLocationId || !candidate?.locationId || candidate.locationId === selectedLocationId;
  });
  const destinationId = matched?.destinationId || (!selectedLocationId ? fallbackDestinationId : undefined);
  const destination = destinations.find((item) => item.id === destinationId);
  const compatibleDestination = completionType && !destinationMatchesCompletion(destination, completionType) ? undefined : destination;
  return {
    destination: compatibleDestination,
    ruleId: matched?.id,
    fallback: !matched,
    reason: matched ? `Regra semântica de prioridade ${matched.priority} aplicada.` : compatibleDestination ? "Fallback geral explicitamente configurado aplicado." : selectedLocationId ? `A unidade selecionada não possui um destino ${completionType || "compatível"} confiável.` : "Nenhum destino confiável disponível.",
  };
}
