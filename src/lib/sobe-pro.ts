export const SOBE_PRO = {
  key: "pro",
  name: "SOBE Pro",
  price: 69.9,
  formattedPrice: "R$ 69,90",
  launchLabel: "Preço especial de lançamento.",
  publicLimits: {
    businesses: 1,
    publishedPages: 5,
    teamMembers: 3,
    aiActionsPerMonth: 50,
  },
  internalGuardrails: {
    mediaStorageMb: 100,
    newLeadsPerMonth: 1_000,
    trackedVisitsPerMonth: 10_000,
  },
} as const;

export const SOBE_TRIAL = {
  key: "trial",
  name: "Período de teste",
  days: 7,
  retentionDays: 30,
  limits: {
    businesses: 1,
    publishedPages: 1,
    teamMembers: 1,
    aiActionsTotal: 10,
  },
} as const;

export const SOBE_POSITIONING =
  "A SOBE transforma a atenção que sua empresa gera nas redes em uma estrutura digital preparada para levar o cliente à próxima ação.";

export const SOBE_BRAND_PROMISE =
  "Você traz a sua marca. A SOBE ajuda a montar o resto.";

export function getTrialDaysRemaining(endsAt?: string, now = new Date()) {
  if (!endsAt) return SOBE_TRIAL.days;
  return Math.max(
    0,
    Math.ceil((new Date(endsAt).getTime() - now.getTime()) / 86_400_000),
  );
}
