import { buildPalette } from "@/features/brand-intelligence/colors";
import type { Project, ProjectDesignSystem } from "@/types";

const mixPalette = buildPalette(["#E62E2D", "#FFD33D", "#FF7A1A"], "faithful");
mixPalette.background = "#FFF8EF"; mixPalette.surface = "#FFFFFF"; mixPalette.foreground = "#2B1712"; mixPalette.muted = "#FFEFD6"; mixPalette.border = "#F5D9BB";
const verticePalette = buildPalette(["#FF6A00", "#FFB066", "#F4F4F5"], "bold");
verticePalette.background = "#090909"; verticePalette.surface = "#151515"; verticePalette.surfaceElevated = "#1C1C1C"; verticePalette.foreground = "#FAFAFA"; verticePalette.muted = "#242424"; verticePalette.mutedForeground = "#ADADAD"; verticePalette.border = "#303030";

function design(colors: typeof mixPalette, kind: "mix" | "vertice"): ProjectDesignSystem {
  const dark = kind === "vertice";
  return {
    mode: dark ? "dark" : "light", colors,
    typography: { headingFont: dark ? "Manrope" : "Plus Jakarta Sans", bodyFont: "Inter", headingWeight: dark ? 700 : 800, bodyWeight: 450, scale: "expressive" },
    shape: { cardRadius: dark ? 18 : 26, buttonRadius: dark ? 12 : 99, inputRadius: 14, borderWidth: 1 },
    elevation: { cardShadow: dark ? "0 24px 80px rgba(255,106,0,.08)" : "0 18px 44px rgba(139,51,24,.12)", floatingShadow: "0 30px 90px rgba(0,0,0,.22)", glowColor: colors.primary, glowIntensity: dark ? 0.28 : 0.1 },
    spacing: { density: dark ? "balanced" : "spacious", sectionGap: 30, cardGap: 12 },
    imagery: { decorativeStyle: dark ? "technical-grid" : "fruit-orbs", overlayOpacity: 0.15 },
    motion: { transition: dark ? "slide" : "scale", duration: 320, cardHover: true },
    buttons: { style: dark ? "gradient" : "solid", height: "large", iconPosition: "right" },
    cards: { style: dark ? "glass" : "elevated", borderColor: colors.border, surfaceOpacity: dark ? 0.84 : 1 },
  };
}

const now = "2026-08-01T12:00:00.000Z";

export const casaDeSucos: Project = {
  id: "demo-casa-sucos", workspaceId: "demo-workspace", name: "Casa de Sucos Mix", slug: "casadesucosmix",
  description: "Sucos naturais, saladas de frutas e combos preparados na hora.", subtitle: "Feito na hora, do seu jeito.",
  status: "published", primaryGoal: "Receber pedidos", primaryDestination: "WhatsApp", category: "Alimentação", phone: "5511999991001", visualDirection: "Composição vibrante",
  brand: { extractedColors: ["#E62E2D", "#FFD33D", "#FF7A1A"], activePalette: mixPalette, paletteVariations: [], brandPersonality: ["Vibrante", "Orgânica"], analysisMetadata: { confidence: 0.94, orientation: "horizontal", luminance: "mixed", colorCount: 3 } },
  designSystem: design(mixPalette, "mix"), version: 3, createdAt: now, updatedAt: now, publishedAt: now,
  steps: [
    { id: "mix-intent", type: "choice", title: "O que você quer fazer hoje?", description: "A gente te leva para o melhor próximo passo.", order: 0, isActive: true, visualVariant: "fruit-hero", blocks: [{ id: "mix-choice", type: "choice_grid", variant: "pill-products" }], options: [
      { id: "mix-order", label: "Pedir agora", description: "Delivery ou retirada", icon: "ShoppingBag", value: "pedido", actionType: "go_to_step", targetStepId: "mix-receive" },
      { id: "mix-menu", label: "Ver cardápio", description: "Conheça os favoritos", icon: "BookOpen", value: "cardapio", actionType: "go_to_step", targetStepId: "mix-products" },
      { id: "mix-location", label: "Encontrar unidade", description: "A mais perto de você", icon: "MapPin", value: "unidade", actionType: "go_to_step", targetStepId: "mix-unit" },
      { id: "mix-b2b", label: "Comprar para minha empresa", description: "Condições para negócios", icon: "Building2", value: "empresa", actionType: "go_to_step", targetStepId: "mix-b2b-form" },
    ] },
    { id: "mix-receive", type: "choice", title: "Como deseja receber?", description: "Escolha o que combina com o seu momento.", order: 1, isActive: true, visualVariant: "delivery-split", options: [
      { id: "mix-delivery", label: "Delivery", description: "Receba onde estiver", icon: "Bike", value: "delivery", actionType: "go_to_step", targetStepId: "mix-unit" },
      { id: "mix-pickup", label: "Retirada", description: "Passe e pegue sem fila", icon: "Store", value: "retirada", actionType: "go_to_step", targetStepId: "mix-unit" },
    ] },
    { id: "mix-unit", type: "content", title: "A unidade mais rápida para você", description: "Calculamos a melhor opção para continuar.", order: 2, isActive: true, visualVariant: "map-card", blocks: [{ id: "mix-location-card", type: "location_card", content: { name: "Golden Shopping", eta: "12 min", status: "aberta agora", address: "Av. Central, 550" } }], options: [{ id: "mix-unit-next", label: "Ver produtos", value: "produtos", actionType: "go_to_step", targetStepId: "mix-products" }, { id: "mix-unit-change", label: "Trocar unidade", value: "trocar", actionType: "go_to_step", targetStepId: "mix-intent" }] },
    { id: "mix-products", type: "content", title: "O sabor que combina com hoje", description: "Escolha um favorito para continuar o pedido.", order: 3, isActive: true, visualVariant: "product-showcase", blocks: [{ id: "mix-products-block", type: "product_cards", content: { products: [{ name: "Suco natural", price: "a partir de R$ 12", emoji: "🍊" }, { name: "Salada de frutas", price: "R$ 16", emoji: "🍓" }, { name: "Combo do dia", price: "R$ 24", emoji: "🥭" }] } }], options: [{ id: "mix-order-final", label: "Continuar pedido", icon: "ArrowRight", value: "continuar", actionType: "open_whatsapp", actionPayload: { phone: "5511999991001" } }] },
    { id: "mix-b2b-form", type: "form", title: "Vamos montar a melhor opção para sua empresa.", description: "Três respostas rápidas e nosso time continua com contexto.", order: 4, isActive: true, visualVariant: "b2b-warm", formFields: [
      { id: "mix-business", label: "Seu negócio é", key: "negocio", type: "select", required: true, options: ["Escritório", "Academia", "Evento", "Restaurante", "Outro"] },
      { id: "mix-volume", label: "Volume estimado", key: "volume", type: "radio", required: true, options: ["Até 30 unidades", "31–100 unidades", "Mais de 100"] },
      { id: "mix-contact", label: "Como prefere continuar", key: "contato", type: "radio", required: true, options: ["WhatsApp", "Receber proposta"] },
    ], options: [{ id: "mix-b2b-result-next", label: "Ver sugestão", value: "resultado", actionType: "go_to_step", targetStepId: "mix-b2b-result" }] },
    { id: "mix-b2b-result", type: "recommendation", title: "Sua operação combina com nosso atendimento empresarial.", description: "A unidade Centro pode preparar seu pedido com condição especial.", order: 5, isActive: true, visualVariant: "business-result", recommendation: { title: "Mix Empresas", description: "Produção programada, entrega recorrente e atendimento comercial dedicado.", label: "Sugestão para o seu volume", benefits: ["Entrega programada", "Combinações personalizadas", "Faturamento para empresas"], deliverables: ["Unidade: Centro", "Atendimento: seg–sex", "Retorno em até 30 min"] }, options: [{ id: "mix-b2b-wa", label: "Falar com atendimento comercial", value: "whatsapp", actionType: "open_whatsapp", actionPayload: { phone: "5511999992002" } }] },
  ],
};

export const verticeB2B: Project = {
  id: "demo-vertice", workspaceId: "demo-workspace", name: "Vértice B2B", slug: "vertice", description: "Estratégia de crescimento para empresas B2B que precisam gerar demanda previsível.", subtitle: "Estratégia, mídia e conteúdo conectados à receita.", status: "published", primaryGoal: "Gerar leads", primaryDestination: "WhatsApp", category: "Agência B2B", phone: "5511988884004", visualDirection: "Fundo escuro premium",
  brand: { extractedColors: ["#FF6A00", "#F4F4F5", "#101010"], activePalette: verticePalette, paletteVariations: [], brandPersonality: ["Premium", "Tecnológica"], analysisMetadata: { confidence: 0.96, orientation: "horizontal", luminance: "dark", colorCount: 3 } },
  designSystem: design(verticePalette, "vertice"), version: 4, createdAt: now, updatedAt: now, publishedAt: now,
  steps: [
    { id: "vertice-intent", type: "choice", title: "O que você quer destravar no seu negócio?", description: "A gente te leva para o melhor próximo passo.", order: 0, isActive: true, visualVariant: "signal-grid", blocks: [{ id: "vertice-choice", type: "choice_list", variant: "technical" }], options: [
      { id: "v-leads", label: "Gerar mais leads", description: "Crie demanda previsível", icon: "Target", value: "leads", actionType: "go_to_step", targetStepId: "vertice-form" },
      { id: "v-social", label: "Melhorar redes sociais", description: "Construa autoridade", icon: "LineChart", value: "social", actionType: "go_to_step", targetStepId: "vertice-form" },
      { id: "v-sales", label: "Aumentar vendas", description: "Conecte marketing e comercial", icon: "TrendingUp", value: "vendas", actionType: "go_to_step", targetStepId: "vertice-form" },
      { id: "v-talk", label: "Falar com especialista", description: "Vá direto ao diagnóstico", icon: "MessageSquare", value: "especialista", actionType: "go_to_step", targetStepId: "vertice-action" },
    ] },
    { id: "vertice-form", type: "form", title: "Vamos entender o seu momento.", description: "Responda para receber uma recomendação sob medida.", order: 1, isActive: true, visualVariant: "terminal-form", formFields: [
      { id: "v-business", label: "Qual é o seu negócio?", key: "negocio", type: "text", required: true, placeholder: "Ex.: SaaS para indústrias" },
      { id: "v-invest", label: "Investimento mensal em marketing", key: "investimento", type: "select", required: true, options: ["Até R$ 3 mil", "R$ 3–10 mil", "R$ 10–30 mil", "Acima de R$ 30 mil"] },
      { id: "v-goal", label: "Objetivo principal", key: "objetivo", type: "select", required: true, options: ["Gerar leads", "Aumentar autoridade", "Acelerar vendas"] },
      { id: "v-contact", label: "Preferência de contato", key: "contato", type: "radio", required: true, options: ["WhatsApp", "Reunião", "Proposta por e-mail"] },
    ], options: [{ id: "v-form-next", label: "Ver diagnóstico", value: "diagnostico", actionType: "go_to_step", targetStepId: "vertice-recommendation" }] },
    { id: "vertice-recommendation", type: "recommendation", title: "Esse é o melhor próximo passo.", description: "Sua prioridade pede aquisição e autoridade trabalhando juntas.", order: 2, isActive: true, visualVariant: "orange-spotlight", recommendation: { title: "Tráfego Pago + Social Media", description: "Um sistema integrado para gerar demanda, construir confiança e dar previsibilidade ao comercial.", label: "Recomendação Vértice", benefits: ["Mais leads qualificados", "Mais autoridade", "Mais previsibilidade"], deliverables: ["Estratégia", "Criação", "Otimização", "Acompanhamento"] }, options: [{ id: "v-rec-next", label: "Escolher próximo passo", value: "acao", actionType: "go_to_step", targetStepId: "vertice-action" }] },
    { id: "vertice-action", type: "action", title: "Escolha como quer continuar.", description: "Nosso time recebe o contexto da sua jornada.", order: 3, isActive: true, visualVariant: "conversion-dock", blocks: [{ id: "v-slots", type: "schedule_slots", content: { slots: ["Hoje 15:30", "Amanhã 10:00", "Amanhã 14:00", "Quinta 09:30", "Quinta 16:00"] } }], options: [
      { id: "v-schedule", label: "Confirmar reunião", icon: "CalendarCheck", value: "agendar", actionType: "open_url", actionPayload: { url: "https://cal.com" } },
      { id: "v-whatsapp", label: "Falar no WhatsApp", icon: "MessageCircle", value: "whatsapp", actionType: "open_whatsapp", actionPayload: { phone: "5511988884004" } },
      { id: "v-proposal", label: "Receber proposta", icon: "FileText", value: "proposta", actionType: "submit_form" },
    ], formFields: [{ id: "v-name", label: "Nome", key: "name", type: "text", required: true }, { id: "v-email", label: "E-mail", key: "email", type: "email", required: true }, { id: "v-phone", label: "WhatsApp", key: "phone", type: "phone", required: true }] },
  ],
};

export const demoProjects = [casaDeSucos, verticeB2B];
export function findDemoProject(slugOrId: string) { return demoProjects.find((project) => project.slug === slugOrId || project.id === slugOrId); }
