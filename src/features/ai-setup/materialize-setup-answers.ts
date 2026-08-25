import { structuredJourneyQuestionSchema, type AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { evaluateCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import { isRecommendationIntent, synthesizePublicDescription } from "@/features/composition/public-copy";
import { contextSignature, offerNamesFromSetup } from "@/features/qualification/offer-context";
import { classifyJourneyMode, questionQualityIssues } from "@/features/qualification/recommendation-semantics";
import { conservativeServiceDescription, inferRecommendationSignals, inferStrongRecommendationSignals } from "@/features/qualification/recommendation-engine";
import { visitorActionSemanticKey } from "@/features/ai-setup/visitor-actions";
import { uid } from "@/lib/utils";
import type {
  AvailabilityRule,
  BusinessLocation,
  CompletionChannel,
  ConfirmationMode,
  FormField,
  JourneyMode,
  JourneyStep,
  Project,
  RoutingDestination,
  SchedulableService,
  ServiceOffering,
  StructuredJourneyQuestion,
} from "@/types";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function answerText(answers: Record<string, unknown>, key: string) {
  const value = answers[key];
  if (Array.isArray(value)) return value.map(String).join(", ").trim();
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function listFromText(value: string) {
  return unique(
    value
      .replace(/[.!?]+$/g, "")
      .split(/\r?\n|;|,|\s+e\s+/i)
      .map((item) => item.replace(/^[-•]\s*/, "").trim())
      .filter((item) => item.length > 1),
  ).slice(0, 12);
}

function quoteMode(value: string): "exact" | "range" | "starting_at" | "manual" {
  const normalized = normalize(value);
  if (normalized.includes("range") || normalized.includes("faixa")) return "range";
  if (normalized.includes("starting") || normalized.includes("partir")) return "starting_at";
  if (normalized.includes("exact") || normalized.includes("exato")) return "exact";
  return "manual";
}

function completionChannel(value: string, project: Project): CompletionChannel {
  const normalized = normalize(value);
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("email") || normalized.includes("e-mail")) return "email";
  if (normalized.includes("telefone")) return "phone";
  if (normalized.includes("extern") || normalized.includes("url") || normalized.includes("site")) return "external_url";
  if (normalize(project.primaryDestination).includes("whatsapp") && project.phone) return "whatsapp";
  return "native";
}

function confirmationMode(value: string): ConfirmationMode {
  const normalized = normalize(value);
  if (normalized.includes("instant") || normalized.includes("imediat")) return "instant";
  if (normalized.includes("external") || normalized.includes("extern")) return "external_system";
  return "manual_approval";
}

function visitorFields(value: string) {
  const normalized = normalize(value);
  const fields: string[] = [];
  const add = (terms: string[], key: string) => {
    if (terms.some((term) => normalized.includes(term))) fields.push(key);
  };
  add(["nome", "tutor", "responsavel"], "name");
  add(["whatsapp", "telefone", "celular"], "phone");
  add(["email", "e-mail"], "email");
  add(["empresa", "companhia"], "company");
  add(["nome do pet", "pet"], "pet_name");
  add(["especie", "animal"], "pet_species");
  add(["porte", "tamanho"], "pet_size");
  add(["servico", "interesse"], "service");
  return unique(fields.length ? fields : ["name", "phone"]);
}

function durationMinutes(value: string) {
  const normalized = normalize(value);
  const hours = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hora)/)?.[1];
  const compactMinutes = normalized.match(/\d+\s*h\s*(\d{1,2})/)?.[1];
  const minutes = normalized.match(/(\d+)\s*(?:min|minuto)/)?.[1];
  const total = (hours ? Number(hours.replace(",", ".")) * 60 : 0) + Number(compactMinutes || minutes || 0);
  return total > 0 ? Math.round(total) : 60;
}

function schedulingServices(project: Project, value: string, mode: ConfirmationMode, fallbacks: string[]): SchedulableService[] {
  const described = value
    .split(/\r?\n|[.;]+/)
    .map((item) => item.trim())
    .filter((item) => item && (item.includes(":") || /\d+\s*(?:h|hora|min)/i.test(item)))
    .map((item) => ({
      name: (item.includes(":") ? item.split(":", 1)[0] : item.replace(/\b\d+(?:[.,]\d+)?\s*(?:h|hora|min).*$/i, "")).trim(),
      durationMinutes: durationMinutes(item),
    }))
    .filter((item) => item.name.length > 1);
  const source = described.length ? described : fallbacks.map((name) => ({ name, durationMinutes: 60 }));
  return source.slice(0, 12).map((item) => ({
    id: uid("service"),
    projectId: project.id,
    name: item.name,
    durationMinutes: item.durationMinutes,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    capacity: 1,
    confirmationMode: mode,
    isActive: true,
  }));
}

function weekdays(value: string) {
  const normalized = normalize(value);
  if (normalized.includes("todos os dias") || normalized.includes("segunda a domingo")) return [0, 1, 2, 3, 4, 5, 6];
  if (normalized.includes("segunda a sabado")) return [1, 2, 3, 4, 5, 6];
  if (normalized.includes("segunda a sexta")) return [1, 2, 3, 4, 5];
  const names: Array<[number, string]> = [[0, "domingo"], [1, "segunda"], [2, "terca"], [3, "quarta"], [4, "quinta"], [5, "sexta"], [6, "sabado"]];
  const detected = names.filter(([, name]) => normalized.includes(name)).map(([day]) => day);
  return detected.length ? detected : [1, 2, 3, 4, 5];
}

function timeRange(value: string) {
  const normalized = normalize(value);
  const match = normalized.match(/(\d{1,2})(?:[:h](\d{2}))?\s*h?\s*(?:as|a|ate|-)\s*(\d{1,2})(?:[:h](\d{2}))?\s*h?/);
  const format = (hour: string | undefined, minute: string | undefined, fallback: string) => hour
    ? `${hour.padStart(2, "0")}:${(minute || "00").padStart(2, "0")}`
    : fallback;
  return {
    startTime: format(match?.[1], match?.[2], "09:00"),
    endTime: format(match?.[3], match?.[4], "18:00"),
  };
}

function availabilityRules(project: Project, value: string): AvailabilityRule[] {
  if (!value) return [];
  const range = timeRange(value);
  return weekdays(value).map((weekday) => ({
    id: uid("availability"),
    projectId: project.id,
    weekday,
    startTime: range.startTime,
    endTime: range.endTime,
    timezone: "America/Sao_Paulo",
  }));
}

function coordinates(value: string) {
  const match = value.match(/(-?\d{1,2}[.,]\d+)\s*[,;]\s*(-?\d{1,3}[.,]\d+)/);
  if (!match) return undefined;
  const latitude = Number(match[1].replace(",", "."));
  const longitude = Number(match[2].replace(",", "."));
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined;
}

function locationFromAnswer(project: Project, value: string, openingHoursValue: string): BusinessLocation | undefined {
  const point = coordinates(value);
  if (!value || !point) return undefined;
  const range = timeRange(openingHoursValue);
  return {
    id: uid("location"),
    projectId: project.id,
    name: value.split(/[,;-]/, 1)[0].trim() || "Unidade principal",
    address: value,
    countryCode: "BR",
    ...point,
    geocodingStatus: "manual",
    timezone: "America/Sao_Paulo",
    openingHours: weekdays(openingHoursValue).map((weekday) => ({ weekday, opensAt: range.startTime, closesAt: range.endTime })),
    phone: project.phone,
    whatsapp: project.phone,
    supportsDelivery: false,
    supportsPickup: true,
    supportsInPerson: true,
    priority: 0,
    isActive: true,
  };
}

function routingDestinations(project: Project, destinationAnswer: string, fallbackAnswer: string, location?: BusinessLocation): RoutingDestination[] {
  const destinations: RoutingDestination[] = [];
  const normalized = normalize(destinationAnswer);
  if (location) {
    destinations.push({ id: uid("destination"), key: "location", type: "location", label: location.name, locationId: location.id });
  } else if (normalized.includes("whatsapp") && project.phone) {
    destinations.push({ id: uid("destination"), key: "whatsapp", type: "whatsapp", label: "Atendimento pelo WhatsApp", value: project.phone });
  } else if (destinationAnswer) {
    destinations.push({ id: uid("destination"), key: "contact", type: "form", label: destinationAnswer });
  }
  if (fallbackAnswer) {
    destinations.push({ id: uid("destination"), key: "unavailable", type: "unavailable", label: "Atendimento manual", message: fallbackAnswer });
  }
  return destinations;
}

function quoteQuestions(services: string[]): FormField[] {
  if (!services.length) return [];
  return [
    { id: uid("field"), label: "Qual serviço você precisa?", key: "servico", type: "select", options: services, required: true },
    { id: uid("field"), label: "Quantidade", key: "quantidade", type: "number", placeholder: "Ex.: 1", required: true },
    { id: uid("field"), label: "Detalhes do pedido", key: "detalhes", type: "textarea", placeholder: "Conte o que precisamos considerar para preparar o orçamento.", required: true },
  ];
}

function legacyQuestionsByLine(value: unknown): StructuredJourneyQuestion[] {
  if (typeof value !== "string") return [];
  return unique(value.split(/\r?\n/).map((item) => item.replace(/^[-•]\s*/, "").trim()))
    .filter((question) => !questionQualityIssues({ question, type: "textarea", purpose: "signal" }).length)
    .slice(0, 4)
    .map((question, index) => ({ id: `qualification-legacy-${index + 1}`, question, type: "textarea", purpose: index === 0 ? "need" : "signal", required: index < 2 }));
}

function qualificationQuestions(value: unknown, offerings: string[], mode: JourneyMode): FormField[] {
  const structured = Array.isArray(value)
    ? value.map((item) => structuredJourneyQuestionSchema.safeParse(item)).filter((item) => item.success).map((item) => item.data)
    : legacyQuestionsByLine(value);
  const valid = structured
    .filter((question) => !questionQualityIssues(question).length)
    .slice(0, 4);
  const fallback: StructuredJourneyQuestion[] = [
    { id: "qualification-fallback-need", question: "O que você mais gostaria de resolver neste momento?", type: "textarea", purpose: "need", required: true },
    { id: "qualification-fallback-signal", question: "Que resultado seria mais importante para você?", type: "textarea", purpose: "signal", required: true },
  ];
  const questions = valid.length >= 2 ? valid : fallback;
  const fields: FormField[] = questions.map((question, index) => ({
    id: question.id || uid("field"),
    label: question.question,
    key: `qualification_${index + 1}`,
    type: question.type,
    options: question.options,
    placeholder: question.type === "textarea" || question.type === "text" ? "Conte um pouco mais…" : undefined,
    required: question.required,
    purpose: question.purpose,
  }));
  if (mode !== "explicit_choice" || !offerings.length) return fields;
  return [{
    id: uid("field"),
    label: "Qual serviço você deseja solicitar?",
    key: "qualification_preference",
    type: "select",
    options: offerings,
    required: true,
    purpose: "explicit_choice",
  }, ...fields.filter((field) => !field.required).slice(0, 1)];
}

function recommendationJourney(project: Project, session: AISetupSession) {
  const primary = session.visitorActions.find((action) => action.isPrimary) || session.visitorActions[0];
  return primary
    ? visitorActionSemanticKey(primary) === "recommendation"
    : isRecommendationIntent(project.primaryGoal);
}

function primaryDestination(project: Project, answer: string, existing: RoutingDestination[]) {
  const normalized = normalize(answer || project.primaryDestination);
  const whatsapp = existing.find((item) => item.type === "whatsapp");
  if ((normalized.includes("whatsapp") || normalize(project.primaryDestination).includes("whatsapp")) && project.phone) {
    return whatsapp || {
      id: uid("destination"),
      key: "whatsapp-primary",
      type: "whatsapp" as const,
      label: "Conversar pelo WhatsApp",
      value: project.phone,
    };
  }
  return existing.find((item) => item.type !== "unavailable");
}

function serviceOfferings(
  project: Project,
  names: string[],
  destination?: RoutingDestination,
  current: ServiceOffering[] = [],
  businessContext = "",
) {
  if (!names.length) return current;
  const currentByName = new Map(current.map((item) => [normalize(item.name), item]));
  const allNames = unique([...current.map((item) => item.name), ...names]);
  const generationContext = `${project.name} ${project.category || ""} ${businessContext} ${allNames.join(" ")}`;
  const generationContextSignature = contextSignature(`${project.id} ${generationContext}`);
  return allNames.map((name, order): ServiceOffering => {
    const existing = currentByName.get(normalize(name));
    const supportedDescription = existing?.shortDescription || existing?.description || "";
    const shortDescription = supportedDescription || conservativeServiceDescription(name);
    const recommendationSignals = inferRecommendationSignals(name, supportedDescription, generationContext);
    const strongRecommendationSignals = inferStrongRecommendationSignals(name, supportedDescription, generationContext);
    return {
      id: existing?.id || uid("offering"),
      projectId: project.id,
      name,
      slug: existing?.slug || normalize(name).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      description: existing?.description,
      shortDescription,
      serviceMode: existing?.serviceMode || "contact",
      priceMode: existing?.priceMode || "on_request",
      price: existing?.price,
      minPrice: existing?.minPrice,
      maxPrice: existing?.maxPrice,
      currency: existing?.currency || "BRL",
      imageAssetId: existing?.imageAssetId,
      destinationId: existing?.destinationId || destination?.id,
      externalUrl: existing?.externalUrl,
      isFeatured: existing?.isFeatured ?? order === 0,
      isActive: existing?.isActive ?? true,
      order,
      settings: {
        ...(existing?.settings || { source: "onboarding_confirmed" }),
        recommendationSignals,
        strongRecommendationSignals,
        descriptionSource: existing?.shortDescription || existing?.description ? "business" : "generated_conservative",
        copyProvenance: {
          projectId: project.id,
          contextSignature: generationContextSignature,
          sources: supportedDescription ? ["offer_name", "business_description"] : ["offer_name"],
        },
      },
    };
  });
}

function finalActionLabel(value: string) {
  const normalized = normalize(value);
  if (normalized.includes("avaliacao")) return "Solicitar avaliação inicial";
  if (normalized.includes("conversa")) return "Marcar uma conversa";
  if (normalized.includes("orcamento")) return "Solicitar orçamento";
  if (normalized.includes("agend")) return "Agendar atendimento";
  return "Conversar com a equipe";
}

function finalActionDescription(value: string) {
  const normalized = normalize(value);
  if (normalized.includes("avaliacao profissional")) return "Leve sua orientação e o contexto das respostas para uma avaliação profissional.";
  return "Leve sua orientação e o contexto das respostas para a equipe confirmar com você.";
}

function capabilityForStep(type: Project["steps"][number]["type"]) {
  if (type === "quote") return "quote";
  if (type === "schedule") return "scheduling";
  if (type === "routing") return "routing";
  if (type === "catalog") return "catalog_order";
  if (type === "availability") return "reservation";
  if (type === "form") return "qualification";
  return undefined;
}

function configureJourney(
  project: Project,
  quoteFields: FormField[],
  qualificationFields: FormField[],
  qualificationObjective: string,
  qualificationOutcome: string,
  completionActionContext: string,
  recommendationEnabled: boolean,
  journeyMode: JourneyMode,
  offerings: ServiceOffering[],
  destination?: RoutingDestination,
  services: SchedulableService[] = [],
) {
  const finalStep = project.steps.toSorted((a, b) => b.order - a.order).find((step) => step.type === "action");
  if (!finalStep) return project.steps;
  const existingRecommendation = project.steps.find((step) => step.type === "recommendation");
  const recommendationId = existingRecommendation?.id || uid("step");
  const prepared = project.steps.filter((step) => !recommendationEnabled || step.type !== "recommendation").map((step) => {
    const capability = capabilityForStep(step.type);
    if (step.id === finalStep.id && recommendationEnabled) {
      const options: JourneyStep["options"] = destination?.type === "whatsapp"
        ? [{
            id: step.options?.find((option) => option.actionType === "open_whatsapp")?.id || uid("option"),
            label: finalActionLabel(completionActionContext),
            value: "whatsapp",
            actionType: "open_whatsapp",
            actionPayload: { phone: destination.value || project.phone || "", destinationId: destination.id },
          }]
        : step.options;
      return {
        ...step,
        title: "Quer confirmar o melhor caminho?",
        description: finalActionDescription(qualificationOutcome),
        settings: { ...step.settings, internalInstruction: qualificationOutcome, businessObjective: qualificationObjective },
        options,
      };
    }
    if (!capability || step.id === finalStep.id) return step;
    const blocks = capability === "scheduling" && services.length
      ? [
          {
            id: uid("block"),
            type: "service_selector" as const,
            content: {
              fieldKey: "service",
              services: services.map((service) => ({
                id: service.id,
                name: service.name,
                durationMinutes: service.durationMinutes,
              })),
            },
          },
          { id: uid("block"), type: "calendar" as const, content: {} },
          ...(step.blocks?.filter((block) => block.type === "schedule_slots") || [{
            id: uid("block"),
            type: "schedule_slots" as const,
            content: {},
          }]),
        ]
      : step.blocks;
    return {
      ...step,
      blocks,
      title: capability === "qualification" && qualificationObjective ? journeyMode === "assisted_discovery" ? "Encontre o melhor caminho" : "Escolha como continuar" : step.title,
      description: capability === "qualification" && qualificationObjective
        ? journeyMode === "assisted_discovery" ? "Responda ao essencial para receber uma orientação inicial." : "Selecione a opção que você já deseja solicitar."
        : step.description,
      formFields: capability === "quote" ? quoteFields : capability === "qualification" && qualificationFields.length ? qualificationFields : step.formFields,
      settings: capability === "qualification" ? { ...step.settings, journeyMode, businessObjective: qualificationObjective } : step.settings,
      options: [{
        id: step.options?.[0]?.id || uid("option"),
        label: capability === "quote" ? "Enviar solicitação" : capability === "qualification" && recommendationEnabled ? "Ver orientação" : "Continuar",
        value: capability,
        actionType: "start_capability" as const,
        actionPayload: { capability },
        targetStepId: capability === "qualification" && recommendationEnabled ? recommendationId : finalStep.id,
      }],
    };
  });
  if (!recommendationEnabled) return prepared;
  if (!prepared.some((step) => step.type === "form") && qualificationFields.length) {
    prepared.push({
      id: uid("step"),
      type: "form",
      title: qualificationObjective ? "Encontre o melhor caminho" : "Conte o que você procura",
      description: "Responda ao essencial para receber uma orientação inicial.",
      order: Math.max(0, finalStep.order - 1),
      isActive: true,
      formFields: qualificationFields,
      blocks: [{ id: uid("block"), type: "form", content: {} }],
      settings: { journeyMode, businessObjective: qualificationObjective },
      options: [{
        id: uid("option"),
        label: "Ver orientação",
        value: "qualification",
        actionType: "start_capability",
        actionPayload: { capability: "qualification" },
        targetStepId: recommendationId,
      }],
    });
  }
  const recommendation: JourneyStep = {
    id: recommendationId,
    type: "recommendation",
    title: "Uma orientação para o seu momento",
    description: "Veja a opção mais relacionada ao que você contou e confirme o próximo passo com a equipe.",
    order: Math.max(0, finalStep.order - 0.5),
    isActive: true,
    visualVariant: "recommendation-result",
    recommendation: {
      title: offerings[0] ? `${offerings[0].name} pode fazer sentido` : "Vale conversar com a equipe antes de escolher",
      description: offerings[0]
        ? "A orientação considera as necessidades informadas antes de apresentar uma opção."
        : "As respostas serão levadas para a equipe avaliar o melhor caminho.",
      label: "Orientação inicial",
      benefits: ["Resultado baseado nas respostas", "Confirmação final com a equipe"],
    },
    settings: {
      journeyMode,
      recommendationOfferIds: offerings.map((offering) => offering.id),
      internalInstruction: qualificationOutcome,
      businessObjective: qualificationObjective,
      recommendationLogic: "answers_to_signals_to_offer",
    },
    options: [{
      id: uid("option"),
      label: finalActionLabel(completionActionContext),
      value: "continue",
      actionType: "go_to_step",
      targetStepId: finalStep.id,
    }],
  };
  return [...prepared, recommendation]
    .toSorted((a, b) => a.order - b.order)
    .map((step, order) => ({ ...step, order }));
}

export function materializeSetupAnswers(project: Project, session: AISetupSession): Project {
  const answers = session.answers;
  const quoteServices = listFromText(answerText(answers, "quote.services"));
  const qualificationOfferings = offerNamesFromSetup(session.initialInput.description, answers["qualification.offerings"]);
  const offeringNames = qualificationOfferings.length ? qualificationOfferings : quoteServices;
  const quoteFields = quoteQuestions(quoteServices);
  const qualificationObjective = answerText(answers, "qualification.objective");
  const recommends = recommendationJourney(project, session);
  const journeyMode: JourneyMode = recommends ? "assisted_discovery" : classifyJourneyMode(project.primaryGoal);
  const qualificationFields = qualificationQuestions(answers["qualification.questions"], offeringNames, journeyMode);
  const qualificationOutcome = answerText(answers, "qualification.outcome");
  const qualificationDestination = answerText(answers, "qualification.destination");
  const modeAnswer = answerText(answers, "quote.mode");
  const quoteDestination = answerText(answers, "quote.destination");
  const scheduleAnswer = answerText(answers, "scheduling.services");
  const scheduleDestination = answerText(answers, "scheduling.destination");
  const scheduleAvailability = answerText(answers, "scheduling.availability");
  const routeLocation = locationFromAnswer(project, answerText(answers, "routing.location"), scheduleAvailability);
  const routeDestinations = routingDestinations(
    project,
    answerText(answers, "routing.destinations"),
    answerText(answers, "routing.fallback"),
    routeLocation,
  );
  const currentConfig = project.commercialConfig || {};
  const destinations = currentConfig.routingDestinations || [];
  const selectedDestination = primaryDestination(project, qualificationDestination, destinations);
  const nextDestinations = selectedDestination && !destinations.some((item) => item.id === selectedDestination.id)
    ? [...destinations, selectedDestination]
    : destinations;
  const offerings = serviceOfferings(project, offeringNames, selectedDestination, currentConfig.serviceOfferings, session.initialInput.description);
  const configuredScheduleServices = scheduleAnswer
    ? schedulingServices(project, scheduleAnswer, confirmationMode(scheduleDestination), quoteServices)
    : currentConfig.schedulableServices || [];
  const next: Project = {
    ...project,
    description: synthesizePublicDescription({ businessName: project.name, primaryGoal: project.primaryGoal, offerings: offeringNames }),
    businessProfile: project.businessProfile ? {
      ...project.businessProfile,
      requiredVisitorData: answerText(answers, "quote.visitor")
        ? visitorFields(answerText(answers, "quote.visitor"))
        : project.businessProfile.requiredVisitorData,
    } : project.businessProfile,
    commercialConfig: {
      ...currentConfig,
      serviceOfferings: offerings,
      quoteDefinition: quoteServices.length || modeAnswer || quoteDestination ? {
        id: currentConfig.quoteDefinition?.id || uid("quote-definition"),
        projectId: project.id,
        title: `Orçamento de ${project.name}`,
        currency: "BRL",
        estimationMode: quoteMode(modeAnswer),
        questions: quoteFields,
        rules: currentConfig.quoteDefinition?.rules || [],
        completionChannel: completionChannel(quoteDestination, project),
        isActive: true,
      } : currentConfig.quoteDefinition,
      schedulableServices: configuredScheduleServices,
      availabilityRules: scheduleAvailability ? availabilityRules(project, scheduleAvailability) : currentConfig.availabilityRules,
      locations: routeLocation ? [routeLocation] : currentConfig.locations,
      routingDestinations: [...new Map([...routeDestinations, ...nextDestinations].map((item) => [item.id, item])).values()],
    },
    steps: configureJourney(
      project,
      quoteFields,
      qualificationFields,
      qualificationObjective,
      qualificationOutcome,
      `${qualificationOutcome} ${project.primaryGoal} ${session.initialInput.description}`,
      recommends,
      journeyMode,
      offerings,
      selectedDestination,
      configuredScheduleServices,
    ).map((step) => step.type === "welcome"
      ? { ...step, description: synthesizePublicDescription({ businessName: project.name, primaryGoal: project.primaryGoal, offerings: offeringNames }) }
      : step),
  };
  const evaluated = evaluateCapabilityRequirements(next);
  const sessionRequirements = new Map(session.missingRequirements.map((item) => [item.key, item]));
  return {
    ...next,
    dataRequirements: evaluated.map((item) => {
      const collected = sessionRequirements.get(item.key);
      return collected ? { ...item, value: collected.value, origin: collected.origin, sourceId: collected.sourceId } : item;
    }),
  };
}
