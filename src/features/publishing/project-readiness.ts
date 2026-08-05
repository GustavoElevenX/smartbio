import { evaluateCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import type { CapabilityKey, DataRequirement, Project } from "@/types";

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
  if (typeof value !== "string") return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isPhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(digits);
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

export function getProjectReadiness(project: Project): ProjectReadinessResult {
  const issues: DataRequirement[] = [];
  const dataPath = `/app/projects/${project.id}/data`;
  if (!project.workspaceId) {
    issues.push(requirement(project, "project.workspace", "Workspace inválido", "O projeto precisa pertencer a um workspace válido."));
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
  if (project.phone && !isPhone(project.phone)) {
    issues.push(requirement(project, "project.phone", "Telefone inválido", "Revise o telefone principal do projeto."));
  }

  const stepIds = new Set(project.steps.map((step) => step.id));
  for (const step of project.steps.filter((item) => item.isActive)) {
    for (const option of step.options || []) {
      if (!option.actionType) {
        issues.push(requirement(project, `step.${step.id}.cta`, "CTA sem destino", `O CTA “${option.label}” não possui ação.`));
      }
      if (
        option.actionType === "go_to_step" &&
        (!option.targetStepId || !stepIds.has(option.targetStepId))
      ) {
        issues.push(requirement(project, `step.${step.id}.target.${option.id}`, "Referência quebrada", `O CTA “${option.label}” aponta para uma etapa inexistente.`));
      }
      if (option.actionType === "start_capability" && !option.actionPayload?.capability) {
        issues.push(requirement(project, `step.${step.id}.capability.${option.id}`, "CTA sem capacidade", `O CTA “${option.label}” não informa qual fluxo deve iniciar.`));
      }
      if (option.actionType === "open_url" && !isHttpUrl(option.actionPayload?.url)) {
        issues.push(requirement(project, `step.${step.id}.url.${option.id}`, "URL inválida", `O CTA “${option.label}” precisa de uma URL HTTP ou HTTPS válida.`));
      }
      if (option.actionType === "open_whatsapp" && !isPhone(option.actionPayload?.phone)) {
        issues.push(requirement(project, `step.${step.id}.phone.${option.id}`, "Telefone inválido", `O CTA “${option.label}” precisa de um telefone real.`));
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
    if (!service.destinationId && !service.externalUrl) {
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
  if (geoRoutingEnabled && hasCapability(project, "routing")) {
    for (const location of config?.locations?.filter((item) => item.isActive) || []) {
      if (
        location.latitude == null ||
        location.longitude == null ||
        !["resolved", "manual"].includes(location.geocodingStatus)
      ) {
        issues.push(requirement(project, `routing.location.${location.id}.geocode`, "Unidade sem geocodificação", `Geocodifique “${location.name}” ou informe coordenadas revisadas.`, `${dataPath}?tab=locations`, "blocking", "routing"));
      }
    }
  }

  walk(project, (value, path) => {
    if (
      typeof value === "string" &&
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
  const unique = [...new Map(all.map((item) => [item.key, item])).values()];
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
