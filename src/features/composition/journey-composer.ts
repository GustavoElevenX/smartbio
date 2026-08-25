import { draftCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import { slugify, uid } from "@/lib/utils";
import { isRecommendationIntent, synthesizePublicDescription } from "@/features/composition/public-copy";
import type { BusinessCapabilityProfile, ContentBlockType, DataRequirement, ExperienceCompositionInput, JourneyStep, Project, ProjectCapability } from "@/types";

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

export class RuleBasedJourneyComposer {
  compose(input: ExperienceCompositionInput, _profile: BusinessCapabilityProfile, capabilities: ProjectCapability[]): JourneyComposition {
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
    qualificationRules: assign(config.qualificationRules), schedulableServices: assign(config.schedulableServices), resources: assign(config.resources),
    availabilityRules: assign(config.availabilityRules), availabilityExceptions: assign(config.availabilityExceptions), catalogCategories: assign(config.catalogCategories),
    catalogItems: assign(config.catalogItems), reservableUnits: assign(config.reservableUnits), reservationBlocks: assign(config.reservationBlocks), locations: assign(config.locations), routingRules: assign(config.routingRules),
    quoteDefinition: config.quoteDefinition ? { ...config.quoteDefinition, projectId } : undefined,
  };
}

export function defaultSlug(input: ExperienceCompositionInput) { return slugify(input.slug || input.businessName); }
export const journeyComposer = new RuleBasedJourneyComposer();
