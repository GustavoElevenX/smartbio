import type { CommercialArchitecture } from "@/features/ai-setup/ai-setup.schema";
import { validateCommercialArchitectureForMaterialization } from "@/features/ai-setup/architecture-resolution";
import { classifyCustomVisitorAction, visitorActionDefinition } from "@/features/ai-setup/visitor-actions";
import { assignProjectToCommercialConfig, isCatalogSelectionLabel, journeyComposer } from "@/features/composition/journey-composer";
import { resolveCompletionDestination, semanticJourneyRouteKey } from "@/features/routing/completion-destination";
import { uid } from "@/lib/utils";
import type { BusinessCapabilityProfile, ConversionGoal, ExperienceCompositionInput, JourneyStep, Project, ProjectCapability } from "@/types";

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
    const target = journeySteps[0];
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
  const catalogItems = architectureConfig.catalogItems?.map((offering) => {
    const current = project.commercialConfig?.catalogItems?.find((candidate) => candidate.metadata.architectureOfferingId === offering.metadata.architectureOfferingId);
    return current ? { ...current, ...offering, id: current.id, variants: current.variants.length ? current.variants : offering.variants, imageAssetId: current.imageAssetId, imageUrl: current.imageUrl, metadata: { ...current.metadata, ...offering.metadata } } : offering;
  });
  const catalogIdAliases = new Map((architectureConfig.catalogItems || []).map((offering) => [offering.id, catalogItems?.find((item) => item.metadata.architectureOfferingId === offering.metadata.architectureOfferingId)?.id || offering.id]));
  const discoveryBlueprint = architecture.journeyBlueprints.find((blueprint) => architecture.intents.some((intent) => intent.id === blueprint.intentId && intent.semanticKey === "recommendation"));
  const serviceOfferings = architectureConfig.serviceOfferings?.map((offering) => {
    const architectureOfferingId = offering.settings.architectureOfferingId;
    const current = typeof architectureOfferingId === "string"
      ? project.commercialConfig?.serviceOfferings?.find((candidate) => candidate.settings.architectureOfferingId === architectureOfferingId)
      : undefined;
    return current ? { ...offering, id: current.id, settings: { ...current.settings, ...offering.settings } } : offering;
  });
  const discoveryForm = project.steps.find((step) => (
    step.type === "form"
    && step.settings?.discoveryPlanId === project.discoveryPlan?.id
  ));
  let steps: JourneyStep[] = deterministic.steps.map((step) => ({ ...step, blocks: step.blocks?.map((block) => block.type === "catalog_item_cards" && Array.isArray(block.content?.itemIds) ? { ...block, content: { ...block.content, itemIds: block.content.itemIds.map((id) => catalogIdAliases.get(String(id)) || id) } } : block) })).map((step) => (
    discoveryForm
    && step.type === "form"
    && !step.formFields?.length
    && step.settings?.blueprintId === discoveryForm.settings?.blueprintId
      ? { ...step, formFields: discoveryForm.formFields, settings: { ...step.settings, ...discoveryForm.settings } }
      : step
  ));
  if (discoveryBlueprint && project.discoveryPlan?.status === "ready") {
    const completion = steps.find((step) => step.type === "action" && step.settings?.blueprintId === discoveryBlueprint.id);
    const recommendation = project.steps.find((step) => step.type === "recommendation");
    if (completion && recommendation) {
      const entry = steps.find((step) => step.settings?.blueprintId === discoveryBlueprint.id);
      steps = steps.map((step) => step.settings?.blueprintId === discoveryBlueprint.id && step.id !== completion.id ? {
        ...step,
        settings: { ...step.settings, journeyMode: "assisted_discovery", discoveryPlanId: project.discoveryPlan!.id },
        options: step.options?.map((option) => option.targetStepId === completion.id ? { ...option, actionType: "continue_with_answers", targetStepId: recommendation.id } : option),
      } : step);
      if (entry && discoveryForm?.formFields?.length) {
        const branchForms = steps.filter((step) => step.type === "form" && step.settings?.blueprintId === discoveryBlueprint.id);
        const firstForm = branchForms[0];
        const seenKeys = new Set<string>();
        const seenLabels = new Set<string>();
        const fields = [...discoveryForm.formFields, ...branchForms.flatMap((step) => step.formFields || [])].filter((field) => {
          const label = field.label.trim().toLocaleLowerCase("pt-BR");
          if (seenKeys.has(field.key) || seenLabels.has(label)) return false;
          seenKeys.add(field.key);
          seenLabels.add(label);
          return true;
        }).map((field) => ({ ...field, includeInHandoff: true }));
        if (firstForm) {
          const duplicateForms = new Set(branchForms.slice(1).map((step) => step.id));
          const nextAfter = (targetId?: string): string | undefined => duplicateForms.has(targetId || "")
            ? nextAfter(steps.find((step) => step.id === targetId)?.options?.[0]?.targetStepId)
            : targetId;
          steps = steps.filter((step) => !duplicateForms.has(step.id)).map((step) => ({
            ...step,
            ...(step.id === firstForm.id ? {
              title: "Vamos encontrar uma opção para você", formFields: fields,
              settings: { ...step.settings, progressiveQuestioning: true, journeyMode: "assisted_discovery", discoveryPlanId: project.discoveryPlan!.id },
            } : {}),
            options: step.options?.map((option) => ({ ...option, targetStepId: nextAfter(option.targetStepId) })),
          }));
        } else {
          const discoveryEntryId = uid("step");
          steps = steps.map((step) => ({ ...step, options: step.options?.map((option) => option.targetStepId === entry.id ? { ...option, targetStepId: discoveryEntryId } : option) }));
          steps.splice(steps.findIndex((step) => step.id === entry.id), 0, {
            ...discoveryForm, id: discoveryEntryId, title: "Vamos encontrar uma opção para você", formFields: fields,
            settings: { ...discoveryForm.settings, blueprintId: discoveryBlueprint.id, intentId: discoveryBlueprint.intentId, progressiveQuestioning: true, journeyMode: "assisted_discovery" },
            options: [{ id: uid("option"), label: "Continuar", value: "discovery-context", actionType: "continue_with_answers", targetStepId: entry.id }],
          });
        }
      }
      steps.splice(steps.findIndex((step) => step.id === completion.id), 0, {
        ...recommendation, settings: { ...recommendation.settings, blueprintId: discoveryBlueprint.id, intentId: discoveryBlueprint.intentId },
        options: [{ id: uid("option"), label: "Continuar com a equipe", value: "continue", actionType: "go_to_step", targetStepId: completion.id }],
      });
      steps = steps.map((step, order) => ({ ...step, order }));
    }
  }
  const discoveryOfferings = discoveryBlueprint && project.discoveryPlan?.status === "ready"
    ? project.commercialConfig?.serviceOfferings?.filter((offering) => offering.settings.discoveryPlanId === project.discoveryPlan!.id).map((offering) => {
      const declared = architecture.offerings.find((item) => item.name === offering.name);
      const materialized = serviceOfferings?.find((item) => item.name === offering.name);
      return { ...offering, ...materialized, id: offering.id, price: declared?.price ?? offering.price, priceMode: declared?.priceMode || offering.priceMode, settings: { ...offering.settings, ...materialized?.settings, blueprintId: discoveryBlueprint.id, intentId: discoveryBlueprint.intentId, recommendationOnly: declared?.kind === "product" } };
    }) : undefined;
  const nativeScheduling = input.capabilities.some((item) => item.enabled && item.key === "scheduling");
  const nativeReservation = input.capabilities.some((item) => item.enabled && item.key === "reservation");
  const finalServiceOfferings: NonNullable<Project["commercialConfig"]>["serviceOfferings"] = discoveryOfferings?.length ? [...(serviceOfferings || []).filter((item) => !discoveryOfferings.some((offering) => offering.name === item.name)), ...discoveryOfferings] : serviceOfferings ?? project.commercialConfig?.serviceOfferings;
  const offeringAliases = new Map([
    ...(architectureConfig.serviceOfferings || []).map((item) => [item.id, item.settings.architectureOfferingId] as const),
    ...(architectureConfig.catalogItems || []).map((item) => [item.id, item.metadata.architectureOfferingId] as const),
  ]);
  const locations = architectureConfig.locations?.map((location) => ({ ...location, settings: {
    ...location.settings,
    offeringIds: Array.isArray(location.settings?.offeringIds) ? location.settings.offeringIds.flatMap((id) => {
      const architectureId = offeringAliases.get(String(id));
      if (!architectureId) return [id];
      return [
        ...(finalServiceOfferings || []).filter((item) => item.settings.architectureOfferingId === architectureId).map((item) => item.id),
        ...(catalogItems || []).filter((item) => item.metadata.architectureOfferingId === architectureId).map((item) => item.id),
      ];
    }) : location.settings?.offeringIds,
  } }));
  const reconciled: Project = {
    ...project,
    description: architecture.businessSummary.whatItSells,
    subtitle: architecture.businessSummary.commercialModel,
    steps,
    capabilities: input.capabilities,
    commercialConfig: {
      ...(project.commercialConfig || {}),
      serviceOfferings: finalServiceOfferings,
      catalogCategories: architectureConfig.catalogCategories,
      catalogItems,
      locations,
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
  for (const offering of architecture.offerings) {
    if (offering.price == null) continue;
    const materialized = project.commercialConfig?.catalogItems?.find((item) => item.metadata.architectureOfferingId === offering.id)
      || project.commercialConfig?.serviceOfferings?.find((item) => item.settings.architectureOfferingId === offering.id);
    if (materialized?.price !== offering.price) issues.push({ code: "confirmed_price_lost", message: `O preço confirmado de “${offering.name}” não foi preservado.` });
  }
  for (const location of architecture.locations) {
    const materialized = project.commercialConfig?.locations?.find((item) => item.settings?.architectureId === location.id);
    for (const key of ["supportsDelivery", "supportsPickup", "supportsInPerson", "deliveryRadiusKm"] as const) {
      if (location[key] != null && materialized?.[key] !== location[key]) issues.push({ code: "location_operation_lost", message: `A modalidade confirmada da unidade “${location.label}” não foi preservada.` });
    }
    if (location.openingHours?.length && JSON.stringify(materialized?.openingHours) !== JSON.stringify(location.openingHours)) issues.push({ code: "location_hours_lost", message: `Os horários de “${location.label}” não foram preservados.` });
    if (location.hoursText && materialized?.settings?.hoursText !== location.hoursText) issues.push({ code: "location_hours_lost", message: `O horário informado de “${location.label}” não foi preservado.` });
  }
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
      const handledByCatalog = isCatalogSelectionLabel(label) && journeySteps.some((step) => step.blocks?.some((block) => block.type === "catalog_item_cards"));
      if (!handledByLocationSelector && !handledByCatalog && !materializedLabels.has(label.trim().toLocaleLowerCase("pt-BR"))) issues.push({ code: "missing_declared_field", blueprintId: blueprint.id, message: `A jornada “${intent.label}” perdeu o campo confirmado “${label}”.` });
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
