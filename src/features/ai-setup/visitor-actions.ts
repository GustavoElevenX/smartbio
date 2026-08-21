import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import type {
  BusinessCapabilityProfile,
  CommercialIntent,
  ConversionGoal,
  Project,
} from "@/types";

export const visitorActionCatalog = [
  { key: "order", label: "Fazer um pedido", description: "Escolher produtos e continuar o pedido.", kind: "buy", intent: "order", capabilityKey: "catalog_order" },
  { key: "buy", label: "Comprar", description: "Escolher uma oferta e seguir para a compra.", kind: "buy", intent: "buy", capabilityKey: "catalog_order" },
  { key: "view_products", label: "Ver produtos", description: "Conhecer as opções disponíveis.", kind: "learn", intent: "buy", capabilityKey: "catalog_order" },
  { key: "quote", label: "Pedir orçamento", description: "Explicar o que precisa e solicitar uma proposta.", kind: "request_quote", intent: "request_quote", capabilityKey: "quote" },
  { key: "schedule", label: "Agendar", description: "Escolher um serviço e um horário.", kind: "schedule", intent: "schedule", capabilityKey: "scheduling" },
  { key: "reserve", label: "Reservar", description: "Consultar disponibilidade e fazer uma reserva.", kind: "reserve", intent: "reserve", capabilityKey: "reservation" },
  { key: "contact", label: "Falar com a equipe", description: "Enviar o contexto para receber atendimento.", kind: "contact", intent: "contact" },
  { key: "find_location", label: "Encontrar uma unidade", description: "Ver onde comprar ou ser atendido.", kind: "visit", intent: "visit", capabilityKey: "routing" },
  { key: "support", label: "Solicitar atendimento", description: "Pedir ajuda à equipe com o contexto certo.", kind: "contact", intent: "contact" },
  { key: "resale", label: "Revender / comprar para empresa", description: "Falar com o comercial sobre volumes e condições.", kind: "request_quote", intent: "request_proposal", capabilityKey: "qualification" },
  { key: "recommendation", label: "Receber uma recomendação", description: "Responder perguntas e descobrir a melhor opção.", kind: "learn", intent: "request_proposal", capabilityKey: "qualification" },
  { key: "other", label: "Outro", description: "Definir uma ação específica para o seu negócio.", kind: "custom", intent: "contact" },
] as const;

export type VisitorActionKey = (typeof visitorActionCatalog)[number]["key"];
export type VisitorActionSelection = {
  key: VisitorActionKey;
  label: string;
  isPrimary: boolean;
};

const byKey = new Map(visitorActionCatalog.map((item) => [item.key, item]));

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function suggestVisitorActionKeys(profile: BusinessCapabilityProfile): VisitorActionKey[] {
  const intents = new Set([...profile.primaryIntents, ...profile.secondaryIntents]);
  const keys: VisitorActionKey[] = [];
  if (intents.has("order")) keys.push("order", "view_products");
  else if (intents.has("buy")) keys.push("buy", "view_products");
  if (intents.has("request_quote")) keys.push("quote");
  if (intents.has("schedule")) keys.push("schedule");
  if (intents.has("reserve") || intents.has("check_availability")) keys.push("reserve");
  if (profile.hasMultipleLocations || profile.capacityKinds.includes("location")) keys.push("find_location");
  if (profile.requiresQualification || intents.has("request_proposal")) keys.push("recommendation");
  if (intents.has("contact")) keys.push("contact");
  if (!keys.length) keys.push("contact");
  return unique(keys).slice(0, 5);
}

export function defaultVisitorActions(profile: BusinessCapabilityProfile): VisitorActionSelection[] {
  return suggestVisitorActionKeys(profile).map((key, index) => ({
    key,
    label: byKey.get(key)?.label || "Continuar",
    isPrimary: index === 0,
  }));
}

export function profileWithVisitorActions(
  profile: BusinessCapabilityProfile,
  actions: VisitorActionSelection[],
): BusinessCapabilityProfile {
  const intents = actions
    .map((action) => byKey.get(action.key)?.intent)
    .filter((intent) => intent !== undefined) as CommercialIntent[];
  const primaryIntents = actions
    .filter((action) => action.isPrimary)
    .map((action) => byKey.get(action.key)?.intent)
    .filter((intent) => intent !== undefined) as CommercialIntent[];
  return {
    ...profile,
    primaryIntents: unique([
      ...primaryIntents,
      ...profile.primaryIntents,
    ]),
    secondaryIntents: unique([...profile.secondaryIntents, ...intents]),
    hasMultipleLocations:
      profile.hasMultipleLocations || actions.some((action) => action.key === "find_location"),
    requiresQualification:
      profile.requiresQualification || actions.some((action) => ["recommendation", "resale"].includes(action.key)),
  };
}

function targetStepForAction(project: Project, key: VisitorActionKey) {
  const preferredTypes: Partial<Record<VisitorActionKey, Project["steps"][number]["type"][]>> = {
    order: ["catalog", "cart", "choice"],
    buy: ["catalog", "cart", "choice"],
    view_products: ["catalog", "choice"],
    quote: ["quote", "form", "choice"],
    schedule: ["schedule", "availability", "choice"],
    reserve: ["reservation", "availability", "choice"],
    contact: ["form", "action", "choice"],
    find_location: ["routing", "choice"],
    support: ["form", "action", "choice"],
    resale: ["form", "quote", "choice"],
    recommendation: ["recommendation", "form", "choice"],
    other: ["choice", "form", "action"],
  };
  const active = project.steps.filter((step) => step.isActive);
  return preferredTypes[key]
    ?.map((type) => active.find((step) => step.type === type))
    .find(Boolean) || active[0];
}

export function applyVisitorActionsToProject(project: Project, session: Pick<AISetupSession, "visitorActions">): Project {
  const selected = session.visitorActions || [];
  if (!selected.length) return project;
  const goals: ConversionGoal[] = selected.flatMap((action, order) => {
    const target = targetStepForAction(project, action.key);
    const definition = byKey.get(action.key);
    if (!target || !definition) return [];
    return [{
      id: `${project.id}-goal-${action.key}`,
      projectId: project.id,
      name: action.label,
      description: definition.description,
      kind: definition.kind,
      targetStepId: target.id,
      destinationLabel: project.primaryDestination,
      isPrimary: action.isPrimary,
      isActive: true,
      order,
    } satisfies ConversionGoal];
  });
  const primary = goals.find((goal) => goal.isPrimary) || goals[0];
  return {
    ...project,
    primaryGoal: primary?.name || project.primaryGoal,
    conversionGoals: goals.length ? goals : project.conversionGoals,
  };
}

export function visitorActionDefinition(key: VisitorActionKey) {
  return byKey.get(key);
}
