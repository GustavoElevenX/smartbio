import { evaluateCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import { unsupportedCapabilityReferences } from "@/features/capabilities/capability-provenance";
import type { CapabilityKey, DataRequirement, Project } from "@/types";
import { formFieldIssues } from "@/features/forms/form-field-utils";
import { validateConversionPath } from "@/features/publishing/conversion-path-validator";
import { isValidWhatsAppPhone, projectHasUsableWhatsApp, whatsappActionHasUsableDestination } from "@/features/whatsapp/whatsapp-destination";
import { isExternalUrl } from "@/lib/external-url";
import { projectPublication } from "@/features/publishing/publication-target";

export interface ProjectReadinessResult {
  score: number;
  publishable: boolean;
  blocking: DataRequirement[];
  warnings: DataRequirement[];
  optional: DataRequirement[];
}

const knownDemoValues = [
  "5511999999999",
  "example.com",
  "atendimento inicial",
  "especialista disponível",
  "opção essencial",
  "opção completa",
  "unidade disponível",
  "unidade centro",
  "unidade zona sul",
  "edite este texto",
  "primeira opção",
  "benefício principal",
  "nova etapa",
];

function requirement(
  project: Project,
  key: string,
  label: string,
  reason: string,
  actionPath = `/app/projects/${project.id}/editor`,
  severity: DataRequirement["severity"] = "blocking",
  capability: CapabilityKey | "project" = "project",
): DataRequirement {
  return {
    id: `${project.id}:${key}`,
    key,
    label,
    capability,
    status: "invalid",
    severity,
    reason,
    actionLabel: "Corrigir",
    actionPath,
  };
}

function isHttpUrl(value: unknown) {
  return isExternalUrl(value);
}

function walk(
  value: unknown,
  visit: (value: unknown, path: string) => void,
  path = "project",
) {
  visit(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${path}.${index}`));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) =>
      walk(item, visit, `${path}.${key}`),
    );
  }
}

function hasCapability(project: Project, key: CapabilityKey) {
  return Boolean(project.capabilities?.some((item) => item.key === key && item.enabled));
}

function normalizedRequirementKey(item: DataRequirement) {
  const key = item.key.toLocaleLowerCase("pt-BR");
  if (key.includes("whatsapp") || key.includes(".phone") || key === "project.phone") return "contact.whatsapp";
  return item.key;
}

export function getProjectReadiness(project: Project): ProjectReadinessResult {
  const issues: DataRequirement[] = [];
  const dataPath = `/app/projects/${project.id}/data`;
  if (!project.workspaceId) {
    issues.push(requirement(project, "project.workspace", "Espaço de trabalho inválido", "O negócio precisa pertencer a um espaço de trabalho válido."));
  }
  if (!project.name.trim()) {
    issues.push(requirement(project, "project.name", "Nome do projeto", "Informe o nome do negócio."));
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) {
    issues.push(requirement(project, "project.slug", "URL do projeto", "Use letras minúsculas, números e hífens."));
  }
  if (!project.steps.some((step) => step.isActive)) {
    issues.push(requirement(project, "project.journey", "Jornada vazia", "Adicione ao menos uma etapa ativa."));
  }
  if (project.phone && !isValidWhatsAppPhone(project.phone)) {
    issues.push(requirement(project, "project.phone", "Telefone inválido", "Revise o telefone principal do projeto."));
  }
  const publication = projectPublication(project);
  if (publication.homeMode === "goal") {
    const goal = project.conversionGoals?.find((item) => item.isActive && item.id === publication.conversionGoalId);
    const target = goal ? project.steps.find((step) => step.isActive && step.id === goal.targetStepId) : undefined;
    if (!goal || !target) {
      issues.push(requirement(project, "publication.goal", "Início da experiência inválido", "Escolha uma meta ativa que possua uma etapa inicial disponível."));
    }
  }
  if (publication.homeMode === "step") {
    const step = project.steps.find((item) => item.isActive && item.id === publication.initialStepId);
    if (!step) {
      issues.push(requirement(project, "publication.step", "Página inicial inválida", "Escolha uma etapa ativa para abrir no link principal.", `/app/projects/${project.id}/editor`));
    }
  }

  const stepIds = new Set(project.steps.map((step) => step.id));
  for (const step of project.steps.filter((item) => item.isActive)) {
    for (const field of step.formFields || []) {
      const fieldIssue = formFieldIssues(field, step.formFields || [field])[0];
      if (fieldIssue) issues.push(requirement(project, `step.${step.id}.field.${field.id}`, "Campo de formulário inválido", `${field.label || "Campo sem rótulo"}: ${fieldIssue}`));
    }
    for (const option of step.options || []) {
      if (!option.actionType) {
        issues.push(requirement(project, `step.${step.id}.cta`, "Botão sem destino", `O botão “${option.label}” não possui ação.`));
      }
      if (
        option.actionType === "go_to_step" &&
        (!option.targetStepId || !stepIds.has(option.targetStepId))
      ) {
        issues.push(requirement(project, `step.${step.id}.target.${option.id}`, "Referência quebrada", `O botão “${option.label}” aponta para uma etapa inexistente.`));
      }
      if (option.actionType === "start_capability" && !option.actionPayload?.capability) {
        issues.push(requirement(project, `step.${step.id}.capability.${option.id}`, "Botão sem capacidade", `O botão “${option.label}” não informa qual fluxo deve iniciar.`));
      }
      if (option.actionType === "open_url" && !isHttpUrl(option.actionPayload?.url)) {
        issues.push(requirement(project, `step.${step.id}.url.${option.id}`, "Endereço inválido", `O botão “${option.label}” precisa de um endereço HTTP ou HTTPS válido.`));
      }
      if (option.actionType === "open_whatsapp" && !whatsappActionHasUsableDestination(project, option)) {
        issues.push(requirement(project, `step.${step.id}.phone.${option.id}`, "WhatsApp sem destino", `O botão “${option.label}” precisa de um número principal ou de um número válido para cada unidade usada nessa jornada.`));
      }
    }
  }

  const config = project.commercialConfig;
  for (const item of config?.catalogItems?.filter((candidate) => candidate.isAvailable) || []) {
    const priceMode = String(item.metadata?.priceMode || "fixed");
    if (priceMode !== "manual" && item.price == null) {
      issues.push(requirement(project, `catalog.item.${item.id}.price`, "Produto sem preço", `Informe o preço de “${item.name}” ou marque o preço como manual.`, `${dataPath}?tab=catalog`, "blocking", "catalog_order"));
    }
  }
  for (const service of config?.serviceOfferings?.filter((item) => item.isActive) || []) {
    const blueprintId = typeof service.settings?.blueprintId === "string" ? service.settings.blueprintId : undefined;
    const hasJourneyDestination = Boolean(blueprintId && project.conversionGoals?.some((goal) => {
      const target = project.steps.find((step) => step.id === goal.targetStepId);
      return goal.isActive && target?.settings?.blueprintId === blueprintId;
    }));
    if (!service.destinationId && !service.externalUrl && !hasJourneyDestination) {
      issues.push(requirement(project, `service.${service.id}.destination`, "Serviço sem destino", `Defina como o visitante continua após escolher “${service.name}”.`, `${dataPath}?tab=services`, "blocking", "project"));
    }
    if (service.externalUrl && !isHttpUrl(service.externalUrl)) {
      issues.push(requirement(project, `service.${service.id}.url`, "URL de serviço inválida", `Revise a URL de “${service.name}”.`, `${dataPath}?tab=services`));
    }
  }
  if (hasCapability(project, "quote")) {
    const quote = config?.quoteDefinition;
    if (!quote?.questions.length) {
      issues.push(requirement(project, "quote.questions", "Orçamento sem perguntas", "Adicione as perguntas que definem a solicitação.", `${dataPath}?tab=quotes`, "blocking", "quote"));
    }
    if (!quote?.completionChannel) {
      issues.push(requirement(project, "quote.destination", "Orçamento sem destino", "Defina como o orçamento será concluído.", `${dataPath}?tab=quotes`, "blocking", "quote"));
    }
  }
  if (hasCapability(project, "scheduling") && !config?.availabilityRules?.length) {
    issues.push(requirement(project, "scheduling.availability", "Agenda sem disponibilidade", "Cadastre ao menos uma regra de horário.", `${dataPath}?tab=scheduling`, "blocking", "scheduling"));
  }
  if (hasCapability(project, "reservation")) {
    for (const unit of config?.reservableUnits?.filter((item) => item.isActive) || []) {
      if (unit.quantity < 1 || unit.capacityAdults < 1) {
        issues.push(requirement(project, `reservation.unit.${unit.id}.capacity`, "Reserva sem capacidade", `Revise a quantidade e capacidade de “${unit.name}”.`, `${dataPath}?tab=reservations`, "blocking", "reservation"));
      }
    }
  }
  const geoRoutingEnabled = process.env.NEXT_PUBLIC_FEATURE_GEO_ROUTING === "true";
  const activeLocations = config?.locations?.filter((item) => item.isActive) || [];
  const usesGeoRouting = activeLocations.some((location) => location.latitude != null && location.longitude != null);
  if (geoRoutingEnabled && hasCapability(project, "routing") && usesGeoRouting) {
    for (const location of activeLocations) {
      if (
        location.latitude == null ||
        location.longitude == null ||
        !["resolved", "manual"].includes(location.geocodingStatus)
      ) {
        issues.push(requirement(project, `routing.location.${location.id}.geocode`, "Unidade sem geocodificação", `Geocodifique “${location.name}” ou informe coordenadas revisadas.`, `${dataPath}?tab=locations`, "blocking", "routing"));
      }
    }
  }

  const conversionPath = validateConversionPath(project);
  for (const check of conversionPath.checks.filter((item) => !item.valid)) {
    issues.push(requirement(
      project,
      `conversion-path.${conversionPath.kind}.${check.key}`,
      check.label,
      check.reason,
      `/app/projects/${project.id}/editor`,
    ));
  }

  for (const unsupported of unsupportedCapabilityReferences(project)) {
    issues.push(requirement(
      project,
      `capability.provenance.${unsupported.key}.${unsupported.source}`,
      "Navegação sem origem confirmada",
      `“${unsupported.label}” sugere uma capacidade que não foi informada nem confirmada para este negócio.`,
      `/app/projects/${project.id}/site`,
    ));
  }

  walk(project, (value, path) => {
    const internalIntelligenceValue =
      path.includes(".discoveryPlan.") ||
      path.includes(".settings.offerIntelligence.");
    if (
      typeof value === "string" &&
      !internalIntelligenceValue &&
      knownDemoValues.some((demo) => value.toLocaleLowerCase("pt-BR").includes(demo))
    ) {
      issues.push(requirement(project, `demo.${path}`, "Dado de demonstração", `Remova o valor fictício encontrado em ${path}.`));
    }
    if (
      value &&
      typeof value === "object" &&
      "generatedPlaceholder" in value &&
      (value as { generatedPlaceholder?: unknown }).generatedPlaceholder === true
    ) {
      issues.push(requirement(project, `placeholder.${path}`, "Placeholder gerado", `Confirme ou substitua o conteúdo incompleto em ${path}.`));
    }
  });

  const all = [
    ...(project.dataRequirements || []),
    ...evaluateCapabilityRequirements(project),
    ...issues,
  ];
  const whatsappReady = projectHasUsableWhatsApp(project);
  const unique = [...new Map(all.map((item) => {
    const key = normalizedRequirementKey(item);
    const normalized = key === item.key ? item : { ...item, id: `${project.id}:${key}`, key };
    return [key, key === "contact.whatsapp" && whatsappReady ? {
      ...normalized,
      status: "verified" as const,
      reason: "O atendimento por WhatsApp possui um destino válido.",
      actionLabel: undefined,
      actionPath: undefined,
    } : normalized];
  })).values()];
  const unresolved = unique.filter((item) => item.status !== "verified");
  const blocking = unresolved.filter((item) => item.severity === "blocking");
  const warnings = unresolved.filter((item) => item.severity === "warning");
  const optional = unresolved.filter((item) => item.severity === "optional");
  const resolvedCount = unique.length - unresolved.length;
  const score = unique.length
    ? Math.round((resolvedCount / unique.length) * 100)
    : project.steps.length
      ? 100
      : 0;
  return {
    score,
    publishable: blocking.length === 0,
    blocking,
    warnings,
    optional,
  };
}

export function assertProjectPublishable(project: Project) {
  const result = getProjectReadiness(project);
  if (!result.publishable) {
    const error = new Error(
      `Projeto incompleto: ${result.blocking.map((item) => item.label).join(", ")}.`,
    );
    Object.assign(error, { code: "project_not_publishable", readiness: result });
    throw error;
  }
  return result;
}
