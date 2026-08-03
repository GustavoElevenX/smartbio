import { slugify, uid } from "@/lib/utils";
import type {
  AvailabilityRule,
  BusinessCapabilityProfile,
  CatalogCategory,
  CatalogItem,
  ExperienceCompositionInput,
  JourneyStep,
  Project,
  ProjectCapability,
  QualificationRule,
  QuoteDefinition,
  ReservableUnit,
  RoutingDestination,
  RoutingRule,
  SchedulableResource,
  SchedulableService,
} from "@/types";

export type CommercialConfig = NonNullable<Project["commercialConfig"]>;
export interface JourneyComposition { steps: JourneyStep[]; commercialConfig: CommercialConfig }

const capabilityCopy: Record<ProjectCapability["key"], { label: string; description: string; icon: string }> = {
  qualification: { label: "Receber uma recomendação", description: "Responda e veja o próximo passo ideal", icon: "Target" },
  quote: { label: "Pedir orçamento", description: "Envie os detalhes para receber uma estimativa", icon: "FileText" },
  scheduling: { label: "Escolher um horário", description: "Consulte a agenda disponível", icon: "CalendarCheck" },
  catalog_order: { label: "Ver opções e pedir", description: "Monte seu pedido em poucos passos", icon: "ShoppingBag" },
  reservation: { label: "Consultar disponibilidade", description: "Escolha datas e veja as opções", icon: "CalendarCheck" },
  routing: { label: "Encontrar o atendimento certo", description: "Direcionamos você para a melhor unidade", icon: "MapPin" },
  payment: { label: "Continuar para pagamento", description: "Abra o checkout seguro do negócio", icon: "ArrowUpRight" },
};

function visitorFields(profile: BusinessCapabilityProfile) {
  const labels: Record<string, string> = { name: "Nome", phone: "WhatsApp", email: "E-mail", company: "Empresa", location: "Bairro ou cidade" };
  return profile.requiredVisitorData.slice(0, 5).map((key) => ({
    id: uid("field"),
    label: labels[key] || key,
    key,
    type: key === "email" ? "email" as const : key === "phone" ? "phone" as const : "text" as const,
    required: ["name", "phone", "email"].includes(key),
  }));
}

function actionStep(input: ExperienceCompositionInput, order: number): JourneyStep {
  return {
    id: uid("step"),
    type: "action",
    title: "Tudo pronto para o próximo passo.",
    description: "Seu contexto vai junto para o atendimento.",
    order,
    isActive: true,
    visualVariant: "conversion",
    options: [
      input.primaryDestination === "WhatsApp"
        ? { id: uid("option"), label: "Continuar no WhatsApp", value: "whatsapp", icon: "MessageCircle", actionType: "open_whatsapp", actionPayload: { phone: input.phone || "5511999999999" } }
        : { id: uid("option"), label: `Continuar por ${input.primaryDestination}`, value: "primary", icon: "ArrowUpRight", actionType: "open_url", actionPayload: { url: input.websiteUrl || "https://example.com" } },
      { id: uid("option"), label: "Enviar meus dados", value: "lead", icon: "Mail", actionType: "submit_form" },
    ],
  };
}

export class RuleBasedJourneyComposer {
  compose(input: ExperienceCompositionInput, profile: BusinessCapabilityProfile, capabilities: ProjectCapability[]): JourneyComposition {
    const active = capabilities.filter((capability) => capability.enabled);
    const usable = active.length ? active : capabilities.slice(0, 1);
    const firstStepId = uid("step");
    const entries = new Map<ProjectCapability["key"], string>();
    usable.forEach((capability) => entries.set(capability.key, uid("step")));
    const steps: JourneyStep[] = [{
      id: firstStepId,
      type: "choice",
      title: "O que você quer fazer agora?",
      description: `Escolha seu objetivo e ${input.businessName} conduz você ao melhor próximo passo.`,
      order: 0,
      isActive: true,
      visualVariant: "commercial-intent",
      blocks: [{ id: uid("block"), type: "choice_grid", variant: "brand-composed" }],
      options: usable.map((capability) => ({
        id: uid("option"),
        ...capabilityCopy[capability.key],
        value: capability.key,
        actionType: "go_to_step",
        targetStepId: entries.get(capability.key),
      })),
    }];
    const commercialConfig: CommercialConfig = {};

    for (const capability of usable) {
      const entryId = entries.get(capability.key)!;
      if (capability.key === "qualification") {
        const recommendationId = uid("step");
        const rules: QualificationRule[] = [
          { id: uid("rule"), projectId: "pending", condition: { field: "investimento", operator: "contains", value: "acima" }, scoreDelta: 40, recommendationKey: "diagnostico-prioritario", reason: "Investimento compatível com acompanhamento dedicado." },
          { id: uid("rule"), projectId: "pending", condition: { field: "urgencia", operator: "equals", value: "Agora" }, scoreDelta: 20, reason: "Necessidade imediata informada." },
          { id: uid("rule"), projectId: "pending", condition: { field: "porte", operator: "greater_than", value: 10 }, scoreDelta: 20, reason: "Operação com escala para a solução." },
        ];
        commercialConfig.qualificationRules = rules;
        steps.push({ id: entryId, type: "form", title: "Vamos entender seu momento.", description: "Respostas rápidas deixam a recomendação mais útil.", order: steps.length, isActive: true, visualVariant: "qualification", formFields: [
          { id: uid("field"), label: "Principal objetivo", key: "objetivo", type: "select", required: true, options: ["Gerar demanda", "Aumentar vendas", "Ganhar eficiência", "Outro"] },
          { id: uid("field"), label: "Tamanho da operação", key: "porte", type: "number", required: true, placeholder: "Número de pessoas" },
          { id: uid("field"), label: "Faixa de investimento", key: "investimento", type: "select", required: true, options: ["Até R$ 3 mil", "R$ 3–10 mil", "R$ 10–30 mil", "Acima de R$ 30 mil"] },
          { id: uid("field"), label: "Quando quer começar?", key: "urgencia", type: "radio", required: true, options: ["Agora", "Neste trimestre", "Estou pesquisando"] },
        ], options: [{ id: uid("option"), label: "Ver recomendação", value: "recommendation", actionType: "go_to_step", targetStepId: recommendationId }] });
        steps.push({ id: recommendationId, type: "recommendation", title: "Uma recomendação para o seu momento.", description: "A decisão considera objetivo, porte, investimento e urgência.", order: steps.length, isActive: true, recommendation: { title: `Diagnóstico ${input.businessName}`, description: input.businessDescription, label: "Próximo passo sugerido", benefits: ["Contexto preservado", "Prioridade comercial clara", "Atendimento mais objetivo"] }, options: [{ id: uid("option"), label: "Continuar", value: "continue", actionType: "go_to_step", targetStepId: "__action__" }] });
      }

      if (capability.key === "quote") {
        const summaryId = uid("step");
        const definition: QuoteDefinition = {
          id: uid("quote-definition"), projectId: "pending", title: `Orçamento ${input.businessName}`, currency: "BRL", baseAmount: 120, estimationMode: "range",
          questions: [
            { id: uid("field"), label: "O que precisa ser atendido?", key: "servico", type: "select", required: true, options: ["Sofá", "Colchão", "Cadeiras", "Veículo", "Outro"] },
            { id: uid("field"), label: "Quantidade", key: "quantidade", type: "number", required: true },
            { id: uid("field"), label: "Bairro ou cidade", key: "bairro", type: "text", required: true },
            { id: uid("field"), label: "Urgência", key: "urgencia", type: "radio", required: true, options: ["Hoje", "Nesta semana", "Sem urgência"] },
          ],
          rules: [
            { id: uid("quote-rule"), condition: { field: "quantidade", operator: "greater_than", value: 1 }, operation: "multiply", amount: 1.65 },
            { id: uid("quote-rule"), condition: { field: "urgencia", operator: "equals", value: "Hoje" }, operation: "add", amount: 80 },
            { id: uid("quote-rule"), condition: { field: "servico", operator: "equals", value: "Veículo" }, operation: "range", minAmount: 160, maxAmount: 280 },
          ], completionChannel: profile.completionChannel, isActive: true,
        };
        commercialConfig.quoteDefinition = definition;
        steps.push({ id: entryId, type: "quote", title: "Conte o que você precisa.", description: "Com esses detalhes conseguimos estimar e avaliar o serviço.", order: steps.length, isActive: true, visualVariant: "quote-request", blocks: [
          { id: uid("block"), type: "service_selector", content: { fieldKey: "servico", options: definition.questions[0].options } },
          { id: uid("block"), type: "quantity_selector", content: { fieldKey: "quantidade", min: 1, max: 20 } },
          { id: uid("block"), type: "media_upload", content: { fieldKey: "fotos", maxFiles: 4, required: profile.requiresMediaUpload } },
        ], formFields: definition.questions.slice(2), options: [{ id: uid("option"), label: "Calcular estimativa", value: "estimate", actionType: "go_to_step", targetStepId: summaryId }] });
        steps.push({ id: summaryId, type: "confirmation", title: "Revise seu pedido de orçamento.", description: "A estimativa será confirmada após a avaliação final.", order: steps.length, isActive: true, blocks: [{ id: uid("block"), type: "price_estimate" }, { id: uid("block"), type: "quote_summary" }], formFields: visitorFields(profile), options: [{ id: uid("option"), label: "Enviar orçamento", value: "submit-quote", actionType: "start_capability", actionPayload: { capability: "quote" } }] });
      }

      if (capability.key === "scheduling") {
        const confirmationId = uid("step");
        const service: SchedulableService = { id: uid("service"), projectId: "pending", name: "Atendimento inicial", durationMinutes: 45, bufferBeforeMinutes: 0, bufferAfterMinutes: 15, capacity: 1, confirmationMode: profile.confirmationMode, isActive: true };
        const resource: SchedulableResource = { id: uid("resource"), projectId: "pending", name: "Especialista disponível", kind: "professional", isActive: true };
        const availabilityRules: AvailabilityRule[] = [1, 2, 3, 4, 5].map((weekday) => ({ id: uid("availability"), projectId: "pending", resourceId: resource.id, weekday, startTime: "09:00", endTime: "18:00", timezone: "America/Sao_Paulo" }));
        commercialConfig.schedulableServices = [service]; commercialConfig.resources = [resource]; commercialConfig.availabilityRules = availabilityRules;
        steps.push({ id: entryId, type: "schedule", title: "Escolha o melhor horário.", description: "A disponibilidade é calculada antes da confirmação.", order: steps.length, isActive: true, blocks: [
          { id: uid("block"), type: "service_selector", content: { services: [{ id: service.id, name: service.name, durationMinutes: service.durationMinutes }] } },
          { id: uid("block"), type: "resource_selector", content: { resources: [{ id: resource.id, name: resource.name }] } },
          { id: uid("block"), type: "calendar" },
          { id: uid("block"), type: "schedule_slots" },
        ], options: [{ id: uid("option"), label: "Revisar agendamento", value: "review-booking", actionType: "go_to_step", targetStepId: confirmationId }] });
        steps.push({ id: confirmationId, type: "confirmation", title: "Confirme seus dados.", description: profile.confirmationMode === "instant" ? "O horário será confirmado imediatamente." : "O negócio aprovará a solicitação.", order: steps.length, isActive: true, blocks: [{ id: uid("block"), type: "booking_summary" }], formFields: visitorFields(profile), options: [{ id: uid("option"), label: "Solicitar agendamento", value: "submit-booking", actionType: "start_capability", actionPayload: { capability: "scheduling" } }] });
      }

      if (capability.key === "catalog_order") {
        const category: CatalogCategory = { id: uid("category"), projectId: "pending", name: "Destaques", order: 0, isActive: true };
        const items: CatalogItem[] = [
          { id: uid("item"), projectId: "pending", categoryId: category.id, name: "Opção Essencial", description: "A escolha mais prática para começar.", price: 24, currency: "BRL", isAvailable: true, variants: [], metadata: { emoji: "✨" } },
          { id: uid("item"), projectId: "pending", categoryId: category.id, name: "Opção Completa", description: "Mais benefícios em uma única escolha.", price: 39, currency: "BRL", isAvailable: true, variants: [{ id: uid("variant"), name: "Grande", priceDelta: 8, isAvailable: true }], metadata: { emoji: "⭐" } },
        ];
        commercialConfig.catalogCategories = [category]; commercialConfig.catalogItems = items;
        steps.push({ id: entryId, type: "catalog", title: "Escolha o que combina com você.", description: "Itens disponíveis agora para pedido.", order: steps.length, isActive: true, blocks: [{ id: uid("block"), type: "fulfillment_selector" }, { id: uid("block"), type: "catalog_categories" }, { id: uid("block"), type: "catalog_item_cards" }, { id: uid("block"), type: "cart_summary" }], formFields: [{ id: uid("field"), label: "Observação", key: "order_notes", type: "textarea", required: false }], options: [{ id: uid("option"), label: "Enviar pedido", value: "submit-order", actionType: "start_capability", actionPayload: { capability: "catalog_order" } }] });
      }

      if (capability.key === "reservation") {
        const unit: ReservableUnit = { id: uid("unit"), projectId: "pending", name: "Unidade disponível", description: "Conforto e uma experiência alinhada ao seu momento.", capacityAdults: 2, capacityChildren: 2, quantity: 2, basePrice: 390, currency: "BRL", isActive: true, mediaAssetIds: [], amenities: ["Wi-Fi", "Estacionamento", "Café da manhã"] };
        commercialConfig.reservableUnits = [unit]; commercialConfig.reservationBlocks = [];
        steps.push({ id: entryId, type: "availability", title: "Quando você quer reservar?", description: "Consulte datas e capacidade antes de solicitar.", order: steps.length, isActive: true, blocks: [{ id: uid("block"), type: "date_range" }, { id: uid("block"), type: "guest_selector" }, { id: uid("block"), type: "availability_results" }, { id: uid("block"), type: "reservable_unit_cards" }, { id: uid("block"), type: "policy_card", content: { text: "Cancelamento solicitado pelo visitante e confirmado pelo negócio." } }, { id: uid("block"), type: "deposit_card", content: { percent: 30 } }, { id: uid("block"), type: "booking_summary" }], formFields: visitorFields(profile), options: [{ id: uid("option"), label: "Solicitar reserva", value: "submit-reservation", actionType: "start_capability", actionPayload: { capability: "reservation" } }] });
      }

      if (capability.key === "routing") {
        const destinations: RoutingDestination[] = [
          { id: uid("destination"), key: "centro", type: "location", label: "Unidade Centro", value: input.phone || "5511999999999" },
          { id: uid("destination"), key: "zona-sul", type: "location", label: "Unidade Zona Sul", value: input.phone || "5511999999999" },
        ];
        const rules: RoutingRule[] = [
          { id: uid("routing-rule"), projectId: "pending", priority: 1, condition: { field: "location", operator: "contains", value: "centro" }, destinationId: destinations[0].id, isActive: true },
          { id: uid("routing-rule"), projectId: "pending", priority: 2, condition: { field: "location", operator: "contains", value: "sul" }, destinationId: destinations[1].id, isActive: true },
        ];
        commercialConfig.routingDestinations = destinations; commercialConfig.routingRules = rules;
        steps.push({ id: entryId, type: "routing", title: "Onde você quer ser atendido?", description: "Usamos sua região para escolher o destino certo.", order: steps.length, isActive: true, blocks: [{ id: uid("block"), type: "location_selector", content: { fieldKey: "location", options: ["Centro", "Zona Sul", "Outra região"] } }, { id: uid("block"), type: "route_result" }], options: [{ id: uid("option"), label: "Encontrar atendimento", value: "resolve-route", actionType: "start_capability", actionPayload: { capability: "routing" } }] });
      }

      if (capability.key === "payment") {
        commercialConfig.paymentUrl = input.websiteUrl || "https://example.com/checkout";
        steps.push({ id: entryId, type: "action", title: "Continue para o ambiente de pagamento.", description: "O pagamento acontece no provedor conectado ao negócio.", order: steps.length, isActive: true, blocks: [{ id: uid("block"), type: "deposit_card", content: { external: true } }], options: [{ id: uid("option"), label: "Abrir pagamento seguro", value: "payment", actionType: "open_url", actionPayload: { url: commercialConfig.paymentUrl } }] });
      }
    }

    const finalAction = actionStep(input, steps.length);
    const finalActionId = finalAction.id;
    for (const step of steps) {
      step.options = step.options?.map((option) => option.targetStepId === "__action__" ? { ...option, targetStepId: finalActionId } : option);
    }
    steps.push(finalAction);
    return { steps: steps.map((step, order) => ({ ...step, order })), commercialConfig };
  }
}

export const journeyComposer = new RuleBasedJourneyComposer();

export function assignProjectToCommercialConfig(config: CommercialConfig, projectId: string): CommercialConfig {
  const copy = structuredClone(config);
  for (const rule of copy.qualificationRules || []) rule.projectId = projectId;
  if (copy.quoteDefinition) copy.quoteDefinition.projectId = projectId;
  for (const item of copy.schedulableServices || []) item.projectId = projectId;
  for (const item of copy.resources || []) item.projectId = projectId;
  for (const item of copy.availabilityRules || []) item.projectId = projectId;
  for (const item of copy.availabilityExceptions || []) item.projectId = projectId;
  for (const item of copy.catalogCategories || []) item.projectId = projectId;
  for (const item of copy.catalogItems || []) item.projectId = projectId;
  for (const item of copy.reservableUnits || []) item.projectId = projectId;
  for (const item of copy.reservationBlocks || []) item.projectId = projectId;
  for (const item of copy.locations || []) item.projectId = projectId;
  for (const item of copy.routingRules || []) item.projectId = projectId;
  return copy;
}

export function defaultSlug(input: ExperienceCompositionInput) {
  return slugify(input.slug || input.businessName);
}
