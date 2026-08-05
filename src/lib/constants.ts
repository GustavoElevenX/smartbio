import { clientEnv } from "@/lib/env/client";

export const APP_NAME = clientEnv.NEXT_PUBLIC_APP_NAME;

export const features = {
  aiGeneration: clientEnv.NEXT_PUBLIC_FEATURE_AI,
  aiBusinessAnalysis: clientEnv.NEXT_PUBLIC_FEATURE_AI_BUSINESS_ANALYSIS,
  aiJourneyComposition: clientEnv.NEXT_PUBLIC_FEATURE_AI_JOURNEY_COMPOSITION,
  aiSourceImport: clientEnv.NEXT_PUBLIC_FEATURE_AI_SOURCE_IMPORT,
  aiBrandAnalysis: clientEnv.NEXT_PUBLIC_FEATURE_AI_BRAND_ANALYSIS,
  nativeQualification: clientEnv.NEXT_PUBLIC_FEATURE_QUALIFICATION,
  nativeQuotes: clientEnv.NEXT_PUBLIC_FEATURE_QUOTES,
  nativeScheduling: clientEnv.NEXT_PUBLIC_FEATURE_SCHEDULING,
  nativeRouting: clientEnv.NEXT_PUBLIC_FEATURE_ROUTING,
  geoRouting: clientEnv.NEXT_PUBLIC_FEATURE_GEO_ROUTING,
  nativeCatalogOrders: clientEnv.NEXT_PUBLIC_FEATURE_CATALOG_ORDERS,
  nativeReservations: clientEnv.NEXT_PUBLIC_FEATURE_RESERVATIONS,
  externalPayments: clientEnv.NEXT_PUBLIC_FEATURE_EXTERNAL_PAYMENTS,
  notifications: clientEnv.NEXT_PUBLIC_FEATURE_NOTIFICATIONS,
  calendarSync: clientEnv.NEXT_PUBLIC_FEATURE_CALENDAR_SYNC,
  nativeChat: clientEnv.NEXT_PUBLIC_FEATURE_CHAT,
  billing: clientEnv.NEXT_PUBLIC_FEATURE_BILLING,
  customDomains: clientEnv.NEXT_PUBLIC_FEATURE_CUSTOM_DOMAINS,
  multiUnitRouting: clientEnv.NEXT_PUBLIC_FEATURE_MULTI_UNIT,
};

export const capabilityLabels = {
  qualification: "Qualificação comercial",
  quote: "Orçamentos",
  scheduling: "Agenda",
  catalog_order: "Catálogo e pedidos",
  reservation: "Reserva e disponibilidade",
  routing: "Roteamento",
  payment: "Pagamento conectado",
} as const;

export const reservedSlugs = new Set([
  "app", "api", "login", "register", "forgot-password", "pricing", "privacy", "terms", "smartbio",
]);

export const goalOptions = [
  "Gerar vendas", "Gerar leads", "Receber pedidos", "Agendar", "Apresentar serviços", "Criar orçamento", "Outro",
];

export const destinationOptions = ["WhatsApp", "Formulário", "Link externo", "Agenda", "Checkout", "E-mail"];
export const personalityOptions = ["Minimalista", "Premium", "Vibrante", "Elegante", "Tecnológica", "Orgânica"];
