import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { evaluateCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import { uid } from "@/lib/utils";
import type {
  AvailabilityRule,
  BusinessLocation,
  CompletionChannel,
  ConfirmationMode,
  FormField,
  Project,
  RoutingDestination,
  SchedulableService,
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

function capabilityForStep(type: Project["steps"][number]["type"]) {
  if (type === "quote") return "quote";
  if (type === "schedule") return "scheduling";
  if (type === "routing") return "routing";
  if (type === "catalog") return "catalog_order";
  if (type === "availability") return "reservation";
  if (type === "form") return "qualification";
  return undefined;
}

function configureJourney(project: Project, questions: FormField[], services: SchedulableService[]) {
  const finalStep = project.steps.toSorted((a, b) => b.order - a.order).find((step) => step.type === "action");
  return project.steps.map((step) => {
    const capability = capabilityForStep(step.type);
    if (!capability || !finalStep || step.id === finalStep.id) return step;
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
      formFields: capability === "quote" ? questions : step.formFields,
      options: [{
        id: step.options?.[0]?.id || uid("option"),
        label: capability === "quote" ? "Enviar solicitação" : "Continuar",
        value: capability,
        actionType: "start_capability" as const,
        actionPayload: { capability },
        targetStepId: finalStep.id,
      }],
    };
  });
}

export function materializeSetupAnswers(project: Project, session: AISetupSession): Project {
  const answers = session.answers;
  const quoteServices = listFromText(answerText(answers, "quote.services"));
  const questions = quoteQuestions(quoteServices);
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
  const configuredScheduleServices = scheduleAnswer
    ? schedulingServices(project, scheduleAnswer, confirmationMode(scheduleDestination), quoteServices)
    : currentConfig.schedulableServices || [];
  const next: Project = {
    ...project,
    businessProfile: project.businessProfile ? {
      ...project.businessProfile,
      requiredVisitorData: answerText(answers, "quote.visitor")
        ? visitorFields(answerText(answers, "quote.visitor"))
        : project.businessProfile.requiredVisitorData,
    } : project.businessProfile,
    commercialConfig: {
      ...currentConfig,
      quoteDefinition: quoteServices.length || modeAnswer || quoteDestination ? {
        id: currentConfig.quoteDefinition?.id || uid("quote-definition"),
        projectId: project.id,
        title: `Orçamento de ${project.name}`,
        currency: "BRL",
        estimationMode: quoteMode(modeAnswer),
        questions,
        rules: currentConfig.quoteDefinition?.rules || [],
        completionChannel: completionChannel(quoteDestination, project),
        isActive: true,
      } : currentConfig.quoteDefinition,
      schedulableServices: configuredScheduleServices,
      availabilityRules: scheduleAvailability ? availabilityRules(project, scheduleAvailability) : currentConfig.availabilityRules,
      locations: routeLocation ? [routeLocation] : currentConfig.locations,
      routingDestinations: routeDestinations.length ? routeDestinations : currentConfig.routingDestinations,
    },
    steps: configureJourney(project, questions, configuredScheduleServices),
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
