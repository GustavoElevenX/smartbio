import { evaluateCondition } from "@/features/capabilities/rules";
import type { RouteResult, RoutingDestination, RoutingRule } from "@/types";

export function resolveRoute(
  context: Record<string, unknown>,
  rules: RoutingRule[],
  destinations: RoutingDestination[],
  fallbackDestinationId?: string,
): RouteResult {
  const ordered = rules.filter((rule) => rule.isActive).toSorted((a, b) => b.priority - a.priority);
  const matched = ordered.find((rule) => evaluateCondition(rule.condition, context));
  const destinationId = matched?.destinationId || fallbackDestinationId;
  const destination = destinations.find((item) => item.id === destinationId);
  return {
    destination,
    ruleId: matched?.id,
    fallback: !matched,
    reason: matched ? `Regra de prioridade ${matched.priority} aplicada.` : destination ? "Destino padrão aplicado." : "Nenhum destino disponível.",
  };
}
