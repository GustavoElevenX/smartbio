import { getSectionActions } from "@/features/presence/presence-page-utils";
import type { Project } from "@/types";

interface CommercialConcept {
  key: string;
  pattern: RegExp;
  supported(project: Project, grounding: string): boolean;
}

function hasCapability(project: Project, key: string) {
  return Boolean(project.capabilities?.some((capability) => capability.enabled && capability.key === key));
}

function groundingText(project: Project) {
  return [
    project.description,
    project.category,
    project.primaryGoal,
    ...(project.conversionGoals || []).flatMap((goal) => [goal.name, goal.description]),
    ...(project.commercialConfig?.serviceOfferings || []).flatMap((offer) => [offer.name, offer.description, offer.shortDescription]),
    ...(project.businessProfile?.businessRules || []),
  ].filter(Boolean).join(" ");
}

const concepts: CommercialConcept[] = [
  { key: "resale", pattern: /\b(?:revenda|revendedor|revender|atacado|distribuidor)\b/i, supported: (_project, grounding) => /\b(?:revenda|revendedor|revender|atacado|distribuidor)\b/i.test(grounding) },
  { key: "franchise", pattern: /\b(?:franquia|franqueado)\b/i, supported: (_project, grounding) => /\b(?:franquia|franqueado)\b/i.test(grounding) },
  { key: "delivery", pattern: /\b(?:delivery|entrega)\b/i, supported: (project, grounding) => /\b(?:delivery|entrega)\b/i.test(grounding) || Boolean(project.businessProfile?.primaryIntents.includes("order")) },
  { key: "scheduling", pattern: /\b(?:agenda|agendamento|agendar|horário)\b/i, supported: (project, grounding) => hasCapability(project, "scheduling") || Boolean(project.commercialConfig?.schedulableServices?.length) || /\b(?:agenda|agendamento|agendar|horário)\b/i.test(grounding) },
  { key: "catalog", pattern: /\b(?:catálogo|loja|ecommerce|e-commerce)\b/i, supported: (project, grounding) => hasCapability(project, "catalog_order") || Boolean(project.commercialConfig?.catalogItems?.length) || /\b(?:catálogo|loja|ecommerce|e-commerce)\b/i.test(grounding) },
  { key: "locations", pattern: /\b(?:unidade|unidades|filial|filiais)\b/i, supported: (project, grounding) => hasCapability(project, "routing") || Boolean(project.commercialConfig?.locations?.length) || /\b(?:unidade|unidades|filial|filiais)\b/i.test(grounding) },
];

export interface UnsupportedCapabilityReference {
  key: string;
  label: string;
  source: string;
}

export function unsupportedCapabilityReferences(project: Project) {
  const grounding = groundingText(project);
  const references = [
    ...project.steps.flatMap((step) => [
      { source: `step.${step.id}`, value: step.title },
      ...(step.options || []).map((option) => ({ source: `step.${step.id}.option.${option.id}`, value: option.label })),
    ]),
    ...(project.presence?.pages || []).flatMap((page) => [
      { source: `presence.page.${page.id}`, value: `${page.name} ${page.path}` },
      ...page.sections.flatMap((section) => [
        { source: `presence.section.${section.id}`, value: `${section.title || ""} ${section.description || ""}` },
        ...getSectionActions(section).map((action) => ({ source: `presence.section.${section.id}.action`, value: action.label })),
      ]),
    ]),
  ];
  const issues: UnsupportedCapabilityReference[] = [];
  for (const reference of references) {
    for (const concept of concepts) {
      if (concept.pattern.test(reference.value) && !concept.supported(project, grounding)) {
        issues.push({ key: concept.key, label: reference.value.trim(), source: reference.source });
      }
    }
  }
  return [...new Map(issues.map((issue) => [`${issue.key}:${issue.source}`, issue])).values()];
}
