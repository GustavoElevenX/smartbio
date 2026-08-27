import { draftCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import { slugify, uid } from "@/lib/utils";
import { isRecommendationIntent, synthesizePublicDescription } from "@/features/composition/public-copy";
import type { CommercialArchitecture } from "@/features/ai-setup/ai-setup.schema";
import { resolveCompletionDestination, semanticJourneyRouteKey } from "@/features/routing/completion-destination";
import { formFieldKey } from "@/features/forms/form-field-utils";
import type { BusinessCapabilityProfile, ContentBlockType, DataRequirement, ExperienceCompositionInput, JourneyStep, Project, ProjectCapability, RoutingDestination, StepOption } from "@/types";

export type CommercialConfig = NonNullable<Project["commercialConfig"]>;
export interface JourneyComposition { steps: JourneyStep[]; commercialConfig: CommercialConfig; requirements: DataRequirement[] }

const copy: Record<ProjectCapability["key"], { label: string; description: string }> = {
  qualification: { label: "Receber uma recomendação", description: "Responda algumas perguntas para encontrar o próximo passo." },
  quote: { label: "Pedir orçamento", description: "Conte o que precisa para solicitar uma avaliação." },
  scheduling: { label: "Escolher um horário", description: "Consulte os horários configurados pelo negócio." },
  catalog_order: { label: "Ver produtos", description: "Explore o catálogo quando os itens forem adicionados." },
  reservation: { label: "Consultar disponibilidade", description: "Escolha datas depois que as opções forem configuradas." },
  routing: { label: "Encontrar atendimento", description: "Encontre a unidade ou canal adequado." },
  payment: { label: "Continuar para pagamento", description: "Acesse o checkout configurado pelo negócio." },
};

const blockFor: Record<ProjectCapability["key"], ContentBlockType> = {
  qualification: "form", quote: "quote_summary", scheduling: "schedule_slots", catalog_order: "catalog_item_cards",
  reservation: "reservable_unit_cards", routing: "location_selector", payment: "cta_group",
};

function welcomeActionLabel(input: ExperienceCompositionInput, capabilities: ProjectCapability[]) {
  const enabled = new Set(capabilities.filter((item) => item.enabled).map((item) => item.key));
  if (enabled.has("qualification") && isRecommendationIntent(input.primaryGoal)) return input.primaryGoal;
  if (enabled.has("quote") && enabled.has("scheduling")) return "Ver serviços e horários";
  if (enabled.has("quote")) return "Pedir orçamento";
  if (enabled.has("scheduling")) return "Agendar atendimento";
  if (enabled.has("catalog_order")) return "Explorar opções";
  return `Conhecer ${input.businessName}`;
}

function configuredAction(input: ExperienceCompositionInput, finalStepId: string): JourneyStep {
  const options: NonNullable<JourneyStep["options"]> = [];
  if (input.primaryDestination === "WhatsApp" && input.phone) {
    options.push({ id: uid("option"), label: "Continuar no WhatsApp", value: "whatsapp", actionType: "open_whatsapp", actionPayload: { phone: input.phone } });
  } else if (input.websiteUrl) {
    options.push({ id: uid("option"), label: `Continuar por ${input.primaryDestination}`, value: "destination", actionType: "open_url", actionPayload: { url: input.websiteUrl } });
  }
  options.push({ id: uid("option"), label: "Enviar meus dados", value: "lead", actionType: "submit_form" });
  return { id: finalStepId, type: "action", title: "Pronto para o próximo passo?", description: "Revise seus dados antes de continuar.", order: 0, isActive: true, visualVariant: "conversion", options };
}

function architectureAction(channel: CommercialArchitecture["channels"][number] | undefined, label: string, metadata: Record<string, string | number | boolean> = {}, runtimeDestinationId?: string): StepOption {
  if (!channel?.value) throw new Error(`A jornada “${label}” não possui um canal final válido.`);
  const destinationId = runtimeDestinationId || channel.id;
  if (channel.type === "whatsapp") return { id: uid("option"), label, value: destinationId, actionType: "open_whatsapp" as const, actionPayload: { phone: channel.value, destinationId, ...metadata } };
  if (channel.type === "external_url") return { id: uid("option"), label, value: destinationId, actionType: "open_url" as const, actionPayload: { url: channel.value, destinationId, ...metadata } };
  if (channel.type === "phone") return { id: uid("option"), label, value: destinationId, actionType: "open_url" as const, actionPayload: { url: `tel:${channel.value}`, destinationId, ...metadata } };
  if (channel.type === "email") return { id: uid("option"), label, value: destinationId, actionType: "open_url" as const, actionPayload: { url: `mailto:${channel.value}`, destinationId, ...metadata } };
  throw new Error(`A jornada “${label}” não possui um canal final válido.`);
}

function actionLabel(type: CommercialArchitecture["journeyBlueprints"][number]["completion"]["type"], fallback?: string) {
  if (type === "whatsapp") return "Continuar no WhatsApp";
  if (type === "phone") return "Ligar agora";
  if (type === "email") return "Continuar por e-mail";
  return fallback || "Abrir link";
}

function routedCompletionOption(blueprint: CommercialArchitecture["journeyBlueprints"][number], metadata: Record<string, string | number | boolean>): StepOption {
  const actionPayload = { ...metadata, routing: true, completionType: blueprint.completion.type };
  if (blueprint.completion.type === "whatsapp") return { id: uid("option"), label: actionLabel("whatsapp"), value: blueprint.id, actionType: "open_whatsapp", actionPayload };
  if (["external_url", "phone", "email"].includes(blueprint.completion.type)) return { id: uid("option"), label: actionLabel(blueprint.completion.type), value: blueprint.id, actionType: "open_url", actionPayload };
  throw new Error(`A jornada “${blueprint.objective}” exige routing, mas completion.type=${blueprint.completion.type} não resolve um destination externo.`);
}

function fieldType(label: string): NonNullable<JourneyStep["formFields"]>[number]["type"] {
  const value = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/data|dia/.test(value)) return "date";
  if (/horario|hora/.test(value)) return "time";
  if (/quantidade|numero/.test(value)) return "number";
  if (/site|instagram|url|link/.test(value)) return "url";
  if (/telefone|whatsapp/.test(value)) return "phone";
  if (/observ|detalh|necessidade|contexto/.test(value)) return "textarea";
  return "text";
}

function isLocationSelectionLabel(label: string) {
  return /unidade|local|loja|filial|cidade|bairro/i.test(label.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

function architectureComposition(input: ExperienceCompositionInput, architecture: CommercialArchitecture): JourneyComposition {
  const welcomeId = uid("step");
  const choiceId = uid("step");
  const offeringRuntimeIds = new Map(architecture.offerings.map((offering) => [offering.id, uid("offering")]));
  const channelRuntimeIds = new Map(architecture.channels.map((channel) => [channel.id, uid("destination")]));
  const locationRuntimeIds = new Map(architecture.locations.map((location) => [location.id, uid("location")]));
  const steps: JourneyStep[] = [{
    id: welcomeId,
    type: "welcome",
    title: input.businessName,
    description: architecture.businessSummary.whatItSells,
    order: 0,
    isActive: true,
    visualVariant: "brand-introduction",
    blocks: [{ id: uid("block"), type: "text", variant: "brand-introduction" }],
    options: [{ id: uid("option"), label: architecture.intents[0]?.label || "Ver próximos passos", value: "start", actionType: "go_to_step", targetStepId: choiceId }],
  }];
  const intentById = new Map(architecture.intents.map((intent) => [intent.id, intent]));
  const targetByBlueprint = new Map<string, string>();

  for (const blueprint of architecture.journeyBlueprints) {
    const intent = intentById.get(blueprint.intentId);
    if (!intent) continue;
    const completionId = uid("step");
    const blueprintSteps = blueprint.completion.destinationStrategy === "by_location"
      && !blueprint.steps.some((declared) => declared.usesLocations.length > 0)
      ? [{ purpose: "Escolher a unidade", expectedCapability: "routing" as const, collects: [], usesOfferings: [], usesLocations: architecture.locations.map((location) => location.id) }, ...blueprint.steps]
      : blueprint.steps;
    const locationStepIndex = blueprintSteps.findIndex((declared) => declared.usesLocations.length > 0);
    const candidateSteps = blueprint.mode.startsWith("direct_") && blueprint.completion.destinationStrategy !== "by_location" ? [] : blueprintSteps;
    const declaredSteps = candidateSteps.filter((declared, index) => {
      const externalizedNativeCapability = ["scheduling", "reservation"].includes(declared.expectedCapability || "")
        && blueprint.completion.destinationStrategy !== "native";
      const externalizedRoutingCapability = declared.expectedCapability === "routing"
        && blueprint.completion.destinationStrategy !== "by_location";
      const isLocationSelection = blueprint.completion.destinationStrategy === "by_location" && index === locationStepIndex;
      return isLocationSelection || declared.collects.length > 0 || (Boolean(declared.expectedCapability) && !externalizedNativeCapability && !externalizedRoutingCapability);
    });
    const stepIds = declaredSteps.map(() => uid("step"));
    targetByBlueprint.set(blueprint.id, stepIds[0] || completionId);
    for (const [index, declared] of declaredSteps.entries()) {
      const isLocationSelection = blueprint.completion.destinationStrategy === "by_location"
        && declared.usesLocations.length > 0
        && declared === blueprint.steps[locationStepIndex];
      const capability = isLocationSelection
        ? "routing"
        : declared.expectedCapability === "routing" && blueprint.completion.destinationStrategy !== "by_location"
          ? null
        : ["scheduling", "reservation"].includes(declared.expectedCapability || "")
        && blueprint.completion.destinationStrategy !== "native"
        ? null
        : declared.expectedCapability;
      const type: JourneyStep["type"] = capability === "quote" ? "quote"
        : capability === "scheduling" ? "schedule"
          : capability === "catalog_order" ? "catalog"
            : capability === "reservation" ? "reservation"
              : capability === "routing" ? "routing"
                : "form";
      const stepId = stepIds[index];
      const targetStepId = stepIds[index + 1] || completionId;
      const fieldKeys: string[] = [];
      const formFields = declared.collects
        .filter((label) => !isLocationSelection || !isLocationSelectionLabel(label))
        .map((label) => {
          const key = formFieldKey(label, fieldKeys);
          fieldKeys.push(key);
          return { id: uid("field"), label, key, type: fieldType(label), required: true, includeInHandoff: blueprint.completion.handoffSummary, handoffLabel: label };
        });
      steps.push({
        id: stepId,
        type,
        title: index === 0 ? intent.label : declared.purpose,
        description: declared.purpose,
        order: steps.length,
        isActive: true,
        visualVariant: "commercial-intent",
        blocks: [{ id: uid("block"), type: capability ? blockFor[capability] : "form", content: { source: capability || "architecture", intentId: intent.id, blueprintId: blueprint.id, ...(capability === "routing" ? { allowDirectHandoff: false } : {}) } }],
        formFields,
        settings: { blueprintId: blueprint.id, intentId: intent.id },
        options: [{ id: uid("option"), label: capability === "quote" ? "Enviar solicitação" : "Continuar", value: blueprint.id, actionType: capability ? "start_capability" : "continue_with_answers", actionPayload: capability ? { capability, blueprintId: blueprint.id, intentId: intent.id, completionType: blueprint.completion.type } : { blueprintId: blueprint.id, intentId: intent.id, completionType: blueprint.completion.type }, targetStepId }],
      });
    }
    const resolution = resolveCompletionDestination({ architecture, blueprint });
    const channel = resolution.status === "resolved" ? resolution.channel : undefined;
    const metadata = { blueprintId: blueprint.id, intentId: intent.id, interestLabel: intent.label, completionType: blueprint.completion.type };
    const completionOption: StepOption = blueprint.completion.destinationStrategy === "by_location"
      ? routedCompletionOption(blueprint, metadata)
      : blueprint.completion.destinationStrategy === "native"
        ? { id: uid("option"), label: "Concluir", value: blueprint.id, actionType: "finish", actionPayload: metadata }
        : architectureAction(channel, actionLabel(blueprint.completion.type, channel?.label), metadata, channel ? channelRuntimeIds.get(channel.id) : undefined);
    steps.push({ id: completionId, type: "action", title: intent.label, description: blueprint.completion.handoffSummary ? "A Sobe leva um resumo do que foi informado para o atendimento." : "Siga pelo canal indicado pelo negócio.", order: steps.length, isActive: true, visualVariant: "conversion", settings: { blueprintId: blueprint.id, intentId: intent.id }, options: [completionOption] });
  }

  const visibleBlueprints = architecture.journeyBlueprints
    .filter((blueprint) => intentById.get(blueprint.intentId)?.visibleOnEntry)
    .sort((left, right) => (intentById.get(right.intentId)?.priority || 0) - (intentById.get(left.intentId)?.priority || 0));
  steps.splice(1, 0, {
    id: choiceId,
    type: "choice",
    title: visibleBlueprints.length > 1 ? "Escolha seu próximo passo" : visibleBlueprints[0] ? "Seu próximo passo" : "Como você quer continuar?",
    description: architecture.businessSummary.commercialModel,
    order: 1,
    isActive: true,
    visualVariant: "commercial-intent",
    blocks: [{ id: uid("block"), type: "choice_grid", variant: "brand-composed" }],
    options: visibleBlueprints.map((blueprint) => {
      const intent = intentById.get(blueprint.intentId)!;
      const resolution = resolveCompletionDestination({ architecture, blueprint });
      const channel = resolution.status === "resolved" ? resolution.channel : undefined;
      const metadata = { blueprintId: blueprint.id, intentId: intent.id, interestLabel: intent.label, completionType: blueprint.completion.type };
      if (blueprint.mode === "direct_external") return architectureAction(channel, intent.label, metadata, channel ? channelRuntimeIds.get(channel.id) : undefined);
      if (blueprint.mode === "direct_contact") return architectureAction(channel, intent.label, metadata, channel ? channelRuntimeIds.get(channel.id) : undefined);
      return { id: uid("option"), label: intent.label, description: intent.visitorNeed, value: intent.id, actionType: "go_to_step" as const, targetStepId: targetByBlueprint.get(blueprint.id) };
    }),
  });

  const locationChannelIds = new Set(architecture.locations.flatMap((location) => location.channelIds));
  const channelLocationIds = new Map(architecture.channels.map((channel) => [channel.id, architecture.locations.filter((location) => location.channelIds.includes(channel.id)).map((location) => location.id)]));
  const destinations: RoutingDestination[] = architecture.channels.flatMap((channel) => channel.value && channel.type !== "native" ? [{ id: channelRuntimeIds.get(channel.id)!, key: channel.id, type: channel.type === "external_url" ? "url" : channel.type, label: channel.label, value: channel.value, locationId: channelLocationIds.get(channel.id)?.length === 1 ? locationRuntimeIds.get(channelLocationIds.get(channel.id)![0]) : undefined, isDefault: channel.isFallback === true, role: channel.isFallback ? "general_contact" as const : locationChannelIds.has(channel.id) ? "location_contact" as const : "intent_contact" as const }] : []);
  const routeMaterializations = architecture.journeyBlueprints.flatMap((blueprint) => {
    if (blueprint.completion.destinationStrategy !== "by_location") return [];
    const declaredLocationIds = [...new Set(blueprint.steps.flatMap((step) => step.usesLocations))];
    const locationIds = declaredLocationIds.length ? declaredLocationIds : architecture.locations.map((location) => location.id);
    return locationIds.map((locationId) => {
      const resolution = resolveCompletionDestination({ architecture, blueprint, selectedLocationId: locationId });
      if (resolution.status !== "resolved") throw new Error(`A jornada “${blueprint.objective}” não pode ser roteada para ${locationId}: ${resolution.reason}`);
      return { blueprint, architectureLocationId: locationId, locationId: locationRuntimeIds.get(locationId)!, destinationId: channelRuntimeIds.get(resolution.channel.id)! };
    });
  });
  const destinationsByLocation = new Map(architecture.locations.map((location) => [location.id, [...new Set(routeMaterializations.filter((item) => item.architectureLocationId === location.id).map((item) => item.destinationId))]]));
  const locations = architecture.locations.map((location, index) => {
    const semanticDestinations = destinationsByLocation.get(location.id) || [];
    return { id: locationRuntimeIds.get(location.id)!, projectId: "setup", name: location.label, address: location.address ?? undefined, countryCode: "BR", geocodingStatus: "pending" as const, timezone: "America/Sao_Paulo", openingHours: [], supportsDelivery: false, supportsPickup: false, supportsInPerson: true, priority: 100 - index, isActive: true, routingDestinationId: semanticDestinations.length === 1 ? semanticDestinations[0] : undefined, settings: { architectureId: location.id } };
  });
  const routingRules = routeMaterializations.map((item, index) => ({ id: uid("route"), projectId: "setup", priority: 10_000 - index, condition: { field: "journey_route", operator: "equals" as const, value: semanticJourneyRouteKey(item.blueprint.id, item.locationId) }, destinationId: item.destinationId, isActive: true }));
  const catalogOfferings = architecture.offerings.filter((offering) => offering.kind === "product");
  const serviceOfferings = architecture.offerings.filter((offering) => offering.kind !== "product");
  const categoryId = catalogOfferings.length ? uid("category") : undefined;
  const semanticTokens = (value: string) => new Set(value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !["para", "com", "uma", "das", "dos"].includes(token)).map((token) => token.length > 4 ? token.replace(/s$/, "") : token));
  const blueprintForOffering = (offering: CommercialArchitecture["offerings"][number]) => {
    const explicit = architecture.journeyBlueprints.find((blueprint) => blueprint.steps.some((step) => step.usesOfferings.includes(offering.id)));
    if (explicit) return explicit;
    const offeringTokens = semanticTokens(offering.name);
    return architecture.journeyBlueprints
      .map((blueprint) => {
        const intent = intentById.get(blueprint.intentId);
        const candidateTokens = semanticTokens(`${intent?.label || ""} ${intent?.visitorNeed || ""} ${blueprint.objective}`);
        return { blueprint, score: [...offeringTokens].filter((token) => candidateTokens.has(token)).length };
      })
      .sort((left, right) => right.score - left.score)
      .find((candidate) => candidate.score > 0)?.blueprint;
  };
  return {
    steps: steps.map((step, order) => ({ ...step, order })),
    commercialConfig: {
      qualificationRules: architecture.journeyBlueprints.some((item) => item.steps.some((step) => step.expectedCapability === "qualification")) ? [] : undefined,
      serviceOfferings: serviceOfferings.length ? serviceOfferings.map((offering, index) => {
        const blueprint = blueprintForOffering(offering);
        const resolution = blueprint ? resolveCompletionDestination({ architecture, blueprint }) : undefined;
        const channel = resolution?.status === "resolved" ? resolution.channel : undefined;
        return { id: offeringRuntimeIds.get(offering.id)!, projectId: "setup", name: offering.name, slug: slugify(offering.name), description: `Saiba mais sobre ${offering.name}.`, shortDescription: offering.name, serviceMode: channel?.type === "external_url" ? "external_url" as const : "contact" as const, priceMode: "on_request" as const, currency: "BRL", destinationId: channel && channel.type !== "external_url" ? channelRuntimeIds.get(channel.id) : undefined, externalUrl: channel?.type === "external_url" ? channel.value || undefined : undefined, isFeatured: index < 3, isActive: true, order: index, settings: { source: "commercial_architecture", offeringKind: offering.kind, architectureOfferingId: offering.id, ...(blueprint ? { blueprintId: blueprint.id, intentId: blueprint.intentId } : {}) } };
      }) : undefined,
      catalogCategories: categoryId ? [{ id: categoryId, projectId: "setup", name: "Opções", order: 0, isActive: true }] : undefined,
      catalogItems: categoryId ? catalogOfferings.map((offering, index) => ({ id: offeringRuntimeIds.get(offering.id)!, projectId: "setup", categoryId, name: offering.name, currency: "BRL", isAvailable: true, variants: [], metadata: { source: "commercial_architecture", architectureOfferingId: offering.id, priceMode: "manual" }, order: index })) : undefined,
      locations: locations.length ? locations : undefined,
      routingDestinations: destinations.length ? destinations : undefined,
      routingRules: routingRules.length ? routingRules : undefined,
    },
    requirements: requirementsFromBlueprints(architecture),
  };
}

function requirementsFromBlueprints(architecture: CommercialArchitecture): DataRequirement[] {
  return architecture.journeyBlueprints.flatMap((blueprint) => {
    const capability = blueprint.steps.find((step) => step.expectedCapability)?.expectedCapability || "project";
    return blueprint.requiredFacts.map((fact) => ({ id: `requirement-${fact.key}`, key: fact.key, label: fact.label, capability, status: "missing", severity: fact.severity, reason: fact.reason }));
  });
}

export class RuleBasedJourneyComposer {
  compose(input: ExperienceCompositionInput, _profile: BusinessCapabilityProfile, capabilities: ProjectCapability[], architecture?: CommercialArchitecture): JourneyComposition {
    if (architecture?.journeyBlueprints.length) return architectureComposition(input, architecture);
    const active = capabilities.filter((capability) => capability.enabled);
    const usable = active.length ? active : capabilities.slice(0, 1);
    const finalStepId = uid("step");
    const entries = new Map(usable.map((capability) => [capability.key, uid("step")]));
    const choiceStepId = uid("step");
    const steps: JourneyStep[] = [{
      id: uid("step"), type: "welcome", title: input.businessName, description: synthesizePublicDescription({ businessName: input.businessName, primaryGoal: input.primaryGoal }), order: 0, isActive: true, visualVariant: "brand-introduction",
      blocks: [{ id: uid("block"), type: "text", variant: "brand-introduction" }],
      options: [{ id: uid("option"), label: welcomeActionLabel(input, usable), value: "start", actionType: "go_to_step", targetStepId: choiceStepId }],
    }, {
      id: choiceStepId, type: "choice", title: "Como podemos ajudar?", description: `Escolha o objetivo da sua visita a ${input.businessName}.`, order: 1, isActive: true, visualVariant: "commercial-intent",
      blocks: [{ id: uid("block"), type: "choice_grid", variant: "brand-composed" }],
      options: usable.map((capability) => ({ id: uid("option"), label: copy[capability.key].label, description: copy[capability.key].description, value: capability.key, actionType: "go_to_step", targetStepId: entries.get(capability.key) })),
    }];

    for (const capability of usable) {
      const requirementKey = `${capability.key}.${capability.key === "catalog_order" ? "items" : capability.key === "scheduling" ? "services" : capability.key === "reservation" ? "units" : capability.key === "routing" ? "destinations" : capability.key === "payment" ? "url" : capability.key === "quote" ? "services" : "questions"}`;
      steps.push({
        id: entries.get(capability.key)!,
        type: capability.key === "quote" ? "quote" : capability.key === "scheduling" ? "schedule" : capability.key === "catalog_order" ? "catalog" : capability.key === "reservation" ? "availability" : capability.key === "routing" ? "routing" : capability.key === "qualification" ? "form" : "action",
        title: copy[capability.key].label,
        description: copy[capability.key].description,
        order: steps.length,
        isActive: true,
        blocks: [{ id: uid("block"), type: blockFor[capability.key], content: { source: capability.key, emptyState: "Complete os dados comerciais para concluir esta etapa." }, style: { incomplete: true, requirementKey } }],
        options: [{ id: uid("option"), label: capability.key === "quote" ? "Enviar solicitação" : "Continuar", value: capability.key, actionType: "start_capability", actionPayload: { capability: capability.key }, targetStepId: finalStepId }],
      });
    }
    const finalStep = configuredAction(input, finalStepId); finalStep.order = steps.length; steps.push(finalStep);
    return {
      steps,
      commercialConfig: {
        qualificationRules: usable.some((c) => c.key === "qualification") ? [] : undefined,
        schedulableServices: usable.some((c) => c.key === "scheduling") ? [] : undefined,
        resources: usable.some((c) => c.key === "scheduling") ? [] : undefined,
        availabilityRules: usable.some((c) => c.key === "scheduling" || c.key === "reservation") ? [] : undefined,
        catalogCategories: usable.some((c) => c.key === "catalog_order") ? [] : undefined,
        catalogItems: usable.some((c) => c.key === "catalog_order") ? [] : undefined,
        reservableUnits: usable.some((c) => c.key === "reservation") ? [] : undefined,
        reservationBlocks: usable.some((c) => c.key === "reservation") ? [] : undefined,
        locations: usable.some((c) => c.key === "routing") ? [] : undefined,
        routingRules: usable.some((c) => c.key === "routing") ? [] : undefined,
        routingDestinations: usable.some((c) => c.key === "routing") ? [] : undefined,
      },
      requirements: draftCapabilityRequirements(usable),
    };
  }
}

export function assignProjectToCommercialConfig(config: CommercialConfig, projectId: string): CommercialConfig {
  const assign = <T extends { projectId: string }>(values?: T[]) => values?.map((value) => ({ ...value, projectId }));
  return {
    ...config,
    qualificationRules: assign(config.qualificationRules), serviceOfferings: assign(config.serviceOfferings), schedulableServices: assign(config.schedulableServices), resources: assign(config.resources),
    availabilityRules: assign(config.availabilityRules), availabilityExceptions: assign(config.availabilityExceptions), catalogCategories: assign(config.catalogCategories),
    catalogItems: assign(config.catalogItems), reservableUnits: assign(config.reservableUnits), reservationBlocks: assign(config.reservationBlocks), locations: assign(config.locations), routingRules: assign(config.routingRules),
    quoteDefinition: config.quoteDefinition ? { ...config.quoteDefinition, projectId } : undefined,
  };
}

export function defaultSlug(input: ExperienceCompositionInput) { return slugify(input.slug || input.businessName); }
export const journeyComposer = new RuleBasedJourneyComposer();
