export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "SmartBio";

export const features = {
  aiGeneration: process.env.NEXT_PUBLIC_FEATURE_AI === "true",
  nativeChat: process.env.NEXT_PUBLIC_FEATURE_CHAT === "true",
  billing: process.env.NEXT_PUBLIC_FEATURE_BILLING === "true",
  customDomains: process.env.NEXT_PUBLIC_FEATURE_CUSTOM_DOMAINS === "true",
  multiUnitRouting: process.env.NEXT_PUBLIC_FEATURE_MULTI_UNIT !== "false",
};

export const reservedSlugs = new Set([
  "app", "api", "login", "register", "forgot-password", "pricing", "privacy", "terms", "smartbio",
]);

export const goalOptions = [
  "Gerar vendas", "Gerar leads", "Receber pedidos", "Agendar", "Apresentar serviços", "Criar orçamento", "Outro",
];

export const destinationOptions = ["WhatsApp", "Formulário", "Link externo", "Agenda", "Checkout", "E-mail"];
export const personalityOptions = ["Minimalista", "Premium", "Vibrante", "Elegante", "Tecnológica", "Orgânica"];
