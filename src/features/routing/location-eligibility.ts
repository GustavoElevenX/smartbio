import type { BusinessLocation } from "@/types";

export function locationEligibilityIssue(location: BusinessLocation, context: Record<string, unknown>) {
  if (!location.isActive) return "Esta unidade não está disponível.";
  const fulfillment = context.fulfillment;
  if (fulfillment === "delivery" && !location.supportsDelivery) return "Esta unidade não atende por entrega.";
  if (fulfillment === "pickup" && !location.supportsPickup) return "Esta unidade não oferece retirada.";
  if (fulfillment === "in_person" && !location.supportsInPerson) return "Esta unidade não atende presencialmente.";
  const offered = location.settings?.offeringIds;
  const selected = context.selected_offering_ids;
  if (Array.isArray(offered) && Array.isArray(selected) && selected.some((id) => !offered.includes(id))) return "Esta unidade não atende todas as opções escolhidas.";
  return undefined;
}
