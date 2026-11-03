import { semanticJourneyRouteKey } from "@/features/routing/completion-destination";
import { resolveRoute } from "@/features/routing/routing-engine";
import type { Project, RoutingDestination, StepOption } from "@/types";

export interface WhatsAppTarget {
  phone: string;
  destination?: RoutingDestination;
  source: "destination" | "location" | "option" | "project";
}

export function normalizeWhatsAppPhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : undefined;
}

export function isValidWhatsAppPhone(value: unknown) {
  return Boolean(normalizeWhatsAppPhone(value));
}

function targetFromDestination(destination: RoutingDestination | undefined): WhatsAppTarget | undefined {
  const phone = destination?.type === "whatsapp" ? normalizeWhatsAppPhone(destination.value) : undefined;
  return phone && destination ? { phone, destination, source: "destination" } : undefined;
}

function generalTarget(project: Project): WhatsAppTarget | undefined {
  const projectPhone = normalizeWhatsAppPhone(project.phone);
  if (projectPhone) return { phone: projectPhone, source: "project" };
  const destinations = project.commercialConfig?.routingDestinations || [];
  const valid = destinations.filter((item) => item.type === "whatsapp" && isValidWhatsAppPhone(item.value));
  const explicitGeneral = valid.find((item) => item.isDefault && item.role === "general_contact")
    || valid.find((item) => item.role === "general_contact")
    || valid.find((item) => item.isDefault && !item.locationId);
  const configured = targetFromDestination(explicitGeneral);
  if (configured) return configured;
  const global = valid.filter((item) => !item.locationId);
  return global.length === 1 ? targetFromDestination(global[0]) : undefined;
}

export function whatsappRoutingModel(project: Project) {
  const destinations = structuredClone(project.commercialConfig?.routingDestinations || []);
  const locations = structuredClone(project.commercialConfig?.locations || []);

  for (const location of locations) {
    const linked = destinations.find((item) => item.id === location.routingDestinationId && item.type === "whatsapp" && isValidWhatsAppPhone(item.value));
    if (linked) continue;
    const directPhone = normalizeWhatsAppPhone(location.whatsapp || location.phone);
    if (!directPhone) continue;
    const existing = destinations.find((item) => item.type === "whatsapp" && item.locationId === location.id && normalizeWhatsAppPhone(item.value) === directPhone);
    const destination = existing || {
      id: `whatsapp-location-${location.id}`,
      key: `whatsapp-location-${location.id}`,
      type: "whatsapp" as const,
      label: `WhatsApp · ${location.name}`,
      locationId: location.id,
      value: directPhone,
      role: "location_contact" as const,
    };
    if (!existing) destinations.push(destination);
    location.routingDestinationId = destination.id;
  }

  let fallbackDestination = destinations.find((item) => (
    item.type === "whatsapp" && !item.locationId && item.isDefault && item.role === "general_contact" && isValidWhatsAppPhone(item.value)
  ));
  const projectPhone = normalizeWhatsAppPhone(project.phone);
  if (fallbackDestination && projectPhone) {
    const fallbackIndex = destinations.findIndex((item) => item.id === fallbackDestination?.id);
    destinations[fallbackIndex] = { ...fallbackDestination, value: projectPhone };
    fallbackDestination = destinations[fallbackIndex];
  } else if (!fallbackDestination && projectPhone) {
    const existingIndex = destinations.findIndex((item) => item.type === "whatsapp" && !item.locationId && normalizeWhatsAppPhone(item.value) === projectPhone);
    if (existingIndex >= 0) {
      destinations[existingIndex] = { ...destinations[existingIndex], isDefault: true, role: "general_contact" };
      fallbackDestination = destinations[existingIndex];
    } else {
      fallbackDestination = {
        id: "whatsapp-project-primary",
        key: "whatsapp-project-primary",
        type: "whatsapp",
        label: "WhatsApp principal",
        value: projectPhone,
        isDefault: true,
        role: "general_contact",
      };
      destinations.push(fallbackDestination);
    }
  }
  return { destinations, locations, fallbackDestinationId: fallbackDestination?.id };
}

export function resolveWhatsAppTarget(project: Project, input: {
  destinationId?: unknown;
  phone?: unknown;
  locationId?: string;
} = {}): WhatsAppTarget | undefined {
  const destinations = project.commercialConfig?.routingDestinations || [];
  const explicitDestination = typeof input.destinationId === "string"
    ? targetFromDestination(destinations.find((item) => item.id === input.destinationId))
    : undefined;
  if (input.locationId) {
    const location = project.commercialConfig?.locations?.find((item) => item.id === input.locationId && item.isActive);
    const linked = targetFromDestination(destinations.find((item) => item.id === location?.routingDestinationId));
    if (linked) return linked;
    const locationDestinations = destinations.filter((item) => item.locationId === input.locationId && item.type === "whatsapp" && isValidWhatsAppPhone(item.value));
    if (locationDestinations.length === 1) return targetFromDestination(locationDestinations[0]);
    const locationPhone = normalizeWhatsAppPhone(location?.whatsapp || location?.phone);
    if (locationPhone) return { phone: locationPhone, source: "location" };
  }

  if (explicitDestination) return explicitDestination;

  const configuredPhone = normalizeWhatsAppPhone(project.phone);
  if (configuredPhone) return { phone: configuredPhone, source: "project" };

  const explicitPhone = normalizeWhatsAppPhone(input.phone);
  if (explicitPhone) return { phone: explicitPhone, source: "option" };
  if (typeof input.phone === "string" && input.phone.trim()) return undefined;

  return generalTarget(project);
}

function routedTarget(project: Project, option: StepOption, locationId?: string) {
  const { destinations, locations, fallbackDestinationId } = whatsappRoutingModel(project);
  const blueprintId = typeof option.actionPayload?.blueprintId === "string" ? option.actionPayload.blueprintId : undefined;
  const result = resolveRoute(
    {
      ...(locationId ? { location_id: locationId } : {}),
      ...(locationId && blueprintId ? { journey_route: semanticJourneyRouteKey(blueprintId, locationId) } : {}),
    },
    project.commercialConfig?.routingRules || [],
    destinations,
    fallbackDestinationId,
    locations,
    "whatsapp",
  );
  const resolved = targetFromDestination(result.destination);
  if (resolved) return resolved;
  return resolveWhatsAppTarget(project, {
    phone: option.actionPayload?.phone,
  });
}

export function whatsappActionHasUsableDestination(project: Project, option: StepOption) {
  if (option.actionType !== "open_whatsapp") return false;
  if (option.actionPayload?.routing !== true) {
    return Boolean(resolveWhatsAppTarget(project, {
      destinationId: option.actionPayload?.destinationId,
      phone: option.actionPayload?.phone,
    }));
  }
  const locations = project.commercialConfig?.locations?.filter((item) => item.isActive) || [];
  if (!locations.length) return Boolean(routedTarget(project, option));
  return locations.every((location) => Boolean(routedTarget(project, option, location.id)));
}

export function projectHasUsableWhatsApp(project: Project) {
  const actions = project.steps.filter((step) => step.isActive).flatMap((step) => step.options || []).filter((option) => option.actionType === "open_whatsapp");
  return actions.length
    ? actions.every((option) => whatsappActionHasUsableDestination(project, option))
    : Boolean(generalTarget(project));
}
