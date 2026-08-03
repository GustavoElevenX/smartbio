export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "SmartBio";

export const features = {
  aiGeneration: process.env.NEXT_PUBLIC_FEATURE_AI === "true",
  aiBusinessAnalysis: process.env.NEXT_PUBLIC_FEATURE_AI_BUSINESS_ANALYSIS === "true",
  aiJourneyComposition: process.env.NEXT_PUBLIC_FEATURE_AI_JOURNEY_COMPOSITION === "true",
  nativeQualification: process.env.NEXT_PUBLIC_FEATURE_QUALIFICATION !== "false",
  nativeQuotes: process.env.NEXT_PUBLIC_FEATURE_QUOTES !== "false",
  nativeScheduling: process.env.NEXT_PUBLIC_FEATURE_SCHEDULING !== "false",
  nativeRouting: process.env.NEXT_PUBLIC_FEATURE_ROUTING !== "false",
  nativeCatalogOrders: process.env.NEXT_PUBLIC_FEATURE_CATALOG_ORDERS === "true",
  nativeReservations: process.env.NEXT_PUBLIC_FEATURE_RESERVATIONS === "true",
  externalPayments: process.env.NEXT_PUBLIC_FEATURE_EXTERNAL_PAYMENTS === "true",
  calendarSync: process.env.NEXT_PUBLIC_FEATURE_CALENDAR_SYNC === "true",
  nativeChat: process.env.NEXT_PUBLIC_FEATURE_CHAT === "true",
  billing: process.env.NEXT_PUBLIC_FEATURE_BILLING === "true",
  customDomains: process.env.NEXT_PUBLIC_FEATURE_CUSTOM_DOMAINS === "true",
  multiUnitRouting: process.env.NEXT_PUBLIC_FEATURE_MULTI_UNIT !== "false",
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
