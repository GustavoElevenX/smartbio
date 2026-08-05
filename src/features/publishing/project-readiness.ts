import { evaluateCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import type { DataRequirement, Project } from "@/types";

export interface ProjectReadinessResult {
  score: number;
  publishable: boolean;
  blocking: DataRequirement[];
  warnings: DataRequirement[];
  optional: DataRequirement[];
}

const knownDemoValues = [
  "5511999999999", "example.com", "atendimento inicial", "especialista disponível", "opção essencial",
  "opção completa", "unidade disponível", "unidade centro", "unidade zona sul",
];

function requirement(project: Project, key: string, label: string, reason: string, severity: DataRequirement["severity"] = "blocking"): DataRequirement {
  return { id: `${project.id}:${key}`, key, label, capability: "project", status: "invalid", severity, reason, actionLabel: "Corrigir", actionPath: `/app/projects/${project.id}/editor` };
}

function isHttpUrl(value: unknown) {
  if (typeof value !== "string") return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

function walk(value: unknown, visit: (value: unknown, path: string) => void, path = "project") {
  visit(value, path);
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, visit, `${path}.${index}`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => walk(item, visit, `${path}.${key}`));
}

export function getProjectReadiness(project: Project): ProjectReadinessResult {
  const issues: DataRequirement[] = [];
  if (!project.name.trim()) issues.push(requirement(project, "project.name", "Nome do projeto", "Informe o nome do negócio."));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) issues.push(requirement(project, "project.slug", "URL do projeto", "Use um slug válido com letras minúsculas, números e hífens."));
  if (!project.steps.length) issues.push(requirement(project, "project.journey", "Jornada", "Adicione ao menos uma etapa."));

  const stepIds = new Set(project.steps.map((step) => step.id));
  for (const step of project.steps) {
    for (const option of step.options || []) {
      if (!option.actionType) issues.push(requirement(project, `step.${step.id}.cta`, "CTA sem ação", `O CTA “${option.label}” não possui ação.`));
      if (option.actionType === "go_to_step" && (!option.targetStepId || !stepIds.has(option.targetStepId))) issues.push(requirement(project, `step.${step.id}.target.${option.id}`, "Referência quebrada", `O CTA “${option.label}” aponta para uma etapa inexistente.`));
      if (option.actionType === "open_url" && !isHttpUrl(option.actionPayload?.url)) issues.push(requirement(project, `step.${step.id}.url.${option.id}`, "URL inválida", `O CTA “${option.label}” precisa de uma URL HTTP ou HTTPS válida.`));
      if (option.actionType === "open_whatsapp" && !/^\+?[1-9]\d{7,14}$/.test(String(option.actionPayload?.phone || "").replace(/\D/g, ""))) issues.push(requirement(project, `step.${step.id}.phone.${option.id}`, "Telefone inválido", `O CTA “${option.label}” precisa de um telefone real.`));
    }
  }

  walk(project, (value, path) => {
    if (typeof value === "string" && knownDemoValues.some((demo) => value.toLocaleLowerCase("pt-BR").includes(demo))) issues.push(requirement(project, `demo.${path}`, "Dado de demonstração", `Remova o valor fictício encontrado em ${path}.`));
    if (value && typeof value === "object" && "generatedPlaceholder" in value && (value as { generatedPlaceholder?: unknown }).generatedPlaceholder === true) issues.push(requirement(project, `placeholder.${path}`, "Placeholder gerado", `Confirme ou substitua o conteúdo incompleto em ${path}.`));
  });

  const all = [...(project.dataRequirements || []), ...evaluateCapabilityRequirements(project), ...issues];
  const unique = [...new Map(all.map((item) => [item.key, item])).values()];
  const unresolved = unique.filter((item) => item.status !== "verified");
  const blocking = unresolved.filter((item) => item.severity === "blocking");
  const warnings = unresolved.filter((item) => item.severity === "warning");
  const optional = unresolved.filter((item) => item.severity === "optional");
  const resolvedCount = unique.length - unresolved.length;
  const score = unique.length ? Math.round((resolvedCount / unique.length) * 100) : project.steps.length ? 100 : 0;
  return { score, publishable: blocking.length === 0, blocking, warnings, optional };
}

export function assertProjectPublishable(project: Project) {
  const result = getProjectReadiness(project);
  if (!result.publishable) {
    const error = new Error(`Projeto incompleto: ${result.blocking.map((item) => item.label).join(", ")}.`);
    Object.assign(error, { code: "project_not_publishable", readiness: result });
    throw error;
  }
  return result;
}
