import { features } from "@/lib/constants";
import type { CapabilityKey, ProjectCapability } from "@/types";

export interface CapabilityDefinition {
  key: CapabilityKey;
  label: string;
  visitorDescription: string;
  enabledByFeature: boolean;
  defaultConfiguration: Record<string, unknown>;
}

export const capabilityRegistry: Record<CapabilityKey, CapabilityDefinition> = {
  qualification: {
    key: "qualification",
    label: "Qualificação comercial",
    visitorDescription: "entender o momento do visitante e recomendar o próximo passo",
    enabledByFeature: features.nativeQualification,
    defaultConfiguration: { coldMax: 19, potentialMax: 49, qualifiedMin: 50 },
  },
  quote: {
    key: "quote",
    label: "Orçamentos",
    visitorDescription: "receber pedidos de orçamento com contexto e fotos",
    enabledByFeature: features.nativeQuotes,
    defaultConfiguration: { currency: "BRL", estimationMode: "range" },
  },
  scheduling: {
    key: "scheduling",
    label: "Agenda",
    visitorDescription: "mostrar horários e receber agendamentos",
    enabledByFeature: features.nativeScheduling,
    defaultConfiguration: { timezone: "America/Sao_Paulo", slotIntervalMinutes: 30 },
  },
  catalog_order: {
    key: "catalog_order",
    label: "Catálogo e pedidos",
    visitorDescription: "mostrar produtos, montar um carrinho leve e receber pedidos",
    enabledByFeature: features.nativeCatalogOrders,
    defaultConfiguration: { currency: "BRL", fulfillment: ["delivery", "pickup"] },
  },
  reservation: {
    key: "reservation",
    label: "Reserva e disponibilidade",
    visitorDescription: "consultar datas e receber solicitações de reserva",
    enabledByFeature: features.nativeReservations,
    defaultConfiguration: { currency: "BRL", minimumNights: 1 },
  },
  routing: {
    key: "routing",
    label: "Roteamento",
    visitorDescription: "direcionar cada visitante para a unidade ou responsável certo",
    enabledByFeature: features.nativeRouting,
    defaultConfiguration: { fallback: "contact" },
  },
  payment: {
    key: "payment",
    label: "Pagamento conectado",
    visitorDescription: "continuar para um checkout ou pagamento de sinal externo",
    enabledByFeature: features.externalPayments,
    defaultConfiguration: { mode: "external_url" },
  },
};

export function createCapability(key: CapabilityKey, source: ProjectCapability["source"] = "suggested", configuration: Record<string, unknown> = {}): ProjectCapability {
  const definition = capabilityRegistry[key];
  return {
    key,
    enabled: definition.enabledByFeature,
    source,
    version: 1,
    configuration: { ...definition.defaultConfiguration, ...configuration },
  };
}
