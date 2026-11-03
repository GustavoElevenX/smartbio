import type { Project, RoutingDestination } from "@/types";
import { isValidWhatsAppPhone, normalizeWhatsAppPhone } from "./whatsapp-destination";

export type WhatsAppNumberErrors = Record<string, { label?: string; phone?: string }>;

function legacyDestination(project: Project): RoutingDestination | undefined {
  if (!project.phone) return undefined;
  return {
    id: "00000000-0000-4000-8000-000000000001",
    key: "whatsapp-project-primary",
    type: "whatsapp",
    label: "WhatsApp principal",
    value: project.phone,
    isDefault: true,
    role: "general_contact",
  };
}

export function projectWhatsAppNumbers(project: Project) {
  const configured = (project.commercialConfig?.routingDestinations || [])
    .filter((item) => item.type === "whatsapp" && !item.locationId)
    .map((item) => ({ ...item }));
  const projectPhone = normalizeWhatsAppPhone(project.phone);
  const hasProjectPhone = Boolean(projectPhone) && configured.some((item) => normalizeWhatsAppPhone(item.value) === projectPhone);
  const legacy = !hasProjectPhone ? legacyDestination(project) : undefined;
  const numbers = legacy ? [legacy, ...configured] : configured;
  const primaryIndex = Math.max(0, numbers.findIndex((item) => (
    projectPhone && normalizeWhatsAppPhone(item.value) === projectPhone
  ) || (item.isDefault && item.role === "general_contact")));

  return numbers.map((item, index) => ({
    ...item,
    isDefault: index === primaryIndex,
    role: index === primaryIndex ? "general_contact" as const : item.role === "general_contact" ? "intent_contact" as const : item.role,
  }));
}

export function createProjectWhatsAppNumber(primary = false): RoutingDestination {
  const id = crypto.randomUUID();
  return {
    id,
    key: `whatsapp-${id}`,
    type: "whatsapp",
    label: primary ? "WhatsApp principal" : "Novo atendimento",
    value: "",
    isDefault: primary,
    role: primary ? "general_contact" : "intent_contact",
  };
}

export function whatsappNumberErrors(numbers: RoutingDestination[]): WhatsAppNumberErrors {
  const errors: WhatsAppNumberErrors = {};
  const occurrences = new Map<string, number>();
  for (const item of numbers) {
    const phone = normalizeWhatsAppPhone(item.value);
    if (phone) occurrences.set(phone, (occurrences.get(phone) || 0) + 1);
  }
  for (const item of numbers) {
    const itemErrors: WhatsAppNumberErrors[string] = {};
    if (!item.label.trim()) itemErrors.label = "Dê um nome para identificar este atendimento.";
    const phone = normalizeWhatsAppPhone(item.value);
    if (!isValidWhatsAppPhone(item.value)) itemErrors.phone = "Informe DDD e número; inclua o código do país quando necessário.";
    else if (phone && (occurrences.get(phone) || 0) > 1) itemErrors.phone = "Este número já está cadastrado.";
    if (itemErrors.label || itemErrors.phone) errors[item.id] = itemErrors;
  }
  return errors;
}

export function updateProjectWhatsAppNumbers(project: Project, numbers: RoutingDestination[]): Project {
  const primaryIndex = numbers.length ? Math.max(0, numbers.findIndex((item) => item.isDefault)) : -1;
  const normalized = numbers.map((item, index) => ({
    ...item,
    type: "whatsapp" as const,
    locationId: undefined,
    isDefault: index === primaryIndex,
    role: index === primaryIndex ? "general_contact" as const : item.role === "location_contact" || item.role === "general_contact" ? "intent_contact" as const : item.role,
  }));
  const otherDestinations = (project.commercialConfig?.routingDestinations || []).filter((item) => item.type !== "whatsapp" || Boolean(item.locationId));
  return {
    ...project,
    phone: normalized[primaryIndex]?.value || undefined,
    commercialConfig: {
      ...project.commercialConfig,
      routingDestinations: [...otherDestinations, ...normalized],
    },
    updatedAt: new Date().toISOString(),
  };
}

export function primaryWhatsAppDestination(project: Project) {
  return projectWhatsAppNumbers(project).find((item) => item.isDefault) || projectWhatsAppNumbers(project)[0];
}
