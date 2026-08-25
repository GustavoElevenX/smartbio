import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import type {
  BusinessCapabilityProfile,
  CapabilityKey,
  CommercialIntent,
  ConversionGoal,
  JourneyStep,
  Project,
  RoutingDestination,
} from "@/types";
import { draftCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import { createCapability } from "@/features/capabilities/capability-registry";

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
  semanticKey?: Exclude<VisitorActionKey, "other">;
};

const byKey = new Map(visitorActionCatalog.map((item) => [item.key, item]));

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function inferDeclaredVisitorActionKeys(value: string): VisitorActionKey[] {
  const text = normalizedText(value);
  const keys: VisitorActionKey[] = [];
  const add = (key: VisitorActionKey, pattern: RegExp) => {
    if (pattern.test(text)) keys.push(key);
  };

  add("recommendation", /(?:ajud|orient).{0,90}(?:descobrir|entender|escolher|identificar|caminho|opcao)|(?:descobrir|entender|escolher).{0,70}(?:melhor|ideal|caminho|opcao|necessidade)|recomend/);
  add("order", /(?:fazer|receber|montar|enviar).{0,30}(?:pedido|encomenda)|pedir (?:comida|produto)/);
  add("buy", /(?:comprar|adquirir|finalizar compra)/);
  add("quote", /(?:pedir|solicitar|receber).{0,35}(?:orcamento|cotacao|proposta comercial)|(?:orcamento|cotacao) online/);
  add("schedule", /(?:agendar|marcar).{0,35}(?:horario|consulta|avaliacao|visita|atendimento)|escolher (?:um )?horario/);
  add("reserve", /(?:fazer|solicitar|consultar).{0,25}(?:reserva|disponibilidade)|reservar/);
  add("find_location", /(?:encontrar|achar|localizar).{0,30}(?:unidade|loja|endereco)|como chegar/);
  add("view_products", /(?:ver|conhecer|explorar).{0,30}(?:produtos|catalogo|cardapio|portfolio)/);
  add("contact", /(?:falar|conversar|entrar em contato).{0,30}(?:equipe|especialista|atendimento)|continuar (?:no|pelo) whatsapp/);

  return unique(keys);
}

export function visitorActionSemanticKey(action: VisitorActionSelection): VisitorActionKey {
  return action.key === "other" && action.semanticKey ? action.semanticKey : action.key;
}

export function classifyCustomVisitorAction(label: string): Exclude<VisitorActionKey, "other"> {
  const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const rules: Array<[Exclude<VisitorActionKey, "other">, RegExp]> = [
    ["view_products", /catalog|cardapio|menu|produto|portfolio|mostruario/],
    ["order", /pedido|pedir|encomenda/],
    ["buy", /comprar|compra|adquirir/],
    ["quote", /orcamento|cotacao|proposta|precificar/],
    ["schedule", /agendar|agenda|horario|marcar/],
    ["reserve", /reservar|reserva|disponibilidade/],
    ["find_location", /unidade|endereco|localizacao|loja|como chegar/],
    ["resale", /revenda|revender|atacado|distribuidor|empresa|corporativo/],
    ["recommendation", /recomend|descobrir|escolher|ideal|melhor opcao/],
    ["support", /suporte|ajuda|assistencia|problema/],
    ["contact", /falar|contato|atendimento|equipe|mensagem/],
  ];
  return rules.find(([, pattern]) => pattern.test(normalized))?.[0] || "contact";
}

export function suggestVisitorActionKeys(profile: BusinessCapabilityProfile, declaredObjective = ""): VisitorActionKey[] {
  const intents = new Set([...profile.primaryIntents, ...profile.secondaryIntents]);
  const declared = inferDeclaredVisitorActionKeys(declaredObjective);
  if (declared.length) {
    const complements: Partial<Record<VisitorActionKey, VisitorActionKey[]>> = {
      recommendation: ["contact"],
      order: ["view_products", "contact"],
      buy: ["view_products", "contact"],
      view_products: ["contact"],
      quote: ["contact"],
      schedule: ["contact"],
      reserve: ["contact"],
      find_location: ["contact"],
    };
    return unique([
      ...declared,
      ...declared.flatMap((key) => complements[key] || []),
      ...(profile.hasMultipleLocations ? ["find_location" as const] : []),
    ]).slice(0, 5);
  }
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

export function defaultVisitorActions(profile: BusinessCapabilityProfile, declaredObjective = ""): VisitorActionSelection[] {
  return suggestVisitorActionKeys(profile, declaredObjective).map((key, index) => ({
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
    .map((action) => byKey.get(visitorActionSemanticKey(action))?.intent)
    .filter((intent) => intent !== undefined) as CommercialIntent[];
  const primaryIntents = actions
    .filter((action) => action.isPrimary)
    .map((action) => byKey.get(visitorActionSemanticKey(action))?.intent)
    .filter((intent) => intent !== undefined) as CommercialIntent[];
  const selectedPrimaryIntents = unique(primaryIntents);
  const selectedSecondaryIntents = unique(intents).filter(
    (intent) => !selectedPrimaryIntents.includes(intent),
  );
  return {
    ...profile,
    primaryIntents: selectedPrimaryIntents,
    secondaryIntents: selectedSecondaryIntents,
    hasMultipleLocations:
      profile.hasMultipleLocations || actions.some((action) => visitorActionSemanticKey(action) === "find_location"),
    requiresQualification:
      profile.requiresQualification || actions.some((action) => ["recommendation", "resale"].includes(visitorActionSemanticKey(action))),
  };
}

const actionCapabilities: Partial<Record<VisitorActionKey, CapabilityKey[]>> = {
  order: ["catalog_order"],
  buy: ["catalog_order"],
  view_products: ["catalog_order"],
  quote: ["quote"],
  schedule: ["scheduling"],
  reserve: ["reservation"],
  contact: ["qualification"],
  find_location: ["routing"],
  support: ["qualification"],
  resale: ["qualification", "quote"],
  recommendation: ["qualification"],
  other: ["qualification"],
};

const directStepTypes: Record<VisitorActionKey, JourneyStep["type"][]> = {
  order: ["catalog", "cart"],
  buy: ["catalog", "cart"],
  view_products: ["catalog"],
  quote: ["quote"],
  schedule: ["schedule"],
  reserve: ["reservation", "availability"],
  contact: ["form", "action"],
  find_location: ["routing"],
  support: ["form", "action"],
  resale: ["form", "quote"],
  recommendation: ["recommendation", "form"],
  other: ["form", "action"],
};

const destinationLabels: Record<VisitorActionKey, string> = {
  order: "Pedido",
  buy: "Compra",
  view_products: "Catálogo",
  quote: "Orçamento",
  schedule: "Agendamento",
  reserve: "Reserva",
  contact: "Atendimento",
  support: "Atendimento",
  find_location: "Unidade",
  resale: "Atendimento comercial",
  recommendation: "Recomendação",
  other: "Próximo passo",
};

function optionHasRealDestination(option: NonNullable<JourneyStep["options"]>[number]) {
  if (option.actionType === "submit_form" || option.actionType === "finish") return true;
  if (option.actionType === "open_whatsapp") return Boolean(option.actionPayload?.phone);
  if (option.actionType === "open_url") return /^https?:\/\//i.test(String(option.actionPayload?.url || ""));
  return false;
}

function directStepSupportsVisitorAction(step: JourneyStep, key: VisitorActionKey) {
  if (!step.isActive || step.type === "choice" || !directStepTypes[key].includes(step.type)) return false;
  const capabilities = actionCapabilities[key] || [];
  const hasCapability = step.options?.some((option) =>
    capabilities.includes(option.actionPayload?.capability as CapabilityKey),
  );
  if (step.type === "action") {
    return Boolean(hasCapability || step.options?.some(optionHasRealDestination));
  }
  if (step.type === "form" && ["quote", "resale", "recommendation"].includes(key)) {
    return Boolean(hasCapability);
  }
  return true;
}

function optionSupportsVisitorAction(
  project: Project,
  option: NonNullable<JourneyStep["options"]>[number],
  key: VisitorActionKey,
) {
  const capabilities = actionCapabilities[key] || [];
  if (capabilities.includes(option.actionPayload?.capability as CapabilityKey)) return true;
  const linkedGoal = project.conversionGoals?.find((goal) => goal.id === option.conversionGoalId);
  const definition = byKey.get(key);
  const linkedTarget = linkedGoal
    ? project.steps.find((step) => step.id === linkedGoal.targetStepId && step.isActive)
    : undefined;
  if (
    linkedGoal &&
    definition &&
    linkedGoal.kind === definition.kind &&
    linkedTarget &&
    directStepSupportsVisitorAction(linkedTarget, key)
  ) return true;
  if (["contact", "support", "other"].includes(key) && optionHasRealDestination(option)) return true;
  const target = option.targetStepId
    ? project.steps.find((step) => step.id === option.targetStepId && step.isActive)
    : undefined;
  return Boolean(
    target &&
    directStepSupportsVisitorAction(target, key),
  );
}

export function stepSupportsVisitorAction(
  project: Project,
  step: JourneyStep,
  key: VisitorActionKey,
) {
  if (!step.isActive) return false;
  if (step.type === "choice") {
    return Boolean(step.options?.some((option) => optionSupportsVisitorAction(project, option, key)));
  }
  return directStepSupportsVisitorAction(step, key);
}

export function targetStepForAction(project: Project, key: VisitorActionKey) {
  return project.steps
    .filter((step) => step.isActive)
    .find((step) => stepSupportsVisitorAction(project, step, key));
}

function scaffoldStep(project: Project, action: VisitorActionSelection, order: number): JourneyStep {
  const semanticKey = visitorActionSemanticKey(action);
  const definition = byKey.get(semanticKey)!;
  const capability = actionCapabilities[semanticKey]?.[0];
  const type: JourneyStep["type"] = semanticKey === "order" || semanticKey === "buy" || semanticKey === "view_products"
    ? "catalog"
    : semanticKey === "quote"
      ? "quote"
      : semanticKey === "schedule"
        ? "schedule"
        : semanticKey === "reserve"
          ? "reservation"
          : semanticKey === "find_location"
            ? "routing"
            : semanticKey === "recommendation"
              ? "recommendation"
              : "form";
  const blockType = capability === "catalog_order"
    ? "catalog_item_cards"
    : capability === "quote"
      ? "quote_summary"
      : capability === "scheduling"
        ? "schedule_slots"
        : capability === "reservation"
          ? "reservable_unit_cards"
          : capability === "routing"
            ? "location_selector"
            : "form";
  return {
    id: `${project.id}-step-${action.key}`,
    type,
    title: action.label,
    description: definition.description,
    order,
    isActive: true,
    blocks: [{
      id: `${project.id}-block-${action.key}`,
      type: blockType,
      content: { emptyState: "Complete as informações pendentes para disponibilizar esta ação." },
      style: { incomplete: true },
    }],
    options: [{
      id: `${project.id}-option-${action.key}`,
      label: type === "form" || type === "quote" ? "Enviar" : "Continuar",
      value: action.key,
      actionType: capability ? "start_capability" : "submit_form",
      actionPayload: capability ? { capability } : undefined,
    }],
  };
}

export function ensureVisitorActionTargets(
  project: Project,
  selectedActions: VisitorActionSelection[],
): Project {
  const steps = [...project.steps];
  const capabilities = [...(project.capabilities || [])];
  for (const action of selectedActions) {
    const semanticKey = visitorActionSemanticKey(action);
    if (!targetStepForAction({ ...project, steps }, semanticKey)) {
      steps.push(scaffoldStep(project, action, steps.length));
    }
    for (const capabilityKey of actionCapabilities[semanticKey] || []) {
      if (!capabilities.some((capability) => capability.key === capabilityKey)) {
        capabilities.push(createCapability(capabilityKey));
      }
    }
  }
  const existingRequirements = new Map((project.dataRequirements || []).map((item) => [item.key, item]));
  const required = draftCapabilityRequirements(capabilities).map((item) => existingRequirements.get(item.key) || item);
  const requiredKeys = new Set(required.map((item) => item.key));
  return {
    ...project,
    steps: steps.map((step, order) => ({ ...step, order })),
    capabilities,
    dataRequirements: [
      ...required,
      ...(project.dataRequirements || []).filter((item) => !requiredKeys.has(item.key)),
    ],
  };
}

function destinationForTarget(project: Project, target: JourneyStep): RoutingDestination | undefined {
  const destinationId = target.options
    ?.map((option) => option.actionPayload?.destinationId)
    .find((value): value is string => typeof value === "string" && Boolean(value));
  if (destinationId) {
    return project.commercialConfig?.routingDestinations?.find((item) => item.id === destinationId);
  }
  if (target.type === "routing") {
    const candidates = (project.commercialConfig?.routingDestinations || []).filter((item) => item.type !== "unavailable");
    return candidates.length === 1 ? candidates[0] : undefined;
  }
  return undefined;
}

export function resolveVisitorActionDestination(
  project: Project,
  action: VisitorActionSelection,
  targetStep: JourneyStep,
) {
  return destinationForTarget(project, targetStep)?.label || destinationLabels[visitorActionSemanticKey(action)];
}

export function applyVisitorActionsToProject(project: Project, session: Pick<AISetupSession, "visitorActions">): Project {
  const selected = session.visitorActions || [];
  if (!selected.length) return project;
  const prepared = ensureVisitorActionTargets(project, selected);
  const goals: ConversionGoal[] = selected.flatMap((action, order) => {
    const semanticKey = visitorActionSemanticKey(action);
    const target = targetStepForAction(prepared, semanticKey);
    const definition = byKey.get(semanticKey);
    if (!target || !definition) return [];
    return [{
      id: `${project.id}-goal-${action.key}`,
      projectId: project.id,
      name: action.label,
      description: definition.description,
      kind: definition.kind,
      targetStepId: target.id,
      destinationLabel: resolveVisitorActionDestination(prepared, action, target),
      isPrimary: action.isPrimary,
      isActive: true,
      order,
    } satisfies ConversionGoal];
  });
  const primary = goals.find((goal) => goal.isPrimary) || goals[0];
  return {
    ...prepared,
    primaryGoal: primary?.name || prepared.primaryGoal,
    conversionGoals: goals.length ? goals : prepared.conversionGoals,
  };
}

export function visitorActionDefinition(key: VisitorActionKey) {
  return byKey.get(key);
}
