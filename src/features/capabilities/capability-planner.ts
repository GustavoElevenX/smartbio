import { createCapability } from "@/features/capabilities/capability-registry";
import type { BusinessCapabilityProfile, CapabilityKey, ProjectCapability } from "@/types";

export class CapabilityPlanner {
  plan(profile: BusinessCapabilityProfile): ProjectCapability[] {
    const selected = new Set<CapabilityKey>();
    const intents = new Set([...profile.primaryIntents, ...profile.secondaryIntents]);
    const offers = new Set(profile.offerKinds);
    const capacities = new Set(profile.capacityKinds);

    if (profile.requiresQualification || intents.has("request_proposal")) selected.add("qualification");
    if (intents.has("request_quote")) selected.add("quote");
    if (intents.has("schedule") || capacities.has("time_slot") || capacities.has("professional")) selected.add("scheduling");
    if (intents.has("order") || intents.has("buy") || offers.has("physical_product") || offers.has("digital_product")) selected.add("catalog_order");
    if (intents.has("reserve") || intents.has("check_availability") || offers.has("hospitality") || offers.has("rental")) selected.add("reservation");
    if (profile.hasMultipleLocations || capacities.has("location")) selected.add("routing");
    if (profile.requiresPayment || intents.has("pay_deposit")) selected.add("payment");

    if (!selected.size) selected.add("qualification");
    return [...selected].map((key) => createCapability(key));
  }
}

export const capabilityPlanner = new CapabilityPlanner();
