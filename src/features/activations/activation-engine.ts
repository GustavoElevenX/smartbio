import type { ConversionActivation } from "./activation.types";
export function effectiveActivationStatus(activation: Pick<ConversionActivation, "status" | "startsAt" | "endsAt">, now: Date): "inactive" | "active" {
  if (!["active", "scheduled"].includes(activation.status)) return "inactive";
  const timestamp = now.getTime();
  if (activation.startsAt && new Date(activation.startsAt).getTime() > timestamp) return "inactive";
  if (activation.endsAt && new Date(activation.endsAt).getTime() <= timestamp) return "inactive";
  return "active";
}
