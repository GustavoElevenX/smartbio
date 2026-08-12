import { buildPalette } from "@/features/brand-intelligence/colors";
import type {
  BusinessCapabilityProfile,
  Project,
  ProjectCapability,
  ProjectDesignSystem,
} from "@/types";

const mixPalette = buildPalette(["#E62E2D", "#FFD33D", "#FF7A1A"], "faithful");
mixPalette.background = "#FFF8EF";
mixPalette.surface = "#FFFFFF";
mixPalette.foreground = "#2B1712";
mixPalette.muted = "#FFEFD6";
mixPalette.border = "#F5D9BB";
const verticePalette = buildPalette(["#FF6A00", "#FFB066", "#F4F4F5"], "bold");
verticePalette.background = "#090909";
verticePalette.surface = "#151515";
verticePalette.surfaceElevated = "#1C1C1C";
verticePalette.foreground = "#FAFAFA";
verticePalette.muted = "#242424";
verticePalette.mutedForeground = "#ADADAD";
verticePalette.border = "#303030";
const cleanPalette = buildPalette(
  ["#176B64", "#9AD9D3", "#F4FBFA"],
  "balanced",
);
cleanPalette.background = "#F4FBFA";
cleanPalette.surface = "#FFFFFF";
cleanPalette.foreground = "#15312F";
cleanPalette.muted = "#E2F4F1";
cleanPalette.border = "#C9E7E3";
const clinicPalette = buildPalette(
  ["#7C5CFC", "#DCCFFF", "#FCFAFF"],
  "balanced",
);
clinicPalette.background = "#FCFAFF";
clinicPalette.surface = "#FFFFFF";
clinicPalette.foreground = "#28213C";
clinicPalette.muted = "#F0EBFF";
clinicPalette.border = "#E3DAFA";
const chaletPalette = buildPalette(
  ["#315A45", "#D6A85F", "#F6F1E7"],
  "faithful",
);
chaletPalette.background = "#F6F1E7";
chaletPalette.surface = "#FFFCF5";
chaletPalette.foreground = "#24352C";
chaletPalette.muted = "#E9E2D2";
chaletPalette.border = "#DDD1BB";
const networkPalette = buildPalette(
  ["#155EEF", "#53B1FD", "#F5F8FF"],
  "balanced",
);
networkPalette.background = "#F5F8FF";
networkPalette.surface = "#FFFFFF";
networkPalette.foreground = "#17243D";
networkPalette.muted = "#E8F0FF";
networkPalette.border = "#D5E2FA";

function design(
  colors: typeof mixPalette,
  kind: "mix" | "vertice",
): ProjectDesignSystem {
  const dark = kind === "vertice";
  return {
    mode: dark ? "dark" : "light",
    colors,
    typography: {
      headingFont: dark ? "Manrope" : "Plus Jakarta Sans",
      bodyFont: "Inter",
      headingWeight: dark ? 700 : 800,
      bodyWeight: 450,
      scale: "expressive",
    },
    shape: {
      cardRadius: dark ? 18 : 26,
      buttonRadius: dark ? 12 : 99,
      inputRadius: 14,
      borderWidth: 1,
    },
    elevation: {
      cardShadow: dark
        ? "0 24px 80px rgba(255,106,0,.08)"
        : "0 18px 44px rgba(139,51,24,.12)",
      floatingShadow: "0 30px 90px rgba(0,0,0,.22)",
      glowColor: colors.primary,
      glowIntensity: dark ? 0.28 : 0.1,
    },
    spacing: {
      density: dark ? "balanced" : "spacious",
      sectionGap: 30,
      cardGap: 12,
    },
    imagery: {
      decorativeStyle: dark ? "technical-grid" : "fruit-orbs",
      overlayOpacity: 0.15,
    },
    motion: {
      transition: dark ? "slide" : "scale",
      duration: 320,
      cardHover: true,
    },
    buttons: {
      style: dark ? "gradient" : "solid",
      height: "large",
      iconPosition: "right",
    },
    cards: {
      style: dark ? "glass" : "elevated",
      borderColor: colors.border,
      surfaceOpacity: dark ? 0.84 : 1,
    },
  };
}

const now = "2026-08-01T12:00:00.000Z";

function capability(key: ProjectCapability["key"]): ProjectCapability {
  return {
    key,
    enabled: true,
    source: "suggested",
    version: 1,
    configuration: {},
  };
}

function profile(
  patch: Partial<BusinessCapabilityProfile>,
): BusinessCapabilityProfile {
  return {
    offerKinds: ["service"],
    primaryIntents: ["contact"],
    secondaryIntents: [],
    confirmationMode: "manual_approval",
    capacityKinds: ["none"],
    hasMultipleLocations: false,
    requiresQualification: false,
    requiresMediaUpload: false,
    requiresPayment: false,
    allowsCancellationRequest: true,
    allowsRescheduleRequest: true,
    completionChannel: "whatsapp",
    requiredVisitorData: ["name", "phone"],
    businessRules: [],
    analysisMetadata: {
      source: "rules",
      confidence: 0.94,
      reasons: ["Fixture de aceitação comercial."],
      analyzedAt: now,
    },
    ...patch,
  };
}

export const casaDeSucos: Project = {
  id: "demo-casa-sucos",
  workspaceId: "demo-workspace",
  name: "Casa de Sucos Mix",
  slug: "casadesucosmix",
  description: "Sucos naturais, saladas de frutas e combos preparados na hora.",
  subtitle: "Feito na hora, do seu jeito.",
  status: "published",
  primaryGoal: "Receber pedidos",
  primaryDestination: "WhatsApp",
  category: "Alimentação",
  phone: "5511999991001",
  visualDirection: "Composição vibrante",
  brand: {
    extractedColors: ["#E62E2D", "#FFD33D", "#FF7A1A"],
    activePalette: mixPalette,
    paletteVariations: [],
    brandPersonality: ["Vibrante", "Orgânica"],
    analysisMetadata: {
      confidence: 0.94,
      orientation: "horizontal",
      luminance: "mixed",
      colorCount: 3,
    },
  },
  designSystem: design(mixPalette, "mix"),
  version: 5,
  createdAt: now,
  updatedAt: now,
  publishedAt: now,
  conversionGoals: [
    {
      id: "mix-goal-order",
      projectId: "demo-casa-sucos",
      name: "Pedir agora",
      description: "Escolher produtos e enviar o pedido.",
      kind: "buy",
      targetStepId: "mix-receive",
      destinationLabel: "Pedido",
      isPrimary: true,
      isActive: true,
      order: 0,
    },
    {
      id: "mix-goal-resale",
      projectId: "demo-casa-sucos",
      name: "Comprar para revenda",
      description: "Informar volume e receber o caminho comercial.",
      kind: "request_quote",
      targetStepId: "mix-b2b-form",
      destinationLabel: "Atendimento comercial",
      isPrimary: false,
      isActive: true,
      order: 1,
    },
    {
      id: "mix-goal-unit",
      projectId: "demo-casa-sucos",
      name: "Encontrar uma unidade",
      description: "Descobrir a unidade mais adequada.",
      kind: "visit",
      targetStepId: "mix-unit",
      destinationLabel: "Unidade",
      isPrimary: false,
      isActive: true,
      order: 2,
    },
  ],
  entryPoints: [
    {
      id: "mix-entry-bio",
      projectId: "demo-casa-sucos",
      key: "bio",
      name: "Bio",
      channel: "bio",
      conversionGoalId: "mix-goal-order",
      utmSource: "instagram",
      utmMedium: "social",
      isActive: true,
    },
    {
      id: "mix-entry-story",
      projectId: "demo-casa-sucos",
      key: "story-delivery",
      name: "Story Delivery",
      channel: "story",
      conversionGoalId: "mix-goal-order",
      utmSource: "instagram",
      utmMedium: "story",
      utmCampaign: "delivery",
      isActive: true,
    },
    {
      id: "mix-entry-meta",
      projectId: "demo-casa-sucos",
      key: "meta-revenda",
      name: "Meta Revenda",
      channel: "ad",
      conversionGoalId: "mix-goal-resale",
      utmSource: "meta",
      utmMedium: "paid_social",
      utmCampaign: "revenda",
      isActive: true,
    },
    {
      id: "mix-entry-qr",
      projectId: "demo-casa-sucos",
      key: "qr-cohama",
      name: "QR Cohama",
      channel: "qr",
      conversionGoalId: "mix-goal-unit",
      utmSource: "qr",
      utmMedium: "offline",
      utmCampaign: "cohama",
      isActive: true,
    },
  ],
  businessProfile: profile({
    offerKinds: ["physical_product"],
    primaryIntents: ["order"],
    capacityKinds: ["inventory", "location"],
    hasMultipleLocations: true,
    confirmationMode: "instant",
    completionChannel: "native",
  }),
  capabilities: [capability("catalog_order"), capability("routing")],
  commercialConfig: {
    catalogCategories: [
      {
        id: "10000000-0000-4000-8000-000000000101",
        projectId: "demo-casa-sucos",
        name: "Favoritos",
        order: 0,
        isActive: true,
      },
    ],
    catalogItems: [
      {
        id: "10000000-0000-4000-8000-000000000111",
        projectId: "demo-casa-sucos",
        categoryId: "10000000-0000-4000-8000-000000000101",
        name: "Suco natural",
        description: "Feito na hora",
        price: 12,
        currency: "BRL",
        isAvailable: true,
        variants: [],
        metadata: { emoji: "🍊" },
      },
      {
        id: "10000000-0000-4000-8000-000000000112",
        projectId: "demo-casa-sucos",
        categoryId: "10000000-0000-4000-8000-000000000101",
        name: "Salada de frutas",
        price: 16,
        currency: "BRL",
        isAvailable: true,
        variants: [],
        metadata: { emoji: "🍓" },
      },
      {
        id: "10000000-0000-4000-8000-000000000113",
        projectId: "demo-casa-sucos",
        categoryId: "10000000-0000-4000-8000-000000000101",
        name: "Combo do dia",
        price: 24,
        currency: "BRL",
        isAvailable: true,
        variants: [],
        metadata: { emoji: "🥭" },
      },
    ],
  },
  steps: [
    {
      id: "mix-intent",
      type: "choice",
      title: "O que você quer fazer hoje?",
      description: "A gente te leva para o melhor próximo passo.",
      order: 0,
      isActive: true,
      visualVariant: "fruit-hero",
      blocks: [
        { id: "mix-choice", type: "choice_grid", variant: "pill-products" },
      ],
      options: [
        {
          id: "mix-order",
          label: "Pedir agora",
          description: "Delivery ou retirada",
          icon: "ShoppingBag",
          value: "pedido",
          actionType: "go_to_step",
          targetStepId: "mix-receive",
        },
        {
          id: "mix-menu",
          label: "Ver cardápio",
          description: "Conheça os favoritos",
          icon: "BookOpen",
          value: "cardapio",
          actionType: "go_to_step",
          targetStepId: "mix-products",
        },
        {
          id: "mix-location",
          label: "Encontrar unidade",
          description: "A mais perto de você",
          icon: "MapPin",
          value: "unidade",
          actionType: "go_to_step",
          targetStepId: "mix-unit",
        },
        {
          id: "mix-b2b",
          label: "Comprar para minha empresa",
          description: "Condições para negócios",
          icon: "Building2",
          value: "empresa",
          actionType: "go_to_step",
          targetStepId: "mix-b2b-form",
        },
      ],
    },
    {
      id: "mix-receive",
      type: "choice",
      title: "Como deseja receber?",
      description: "Escolha o que combina com o seu momento.",
      order: 1,
      isActive: true,
      visualVariant: "delivery-split",
      options: [
        {
          id: "mix-delivery",
          label: "Delivery",
          description: "Receba onde estiver",
          icon: "Bike",
          value: "delivery",
          actionType: "go_to_step",
          targetStepId: "mix-unit",
        },
        {
          id: "mix-pickup",
          label: "Retirada",
          description: "Passe e pegue sem fila",
          icon: "Store",
          value: "retirada",
          actionType: "go_to_step",
          targetStepId: "mix-unit",
        },
      ],
    },
    {
      id: "mix-unit",
      type: "content",
      title: "A unidade mais rápida para você",
      description: "Calculamos a melhor opção para continuar.",
      order: 2,
      isActive: true,
      visualVariant: "map-card",
      blocks: [
        {
          id: "mix-location-card",
          type: "location_card",
          content: {
            name: "Golden Shopping",
            eta: "12 min",
            status: "aberta agora",
            address: "Av. Central, 550",
          },
        },
      ],
      options: [
        {
          id: "mix-unit-next",
          label: "Ver produtos",
          value: "produtos",
          actionType: "go_to_step",
          targetStepId: "mix-products",
        },
        {
          id: "mix-unit-change",
          label: "Trocar unidade",
          value: "trocar",
          actionType: "go_to_step",
          targetStepId: "mix-intent",
        },
      ],
    },
    {
      id: "mix-products",
      type: "catalog",
      title: "O sabor que combina com hoje",
      description: "Escolha seus favoritos e envie o pedido.",
      order: 3,
      isActive: true,
      visualVariant: "product-showcase",
      blocks: [
        { id: "mix-products-block", type: "catalog_item_cards" },
        { id: "mix-fulfillment", type: "fulfillment_selector" },
        { id: "mix-cart", type: "cart_summary" },
      ],
      options: [
        {
          id: "mix-order-final",
          label: "Enviar pedido",
          icon: "ArrowRight",
          value: "continuar",
          actionType: "start_capability",
          actionPayload: { capability: "catalog_order" },
        },
      ],
    },
    {
      id: "mix-b2b-form",
      type: "form",
      title: "Vamos montar a melhor opção para sua empresa.",
      description: "Três respostas rápidas e nosso time continua com contexto.",
      order: 4,
      isActive: true,
      visualVariant: "b2b-warm",
      formFields: [
        {
          id: "mix-business",
          label: "Seu negócio é",
          key: "negocio",
          type: "select",
          required: true,
          options: ["Escritório", "Academia", "Evento", "Restaurante", "Outro"],
        },
        {
          id: "mix-volume",
          label: "Volume estimado",
          key: "volume",
          type: "radio",
          required: true,
          options: ["Até 30 unidades", "31–100 unidades", "Mais de 100"],
        },
        {
          id: "mix-contact",
          label: "Como prefere continuar",
          key: "contato",
          type: "radio",
          required: true,
          options: ["WhatsApp", "Receber proposta"],
        },
      ],
      options: [
        {
          id: "mix-b2b-result-next",
          label: "Ver sugestão",
          value: "resultado",
          actionType: "go_to_step",
          targetStepId: "mix-b2b-result",
        },
      ],
    },
    {
      id: "mix-b2b-result",
      type: "recommendation",
      title: "Sua operação combina com nosso atendimento empresarial.",
      description:
        "A unidade Centro pode preparar seu pedido com condição especial.",
      order: 5,
      isActive: true,
      visualVariant: "business-result",
      recommendation: {
        title: "Mix Empresas",
        description:
          "Produção programada, entrega recorrente e atendimento comercial dedicado.",
        label: "Sugestão para o seu volume",
        benefits: [
          "Entrega programada",
          "Combinações personalizadas",
          "Faturamento para empresas",
        ],
        deliverables: [
          "Unidade: Centro",
          "Atendimento: seg–sex",
          "Retorno em até 30 min",
        ],
      },
      options: [
        {
          id: "mix-b2b-wa",
          label: "Falar com atendimento comercial",
          value: "whatsapp",
          actionType: "open_whatsapp",
          actionPayload: { phone: "5511999992002" },
        },
      ],
    },
  ],
};

export const verticeB2B: Project = {
  id: "demo-vertice",
  workspaceId: "demo-workspace",
  name: "Vértice B2B",
  slug: "vertice",
  description:
    "Estratégia de crescimento para empresas B2B que precisam gerar demanda previsível.",
  subtitle: "Estratégia, mídia e conteúdo conectados à receita.",
  status: "published",
  primaryGoal: "Gerar leads",
  primaryDestination: "WhatsApp",
  category: "Agência B2B",
  phone: "5511988884004",
  visualDirection: "Fundo escuro premium",
  brand: {
    extractedColors: ["#FF6A00", "#F4F4F5", "#101010"],
    activePalette: verticePalette,
    paletteVariations: [],
    brandPersonality: ["Premium", "Tecnológica"],
    analysisMetadata: {
      confidence: 0.96,
      orientation: "horizontal",
      luminance: "dark",
      colorCount: 3,
    },
  },
  designSystem: design(verticePalette, "vertice"),
  version: 6,
  createdAt: now,
  updatedAt: now,
  publishedAt: now,
  conversionGoals: [
    {
      id: "vertice-goal-diagnosis",
      projectId: "demo-vertice",
      name: "Solicitar diagnóstico",
      description: "Qualificar o cenário e recomendar o próximo passo.",
      kind: "request_quote",
      targetStepId: "vertice-form",
      destinationLabel: "Diagnóstico",
      isPrimary: true,
      isActive: true,
      order: 0,
    },
    {
      id: "vertice-goal-contact",
      projectId: "demo-vertice",
      name: "Falar com especialista",
      description: "Ir para o atendimento com contexto.",
      kind: "contact",
      targetStepId: "vertice-action",
      destinationLabel: "Atendimento",
      isPrimary: false,
      isActive: true,
      order: 1,
    },
  ],
  entryPoints: [
    {
      id: "vertice-entry-bio",
      projectId: "demo-vertice",
      key: "bio",
      name: "Bio",
      channel: "bio",
      conversionGoalId: "vertice-goal-diagnosis",
      utmSource: "instagram",
      utmMedium: "social",
      isActive: true,
    },
    {
      id: "vertice-entry-meta",
      projectId: "demo-vertice",
      key: "meta-ads",
      name: "Meta Ads",
      channel: "ad",
      conversionGoalId: "vertice-goal-diagnosis",
      utmSource: "meta",
      utmMedium: "paid_social",
      utmCampaign: "diagnostico",
      isActive: true,
    },
    {
      id: "vertice-entry-linkedin",
      projectId: "demo-vertice",
      key: "linkedin",
      name: "LinkedIn",
      channel: "linkedin",
      conversionGoalId: "vertice-goal-contact",
      utmSource: "linkedin",
      utmMedium: "organic_social",
      isActive: true,
    },
  ],
  businessProfile: profile({
    offerKinds: ["professional_service"],
    primaryIntents: ["request_proposal", "schedule"],
    capacityKinds: ["time_slot", "professional"],
    requiresQualification: true,
    confirmationMode: "manual_approval",
    completionChannel: "native",
    requiredVisitorData: ["name", "email", "phone", "company"],
  }),
  capabilities: [capability("qualification"), capability("scheduling")],
  commercialConfig: {
    qualificationRules: [
      {
        id: "20000000-0000-4000-8000-000000000201",
        projectId: "demo-vertice",
        condition: {
          field: "investimento",
          operator: "contains",
          value: "Acima",
        },
        scoreDelta: 60,
        recommendationKey: "estrategia-crescimento",
        reason: "Investimento compatível com operação consultiva.",
      },
    ],
    schedulableServices: [
      {
        id: "20000000-0000-4000-8000-000000000211",
        projectId: "demo-vertice",
        name: "Diagnóstico estratégico",
        durationMinutes: 45,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 15,
        capacity: 1,
        confirmationMode: "manual_approval",
        isActive: true,
      },
    ],
    availabilityRules: [1, 2, 3, 4, 5].map((weekday, index) => ({
      id: `20000000-0000-4000-8000-00000000022${index}`,
      projectId: "demo-vertice",
      weekday,
      startTime: "09:00",
      endTime: "17:00",
      timezone: "America/Sao_Paulo",
    })),
  },
  steps: [
    {
      id: "vertice-intent",
      type: "choice",
      title: "O que você quer destravar no seu negócio?",
      description: "A gente te leva para o melhor próximo passo.",
      order: 0,
      isActive: true,
      visualVariant: "signal-grid",
      blocks: [
        { id: "vertice-choice", type: "choice_list", variant: "technical" },
      ],
      options: [
        {
          id: "v-leads",
          label: "Gerar mais leads",
          description: "Crie demanda previsível",
          icon: "Target",
          value: "leads",
          actionType: "go_to_step",
          targetStepId: "vertice-form",
        },
        {
          id: "v-social",
          label: "Melhorar redes sociais",
          description: "Construa autoridade",
          icon: "LineChart",
          value: "social",
          actionType: "go_to_step",
          targetStepId: "vertice-form",
        },
        {
          id: "v-sales",
          label: "Aumentar vendas",
          description: "Conecte marketing e comercial",
          icon: "TrendingUp",
          value: "vendas",
          actionType: "go_to_step",
          targetStepId: "vertice-form",
        },
        {
          id: "v-talk",
          label: "Falar com especialista",
          description: "Vá direto ao diagnóstico",
          icon: "MessageSquare",
          value: "especialista",
          actionType: "go_to_step",
          targetStepId: "vertice-action",
        },
      ],
    },
    {
      id: "vertice-form",
      type: "form",
      title: "Vamos entender o seu momento.",
      description: "Responda para receber uma recomendação sob medida.",
      order: 1,
      isActive: true,
      visualVariant: "terminal-form",
      formFields: [
        {
          id: "v-business",
          label: "Qual é o seu negócio?",
          key: "negocio",
          type: "text",
          required: true,
          placeholder: "Ex.: SaaS para indústrias",
        },
        {
          id: "v-invest",
          label: "Investimento mensal em marketing",
          key: "investimento",
          type: "select",
          required: true,
          options: [
            "Até R$ 3 mil",
            "R$ 3–10 mil",
            "R$ 10–30 mil",
            "Acima de R$ 30 mil",
          ],
        },
        {
          id: "v-goal",
          label: "Objetivo principal",
          key: "objetivo",
          type: "select",
          required: true,
          options: ["Gerar leads", "Aumentar autoridade", "Acelerar vendas"],
        },
        {
          id: "v-contact",
          label: "Preferência de contato",
          key: "contato",
          type: "radio",
          required: true,
          options: ["WhatsApp", "Reunião", "Proposta por e-mail"],
        },
      ],
      options: [
        {
          id: "v-form-next",
          label: "Ver diagnóstico",
          value: "diagnostico",
          actionType: "go_to_step",
          targetStepId: "vertice-recommendation",
        },
      ],
    },
    {
      id: "vertice-recommendation",
      type: "recommendation",
      title: "Esse é o melhor próximo passo.",
      description:
        "Sua prioridade pede aquisição e autoridade trabalhando juntas.",
      order: 2,
      isActive: true,
      visualVariant: "orange-spotlight",
      recommendation: {
        title: "Tráfego Pago + Social Media",
        description:
          "Um sistema integrado para gerar demanda, construir confiança e dar previsibilidade ao comercial.",
        label: "Recomendação Vértice",
        benefits: [
          "Mais leads qualificados",
          "Mais autoridade",
          "Mais previsibilidade",
        ],
        deliverables: ["Estratégia", "Criação", "Otimização", "Acompanhamento"],
      },
      options: [
        {
          id: "v-rec-next",
          label: "Escolher próximo passo",
          value: "acao",
          actionType: "go_to_step",
          targetStepId: "vertice-action",
        },
      ],
    },
    {
      id: "vertice-action",
      type: "schedule",
      title: "Escolha como quer continuar.",
      description: "Consulte a agenda ou fale direto com o time.",
      order: 3,
      isActive: true,
      visualVariant: "conversion-dock",
      blocks: [
        {
          id: "v-service",
          type: "service_selector",
          content: {
            fieldKey: "service",
            services: [
              {
                id: "20000000-0000-4000-8000-000000000211",
                name: "Diagnóstico estratégico",
                durationMinutes: 45,
              },
            ],
          },
        },
        { id: "v-calendar", type: "calendar" },
        { id: "v-slots", type: "schedule_slots" },
        { id: "v-booking-summary", type: "booking_summary" },
      ],
      options: [
        {
          id: "v-schedule",
          label: "Solicitar reunião",
          icon: "CalendarCheck",
          value: "agendar",
          actionType: "start_capability",
          actionPayload: { capability: "scheduling" },
        },
        {
          id: "v-whatsapp",
          label: "Falar no WhatsApp",
          icon: "MessageCircle",
          value: "whatsapp",
          actionType: "open_whatsapp",
          actionPayload: { phone: "5511988884004" },
        },
        {
          id: "v-proposal",
          label: "Receber proposta",
          icon: "FileText",
          value: "proposta",
          actionType: "submit_form",
        },
      ],
      formFields: [
        {
          id: "v-name",
          label: "Nome",
          key: "name",
          type: "text",
          required: true,
        },
        {
          id: "v-email",
          label: "E-mail",
          key: "email",
          type: "email",
          required: true,
        },
        {
          id: "v-phone",
          label: "WhatsApp",
          key: "phone",
          type: "phone",
          required: true,
        },
      ],
    },
  ],
};

export const limpaBem: Project = {
  id: "demo-limpabem",
  workspaceId: "demo-workspace",
  name: "LimpaBem Estofados",
  slug: "limpabem",
  description:
    "Higienização profissional de sofás, colchões e cadeiras com orçamento por fotos.",
  subtitle: "Veja uma estimativa antes de falar com a equipe.",
  status: "published",
  primaryGoal: "Solicitar orçamento",
  primaryDestination: "Experiência nativa",
  category: "Limpeza de estofados",
  audience: "Residências e empresas",
  phone: "5511977771100",
  visualDirection: "Limpa e acolhedora",
  brand: {
    extractedColors: ["#176B64", "#9AD9D3", "#F4FBFA"],
    activePalette: cleanPalette,
    paletteVariations: [],
    brandPersonality: ["Acolhedora", "Confiável"],
  },
  designSystem: design(cleanPalette, "mix"),
  version: 1,
  createdAt: now,
  updatedAt: now,
  publishedAt: now,
  businessProfile: profile({
    offerKinds: ["service"],
    primaryIntents: ["request_quote"],
    requiresQualification: true,
    requiresMediaUpload: true,
    confirmationMode: "manual_approval",
    completionChannel: "native",
  }),
  capabilities: [capability("quote"), capability("qualification")],
  commercialConfig: {
    quoteDefinition: {
      id: "30000000-0000-4000-8000-000000000301",
      projectId: "demo-limpabem",
      title: "Orçamento de higienização",
      currency: "BRL",
      baseAmount: 90,
      estimationMode: "range",
      completionChannel: "native",
      isActive: true,
      questions: [],
      rules: [
        {
          id: "30000000-0000-4000-8000-000000000311",
          condition: { field: "servico", operator: "contains", value: "Sofá" },
          operation: "add",
          amount: 70,
        },
        {
          id: "30000000-0000-4000-8000-000000000312",
          condition: {
            field: "quantidade",
            operator: "greater_than",
            value: 1,
          },
          operation: "range",
          minAmount: 60,
          maxAmount: 120,
        },
      ],
    },
  },
  steps: [
    {
      id: "clean-welcome",
      type: "welcome",
      title: "Seu estofado limpo começa com uma avaliação simples.",
      description:
        "Escolha o item, informe a quantidade e, se puder, envie fotos.",
      order: 0,
      isActive: true,
      options: [
        {
          id: "clean-start",
          label: "Calcular estimativa",
          value: "start",
          actionType: "go_to_step",
          targetStepId: "clean-quote",
        },
      ],
    },
    {
      id: "clean-quote",
      type: "quote",
      title: "O que você quer higienizar?",
      description:
        "As fotos ajudam nossa equipe a confirmar o valor com mais precisão.",
      order: 1,
      isActive: true,
      blocks: [
        {
          id: "clean-services",
          type: "service_selector",
          content: {
            fieldKey: "servico",
            options: ["Sofá", "Colchão", "Cadeiras", "Poltrona"],
          },
        },
        {
          id: "clean-quantity",
          type: "quantity_selector",
          content: { fieldKey: "quantidade", min: 1, max: 12 },
        },
        {
          id: "clean-media",
          type: "media_upload",
          content: { fieldKey: "fotos", maxFiles: 4, required: false },
        },
        { id: "clean-estimate", type: "price_estimate" },
      ],
      formFields: [
        {
          id: "clean-name",
          label: "Seu nome",
          key: "name",
          type: "text",
          required: true,
        },
        {
          id: "clean-phone",
          label: "WhatsApp",
          key: "phone",
          type: "phone",
          required: true,
        },
      ],
      options: [
        {
          id: "clean-review",
          label: "Revisar solicitação",
          value: "review",
          actionType: "go_to_step",
          targetStepId: "clean-summary",
        },
      ],
    },
    {
      id: "clean-summary",
      type: "confirmation",
      title: "Tudo certo para enviar?",
      description:
        "A equipe recebe suas respostas, a estimativa e as fotos anexadas.",
      order: 2,
      isActive: true,
      blocks: [
        { id: "clean-summary-block", type: "quote_summary" },
        { id: "clean-summary-estimate", type: "price_estimate" },
      ],
      options: [
        {
          id: "clean-submit",
          label: "Enviar pedido de orçamento",
          value: "submit",
          actionType: "start_capability",
          actionPayload: { capability: "quote" },
        },
      ],
    },
  ],
};

export const clinicaAurora: Project = {
  id: "demo-clinica-aurora",
  workspaceId: "demo-workspace",
  name: "Clínica Aurora",
  slug: "clinica-aurora",
  description:
    "Clínica integrada com consultas de nutrição e psicologia por horário.",
  subtitle: "Escolha o cuidado e encontre um horário.",
  status: "published",
  primaryGoal: "Agendar consulta",
  primaryDestination: "Experiência nativa",
  category: "Clínica",
  phone: "5511966662200",
  visualDirection: "Serena e humana",
  brand: {
    extractedColors: ["#7C5CFC", "#DCCFFF", "#FCFAFF"],
    activePalette: clinicPalette,
    paletteVariations: [],
    brandPersonality: ["Humana", "Serena"],
  },
  designSystem: design(clinicPalette, "mix"),
  version: 1,
  createdAt: now,
  updatedAt: now,
  publishedAt: now,
  businessProfile: profile({
    offerKinds: ["professional_service"],
    primaryIntents: ["schedule"],
    capacityKinds: ["time_slot", "professional"],
    confirmationMode: "instant",
    completionChannel: "native",
  }),
  capabilities: [capability("scheduling")],
  commercialConfig: {
    schedulableServices: [
      {
        id: "40000000-0000-4000-8000-000000000401",
        projectId: "demo-clinica-aurora",
        name: "Consulta de nutrição",
        durationMinutes: 50,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 10,
        capacity: 1,
        confirmationMode: "instant",
        isActive: true,
      },
      {
        id: "40000000-0000-4000-8000-000000000402",
        projectId: "demo-clinica-aurora",
        name: "Sessão de psicologia",
        durationMinutes: 50,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 10,
        capacity: 1,
        confirmationMode: "instant",
        isActive: true,
      },
    ],
    resources: [
      {
        id: "40000000-0000-4000-8000-000000000411",
        projectId: "demo-clinica-aurora",
        name: "Equipe Aurora",
        kind: "professional",
        isActive: true,
      },
    ],
    availabilityRules: [1, 2, 3, 4, 5].map((weekday, index) => ({
      id: `40000000-0000-4000-8000-00000000042${index}`,
      projectId: "demo-clinica-aurora",
      resourceId: "40000000-0000-4000-8000-000000000411",
      weekday,
      startTime: "08:00",
      endTime: "18:00",
      timezone: "America/Sao_Paulo",
    })),
  },
  steps: [
    {
      id: "clinic-welcome",
      type: "welcome",
      title: "Qual cuidado faz sentido agora?",
      description: "Escolha a especialidade e consulte horários reais.",
      order: 0,
      isActive: true,
      options: [
        {
          id: "clinic-start",
          label: "Ver agenda",
          value: "schedule",
          actionType: "go_to_step",
          targetStepId: "clinic-schedule",
        },
      ],
    },
    {
      id: "clinic-schedule",
      type: "schedule",
      title: "Escolha serviço, data e horário.",
      description: "A confirmação é imediata para os horários disponíveis.",
      order: 1,
      isActive: true,
      blocks: [
        {
          id: "clinic-services",
          type: "service_selector",
          content: {
            fieldKey: "service",
            services: [
              {
                id: "40000000-0000-4000-8000-000000000401",
                name: "Consulta de nutrição",
                durationMinutes: 50,
              },
              {
                id: "40000000-0000-4000-8000-000000000402",
                name: "Sessão de psicologia",
                durationMinutes: 50,
              },
            ],
          },
        },
        {
          id: "clinic-resource",
          type: "resource_selector",
          content: {
            resources: [
              {
                id: "40000000-0000-4000-8000-000000000411",
                name: "Equipe Aurora",
              },
            ],
          },
        },
        { id: "clinic-calendar", type: "calendar" },
        { id: "clinic-slots", type: "schedule_slots" },
        { id: "clinic-summary", type: "booking_summary" },
      ],
      formFields: [
        {
          id: "clinic-name",
          label: "Nome",
          key: "name",
          type: "text",
          required: true,
        },
        {
          id: "clinic-phone",
          label: "WhatsApp",
          key: "phone",
          type: "phone",
          required: true,
        },
      ],
      options: [
        {
          id: "clinic-submit",
          label: "Confirmar agendamento",
          value: "book",
          actionType: "start_capability",
          actionPayload: { capability: "scheduling" },
        },
      ],
    },
  ],
};

export const chalesSerraClara: Project = {
  id: "demo-chales",
  workspaceId: "demo-workspace",
  name: "Chalés Serra Clara",
  slug: "chales-serra-clara",
  description:
    "Chalés privativos para casais e famílias com consulta de disponibilidade por período.",
  subtitle: "Sua pausa na serra começa pelas datas.",
  status: "published",
  primaryGoal: "Consultar e reservar",
  primaryDestination: "Experiência nativa",
  category: "Hospedagem",
  phone: "5512955553300",
  visualDirection: "Natural e editorial",
  brand: {
    extractedColors: ["#315A45", "#D6A85F", "#F6F1E7"],
    activePalette: chaletPalette,
    paletteVariations: [],
    brandPersonality: ["Natural", "Premium"],
  },
  designSystem: design(chaletPalette, "mix"),
  version: 1,
  createdAt: now,
  updatedAt: now,
  publishedAt: now,
  businessProfile: profile({
    offerKinds: ["hospitality"],
    primaryIntents: ["check_availability", "reserve"],
    capacityKinds: ["room", "daily_capacity"],
    confirmationMode: "manual_approval",
    completionChannel: "native",
    requiresPayment: true,
  }),
  capabilities: [capability("reservation")],
  commercialConfig: {
    paymentUrl: "https://example.com/pagamento",
    reservableUnits: [
      {
        id: "50000000-0000-4000-8000-000000000501",
        projectId: "demo-chales",
        name: "Chalé Vista",
        description: "Varanda e vista para a serra",
        capacityAdults: 2,
        capacityChildren: 1,
        quantity: 2,
        basePrice: 520,
        currency: "BRL",
        isActive: true,
        mediaAssetIds: [],
        amenities: ["Café da manhã", "Lareira", "Hidromassagem"],
      },
      {
        id: "50000000-0000-4000-8000-000000000502",
        projectId: "demo-chales",
        name: "Chalé Família",
        description: "Dois quartos e cozinha",
        capacityAdults: 4,
        capacityChildren: 2,
        quantity: 1,
        basePrice: 760,
        currency: "BRL",
        isActive: true,
        mediaAssetIds: [],
        amenities: ["Cozinha", "Deck", "Wi-Fi"],
      },
    ],
    reservationBlocks: [],
  },
  steps: [
    {
      id: "chalet-welcome",
      type: "welcome",
      title: "Quando você quer respirar a serra?",
      description: "Consulte as datas antes de escolher o chalé.",
      order: 0,
      isActive: true,
      options: [
        {
          id: "chalet-start",
          label: "Consultar datas",
          value: "dates",
          actionType: "go_to_step",
          targetStepId: "chalet-reserve",
        },
      ],
    },
    {
      id: "chalet-reserve",
      type: "reservation",
      title: "Encontre o chalé certo para a viagem.",
      description: "Informe período e hóspedes para ver opções e valores.",
      order: 1,
      isActive: true,
      blocks: [
        { id: "chalet-dates", type: "date_range" },
        { id: "chalet-guests", type: "guest_selector" },
        { id: "chalet-units", type: "reservable_unit_cards" },
        { id: "chalet-summary", type: "booking_summary" },
        {
          id: "chalet-policy",
          type: "policy_card",
          content: {
            text: "Cancelamento pode ser solicitado até 7 dias antes. A aprovação é feita pela pousada.",
          },
        },
        {
          id: "chalet-deposit",
          type: "deposit_card",
          content: { percent: 30, external: true },
        },
      ],
      formFields: [
        {
          id: "chalet-name",
          label: "Nome",
          key: "name",
          type: "text",
          required: true,
        },
        {
          id: "chalet-phone",
          label: "WhatsApp",
          key: "phone",
          type: "phone",
          required: true,
        },
      ],
      options: [
        {
          id: "chalet-submit",
          label: "Solicitar reserva",
          value: "reserve",
          actionType: "start_capability",
          actionPayload: { capability: "reservation" },
        },
      ],
    },
  ],
};

export const redeMovimento: Project = {
  id: "demo-rede-movimento",
  workspaceId: "demo-workspace",
  name: "Rede Movimento",
  slug: "rede-movimento",
  description:
    "Rede de academias que encaminha cada visitante para a unidade mais adequada.",
  subtitle: "A unidade certa, sem perder contexto.",
  status: "published",
  primaryGoal: "Encontrar unidade",
  primaryDestination: "WhatsApp",
  category: "Academia",
  phone: "5511944444400",
  visualDirection: "Direta e energética",
  brand: {
    extractedColors: ["#155EEF", "#53B1FD", "#F5F8FF"],
    activePalette: networkPalette,
    paletteVariations: [],
    brandPersonality: ["Energética", "Confiável"],
  },
  designSystem: design(networkPalette, "mix"),
  version: 1,
  createdAt: now,
  updatedAt: now,
  publishedAt: now,
  businessProfile: profile({
    offerKinds: ["membership", "service"],
    primaryIntents: ["visit", "contact"],
    capacityKinds: ["location"],
    hasMultipleLocations: true,
    completionChannel: "whatsapp",
  }),
  capabilities: [capability("routing")],
  commercialConfig: {
    locations: [
      {
        id: "demo-location-sul",
        projectId: "demo-rede-movimento",
        name: "Unidade Zona Sul",
        addressLine: "Av. Paulista",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        postalCode: "01310-100",
        postalCodePrefixes: ["013"],
        countryCode: "BR",
        latitude: -23.5614,
        longitude: -46.6559,
        geocodingStatus: "resolved",
        timezone: "America/Sao_Paulo",
        openingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          opensAt: "00:00",
          closesAt: "00:00",
        })),
        supportsDelivery: false,
        supportsPickup: false,
        supportsInPerson: true,
        priority: 3,
        isActive: true,
        routingDestinationId: "60000000-0000-4000-8000-000000000601",
      },
      {
        id: "demo-location-centro",
        projectId: "demo-rede-movimento",
        name: "Unidade Centro",
        addressLine: "Praça da Sé",
        neighborhood: "Sé",
        city: "São Paulo",
        state: "SP",
        postalCode: "01001-000",
        postalCodePrefixes: ["010"],
        countryCode: "BR",
        latitude: -23.5504,
        longitude: -46.6339,
        geocodingStatus: "resolved",
        timezone: "America/Sao_Paulo",
        openingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          opensAt: "00:00",
          closesAt: "00:00",
        })),
        supportsDelivery: false,
        supportsPickup: false,
        supportsInPerson: true,
        priority: 2,
        isActive: true,
        routingDestinationId: "60000000-0000-4000-8000-000000000602",
      },
      {
        id: "demo-location-norte",
        projectId: "demo-rede-movimento",
        name: "Unidade Zona Norte",
        addressLine: "Av. Cruzeiro do Sul",
        neighborhood: "Santana",
        city: "São Paulo",
        state: "SP",
        postalCode: "02030-100",
        postalCodePrefixes: ["020"],
        countryCode: "BR",
        latitude: -23.5095,
        longitude: -46.6242,
        geocodingStatus: "resolved",
        timezone: "America/Sao_Paulo",
        openingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          opensAt: "00:00",
          closesAt: "00:00",
        })),
        supportsDelivery: false,
        supportsPickup: false,
        supportsInPerson: true,
        priority: 1,
        isActive: true,
        routingDestinationId: "60000000-0000-4000-8000-000000000603",
      },
    ],
    routingDestinations: [
      {
        id: "60000000-0000-4000-8000-000000000601",
        key: "sul",
        type: "whatsapp",
        label: "Unidade Zona Sul",
        value: "5511944444401",
      },
      {
        id: "60000000-0000-4000-8000-000000000602",
        key: "centro",
        type: "whatsapp",
        label: "Unidade Centro",
        value: "5511944444402",
      },
      {
        id: "60000000-0000-4000-8000-000000000603",
        key: "norte",
        type: "whatsapp",
        label: "Unidade Zona Norte",
        value: "5511944444403",
      },
    ],
    routingRules: [
      {
        id: "60000000-0000-4000-8000-000000000611",
        projectId: "demo-rede-movimento",
        priority: 30,
        condition: { field: "regiao", operator: "contains", value: "Sul" },
        destinationId: "60000000-0000-4000-8000-000000000601",
        isActive: true,
      },
      {
        id: "60000000-0000-4000-8000-000000000612",
        projectId: "demo-rede-movimento",
        priority: 20,
        condition: { field: "regiao", operator: "contains", value: "Centro" },
        destinationId: "60000000-0000-4000-8000-000000000602",
        isActive: true,
      },
      {
        id: "60000000-0000-4000-8000-000000000613",
        projectId: "demo-rede-movimento",
        priority: 10,
        condition: { field: "regiao", operator: "contains", value: "Norte" },
        destinationId: "60000000-0000-4000-8000-000000000603",
        isActive: true,
      },
    ],
  },
  steps: [
    {
      id: "network-welcome",
      type: "welcome",
      title: "Qual unidade combina com sua rotina?",
      description:
        "Escolha a região e mantenha todo o contexto no atendimento.",
      order: 0,
      isActive: true,
      options: [
        {
          id: "network-start",
          label: "Encontrar unidade",
          value: "route",
          actionType: "go_to_step",
          targetStepId: "network-route",
        },
      ],
    },
    {
      id: "network-route",
      type: "routing",
      title: "Onde fica melhor para você?",
      description: "A recomendação considera a região escolhida.",
      order: 1,
      isActive: true,
      blocks: [
        {
          id: "network-locations",
          type: "location_selector",
          content: {
            fieldKey: "regiao",
            options: ["Zona Sul", "Centro", "Zona Norte"],
          },
        },
        { id: "network-result", type: "route_result" },
      ],
      options: [
        {
          id: "network-resolve",
          label: "Encontrar melhor unidade",
          value: "resolve",
          actionType: "start_capability",
          actionPayload: { capability: "routing" },
        },
        {
          id: "network-whatsapp",
          label: "Falar com a rede",
          value: "wa",
          actionType: "open_whatsapp",
          actionPayload: { phone: "5511944444400" },
        },
      ],
    },
  ],
};

export const demoProjects = [
  limpaBem,
  verticeB2B,
  casaDeSucos,
  clinicaAurora,
  chalesSerraClara,
  redeMovimento,
];
export function findDemoProject(slugOrId: string) {
  if (["virou-presenca-demo", "demo-presence", "virou-activation-demo", "demo-activation"].includes(slugOrId)) {
    const activationDemo = slugOrId === "virou-activation-demo" || slugOrId === "demo-activation";
    const project = structuredClone(casaDeSucos);
    const goal =
      project.conversionGoals?.find((item) => item.isPrimary) ||
      project.conversionGoals?.[0];
    project.id = activationDemo ? "demo-activation" : "demo-presence";
    project.slug = activationDemo ? "virou-activation-demo" : "virou-presenca-demo";
    project.name = "Casa Mix";
    project.description =
      "Sucos naturais, bowls e lanches preparados para o seu momento.";
    project.brand.logoDataUrl =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='96' viewBox='0 0 360 96'%3E%3Crect width='96' height='96' rx='28' fill='%236d5ef5'/%3E%3Cpath d='M28 51c8-22 31-30 44-13-9 2-17 9-20 19-8-6-16-8-24-6Z' fill='white'/%3E%3Ctext x='116' y='62' font-family='Arial,sans-serif' font-size='42' font-weight='800' fill='%2317171c'%3ECasa Mix%3C/text%3E%3C/svg%3E";
    project.presence = {
      pages: [
        {
          id: "demo-presence-home",
          projectId: project.id,
          key: "home",
          name: "Início",
          type: "home",
          path: "/",
          title: "Sabor de verdade, do seu jeito.",
          description:
            "Escolha seus favoritos e siga pelo caminho mais rápido para pedir.",
          seoTitle: "Casa Mix · Sucos, bowls e lanches",
          seoDescription:
            "Conheça o cardápio da Casa Mix e faça seu pedido pelo caminho mais rápido.",
          defaultConversionGoalId: goal?.id,
          isHome: true,
          isActive: true,
          isIndexable: true,
          version: 1,
          settings: {
            header: {
              enabled: true,
              sticky: true,
              showLogo: true,
              showNavigation: true,
              primaryAction: goal
                ? {
                    type: "start_conversion_goal",
                    label: "Pedir agora",
                    conversionGoalId: goal.id,
                    style: "primary",
                  }
                : undefined,
            },
            footer: {
              enabled: true,
              showLogo: true,
              showSocialLinks: true,
              showPolicies: true,
              showVirouBranding: true,
            },
            layout: { maxWidth: "xl", sectionSpacing: "normal" },
            conversionPresentation: { mode: "overlay" },
          },
          sections: [
            {
              id: "demo-presence-hero",
              pageId: "demo-presence-home",
              key: "hero",
              type: "hero",
              anchor: "inicio",
              eyebrow: "Natural, fresco e simples",
              title: "Sabor de verdade, do seu jeito.",
              description:
                "Sucos, bowls e lanches preparados para transformar vontade em pedido sem complicação.",
              content: {
                badges: ["Ingredientes frescos", "Retirada ou delivery"],
                alignment: "left",
                primaryAction: goal
                  ? {
                      type: "start_conversion_goal",
                      label: "Montar meu pedido",
                      conversionGoalId: goal.id,
                      style: "primary",
                    }
                  : undefined,
                secondaryAction: {
                  type: "scroll_to_section",
                  label: "Ver cardápio",
                  anchor: "cardapio",
                  style: "secondary",
                },
              },
              style: {
                width: "lg",
                spacing: "airy",
                radius: "lg",
                mediaTreatment: "frame",
              },
              settings: {},
              order: 0,
              isActive: true,
            },
            {
              id: "demo-presence-products",
              pageId: "demo-presence-home",
              key: "products",
              type: "products",
              anchor: "cardapio",
              eyebrow: "Cardápio",
              title: "Escolha o que combina com agora",
              description:
                "Preços e disponibilidade vêm direto do catálogo comercial.",
              content: {
                layout: "grid",
                maxItems: 8,
                showPrice: true,
                itemGoalId: goal?.id,
              },
              style: { theme: "muted", spacing: "compact", radius: "sm" },
              settings: {},
              order: 1,
              isActive: true,
            },
            {
              id: "demo-presence-faq",
              pageId: "demo-presence-home",
              key: "faq",
              type: "faq",
              anchor: "duvidas",
              eyebrow: "Dúvidas",
              title: "Antes de pedir",
              content: {
                items: [
                  {
                    id: "faq-1",
                    question: "Posso escolher retirada?",
                    answer:
                      "Sim. A jornada mostra as opções disponíveis para o seu pedido.",
                  },
                  {
                    id: "faq-2",
                    question: "Como encontro a unidade certa?",
                    answer:
                      "Use sua localização ou informe a região para seguir até o destino correto.",
                  },
                ],
              },
              style: { width: "md", spacing: "airy" },
              settings: {},
              order: 2,
              isActive: true,
            },
            {
              id: "demo-presence-cta",
              pageId: "demo-presence-home",
              key: "cta",
              type: "conversion_cta",
              title: "Pronto para escolher?",
              description:
                "Comece pelo seu objetivo e a Virou conduz o restante.",
              content: {
                primaryAction: goal
                  ? {
                      type: "start_conversion_goal",
                      label: "Começar pedido",
                      conversionGoalId: goal.id,
                      style: "primary",
                    }
                  : {
                      type: "scroll_to_section",
                      label: "Ver cardápio",
                      anchor: "cardapio",
                    },
              },
              style: { width: "lg", radius: "lg" },
              settings: {},
              order: 3,
              isActive: true,
            },
            {
              id: "demo-presence-contact",
              pageId: "demo-presence-home",
              key: "contact",
              type: "contact",
              anchor: "contato",
              title: "Acompanhe a Casa Mix",
              description:
                "Novidades e informações confirmadas nos canais oficiais.",
              content: {
                socialLinks: [
                  { label: "Instagram", url: "https://www.instagram.com/" },
                ],
              },
              style: { width: "lg", spacing: "compact" },
              settings: {},
              order: 4,
              isActive: true,
            },
          ],
        },
      ],
    };
    return project;
  }
  return demoProjects.find(
    (project) => project.slug === slugOrId || project.id === slugOrId,
  );
}
