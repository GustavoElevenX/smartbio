import type { CommercialArchitecture } from "@/features/ai-setup/ai-setup.schema";
import { validateCommercialArchitectureForMaterialization } from "@/features/ai-setup/architecture-resolution";
import { classifyCustomVisitorAction, visitorActionDefinition } from "@/features/ai-setup/visitor-actions";
import { assignProjectToCommercialConfig, journeyComposer } from "@/features/composition/journey-composer";
import { resolveCompletionDestination, semanticJourneyRouteKey } from "@/features/routing/completion-destination";
import { uid } from "@/lib/utils";
import type { BusinessCapabilityProfile, ConversionGoal, ExperienceCompositionInput, Project, ProjectCapability } from "@/types";

export interface ArchitectureRuntimeIssue {
  code: string;
  message: string;
  blueprintId?: string;
}

function goalsFromArchitecture(project: Project, architecture: CommercialArchitecture): ConversionGoal[] {
  const visibleIntentIds = architecture.intents
    .filter((intent) => intent.visibleOnEntry)
    .sort((left, right) => right.priority - left.priority)
    .map((intent) => intent.id);
  return architecture.journeyBlueprints.flatMap((blueprint) => {
    const intent = architecture.intents.find((item) => item.id === blueprint.intentId && item.visibleOnEntry);
    if (!intent) return [];
    const journeySteps = project.steps.filter((step) => step.isActive && step.settings?.blueprintId === blueprint.id);
    const target = blueprint.mode.startsWith("direct_")
      ? journeySteps.find((step) => step.type === "action")
      : journeySteps[0];
    if (!target) return [];
    const semanticKey = intent.semanticKey && intent.semanticKey !== "other" ? intent.semanticKey : classifyCustomVisitorAction(intent.label);
    const definition = visitorActionDefinition(semanticKey);
    const destination = resolveCompletionDestination({ architecture, blueprint });
    const order = visibleIntentIds.indexOf(intent.id);
    return [{
      id: uid("goal"),
      projectId: project.id,
      name: intent.label,
      description: intent.visitorNeed,
      kind: definition?.kind || "custom",
      targetStepId: target.id,
      destinationLabel: destination.status === "resolved" ? destination.channel.label : blueprint.completion.destinationStrategy === "native" ? "Concluir na Sobe" : "Atendimento por unidade",
      isPrimary: order === 0,
      isActive: true,
      order,
    } satisfies ConversionGoal];
  }).sort((left, right) => left.order - right.order);
}

export function reconcileProjectWithCommercialArchitecture(input: {
  project: Project;
  architecture: CommercialArchitecture;
  compositionInput: ExperienceCompositionInput;
  profile: BusinessCapabilityProfile;
  capabilities: ProjectCapability[];
}) {
  const { project, architecture } = input;
  const deterministic = journeyComposer.compose(input.compositionInput, input.profile, input.capabilities, architecture);
  const architectureConfig = assignProjectToCommercialConfig(deterministic.commercialConfig, project.id);
  const nativeScheduling = input.capabilities.some((item) => item.enabled && item.key === "scheduling");
  const nativeReservation = input.capabilities.some((item) => item.enabled && item.key === "reservation");
  const reconciled: Project = {
    ...project,
    description: architecture.businessSummary.whatItSells,
    subtitle: architecture.businessSummary.commercialModel,
    steps: deterministic.steps,
    capabilities: input.capabilities,
    commercialConfig: {
      ...(project.commercialConfig || {}),
      serviceOfferings: architectureConfig.serviceOfferings ?? project.commercialConfig?.serviceOfferings,
      catalogCategories: architectureConfig.catalogCategories,
      catalogItems: architectureConfig.catalogItems,
      locations: architectureConfig.locations,
      routingDestinations: architectureConfig.routingDestinations,
      routingRules: architectureConfig.routingRules,
      schedulableServices: nativeScheduling ? project.commercialConfig?.schedulableServices : undefined,
      resources: nativeScheduling ? project.commercialConfig?.resources : undefined,
      reservableUnits: nativeReservation ? project.commercialConfig?.reservableUnits : undefined,
      reservationBlocks: nativeReservation ? project.commercialConfig?.reservationBlocks : undefined,
      availabilityRules: nativeScheduling || nativeReservation ? project.commercialConfig?.availabilityRules : undefined,
      availabilityExceptions: nativeScheduling || nativeReservation ? project.commercialConfig?.availabilityExceptions : undefined,
    },
  };
  const conversionGoals = goalsFromArchitecture(reconciled, architecture);
  return {
    ...reconciled,
    primaryGoal: conversionGoals.find((goal) => goal.isPrimary)?.name || reconciled.primaryGoal,
    conversionGoals,
  };
}

export function validateArchitectureRuntimeContract(architecture: CommercialArchitecture, project: Project) {
  const issues: ArchitectureRuntimeIssue[] = validateCommercialArchitectureForMaterialization(architecture, project.commercialConfig).issues;
  const goals = project.conversionGoals || [];
  for (const intent of architecture.intents.filter((item) => item.visibleOnEntry)) {
    const blueprint = architecture.journeyBlueprints.find((item) => item.intentId === intent.id);
    if (!blueprint) continue;
    const journeySteps = project.steps.filter((step) => step.settings?.blueprintId === blueprint.id);
    if (!journeySteps.length) {
      issues.push({ code: "blueprint_not_materialized", blueprintId: blueprint.id, message: `A jornada “${intent.label}” não foi materializada.` });
      continue;
    }
    if (!goals.some((goal) => goal.isActive && journeySteps.some((step) => step.id === goal.targetStepId))) {
      issues.push({ code: "intent_without_goal", blueprintId: blueprint.id, message: `A ação “${intent.label}” não possui uma entrada direta para sua jornada.` });
    }
    const materializedLabels = new Set(journeySteps.flatMap((step) => step.formFields || []).map((field) => field.label.trim().toLocaleLowerCase("pt-BR")));
    for (const label of blueprint.steps.flatMap((step) => step.collects)) {
      const handledByLocationSelector = blueprint.completion.destinationStrategy === "by_location"
        && /unidade|local|loja|filial|cidade|bairro/i.test(label.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
        && journeySteps.some((step) => step.type === "routing" && step.blocks?.some((block) => block.type === "location_selector"));
      if (!handledByLocationSelector && !materializedLabels.has(label.trim().toLocaleLowerCase("pt-BR"))) issues.push({ code: "missing_declared_field", blueprintId: blueprint.id, message: `A jornada “${intent.label}” perdeu o campo confirmado “${label}”.` });
    }
    if (blueprint.completion.destinationStrategy === "by_location") {
      const locationIds = [...new Set(blueprint.steps.flatMap((step) => step.usesLocations))];
      for (const locationId of locationIds.length ? locationIds : architecture.locations.map((item) => item.id)) {
        const resolution = resolveCompletionDestination({ architecture, blueprint, selectedLocationId: locationId });
        const runtimeLocation = project.commercialConfig?.locations?.find((location) => location.settings?.architectureId === locationId || location.id === locationId);
        const runtimeDestination = resolution.status === "resolved"
          ? project.commercialConfig?.routingDestinations?.find((destination) => destination.key === resolution.channel.id || destination.id === resolution.channel.id)
          : undefined;
        const routeKey = semanticJourneyRouteKey(blueprint.id, runtimeLocation?.id || locationId);
        if (resolution.status !== "resolved" || !runtimeLocation || !runtimeDestination || !project.commercialConfig?.routingRules?.some((rule) => rule.isActive && rule.condition.field === "journey_route" && rule.condition.value === routeKey && rule.destinationId === runtimeDestination.id)) {
          issues.push({ code: "route_not_materialized", blueprintId: blueprint.id, message: `A rota de “${intent.label}” para a unidade ${locationId} não foi materializada.` });
        }
      }
    }
  }
  return { valid: issues.length === 0, issues: [...new Map(issues.map((issue) => [`${issue.code}:${issue.blueprintId || issue.message}`, issue])).values()] };
}

export function assertArchitectureRuntimeContract(architecture: CommercialArchitecture, project: Project) {
  const result = validateArchitectureRuntimeContract(architecture, project);
  if (!result.valid) throw new Error(result.issues[0]?.message || "A arquitetura comercial não foi materializada com segurança.");
  return project;
}
