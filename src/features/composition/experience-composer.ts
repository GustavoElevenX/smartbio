import { buildPalette } from "@/features/brand-intelligence/colors";
import { slugify, uid } from "@/lib/utils";
import type { ExperienceCompositionInput, JourneyStep, Project, ProjectDesignSystem } from "@/types";

function hash(value: string) {
  return [...value].reduce((acc, character) => ((acc << 5) - acc + character.charCodeAt(0)) | 0, 0);
}

function designSystem(input: ExperienceCompositionInput): ProjectDesignSystem {
  const palette = input.brand?.activePalette || buildPalette(["#6D5EF5", "#FF725E", "#19B88B"]);
  const personality = input.brandPersonality?.[0]?.toLowerCase() || "equilibrada";
  const dark = input.preferredTheme === "dark" || personality.includes("premium");
  const directionIndex = Math.abs(hash(`${input.businessName}:${input.businessDescription}`)) % 4;
  return {
    mode: dark ? "dark" : input.preferredTheme || "light",
    colors: palette,
    typography: {
      headingFont: personality.includes("elegante") ? "Manrope" : directionIndex % 2 ? "Sora" : "Plus Jakarta Sans",
      bodyFont: "Inter",
      headingWeight: directionIndex % 2 ? 700 : 800,
      bodyWeight: 450,
      scale: personality.includes("vibrante") ? "expressive" : "standard",
    },
    shape: { cardRadius: [16, 22, 28, 12][directionIndex], buttonRadius: [14, 18, 99, 10][directionIndex], inputRadius: 14, borderWidth: 1 },
    elevation: { cardShadow: "0 16px 40px rgba(20,20,35,.10)", floatingShadow: "0 24px 70px rgba(12,12,20,.18)", glowColor: palette.primary, glowIntensity: dark ? 0.22 : 0.08 },
    spacing: { density: input.preferredDensity === "immersive" ? "spacious" : input.preferredDensity || "balanced", sectionGap: 28, cardGap: 12 },
    imagery: { decorativeStyle: ["orb", "grid", "rays", "grain"][directionIndex], overlayOpacity: dark ? 0.3 : 0.06 },
    motion: { transition: directionIndex % 2 ? "slide" : "fade", duration: 320, cardHover: true },
    buttons: { style: personality.includes("premium") ? "gradient" : directionIndex === 2 ? "soft" : "solid", height: "large", iconPosition: "right" },
    cards: { style: dark ? "glass" : directionIndex === 1 ? "outlined" : "elevated", borderColor: palette.border, surfaceOpacity: dark ? 0.78 : 1 },
  };
}

function nextSteps(input: ExperienceCompositionInput): JourneyStep[] {
  const leadGoal = /lead|orçamento|agend/i.test(input.primaryGoal);
  const orderGoal = /venda|pedido|produto/i.test(input.primaryGoal);
  const intentId = uid("step");
  const qualifyId = uid("step");
  const resultId = uid("step");
  const actionId = uid("step");
  const options = leadGoal
    ? ["Quero gerar oportunidades", "Quero melhorar minha presença", "Quero falar com um especialista"]
    : orderGoal
      ? ["Quero comprar agora", "Quero conhecer as opções", "Quero atendimento personalizado"]
      : ["Quero começar agora", "Quero entender melhor", "Quero falar com alguém"];
  return [
    {
      id: intentId, type: "choice", title: "O que você quer fazer hoje?", description: "Escolha uma opção e a gente leva você ao melhor próximo passo.", order: 0, isActive: true, visualVariant: "intent-focus",
      options: options.map((label, index) => ({ id: uid("option"), label, description: index === 0 ? "Caminho recomendado para começar" : undefined, icon: ["Sparkles", "Compass", "MessageCircle"][index], value: slugify(label), actionType: "go_to_step", targetStepId: qualifyId })),
      blocks: [{ id: uid("block"), type: "choice_grid", variant: "brand-composed" }],
    },
    {
      id: qualifyId, type: "form", title: "Vamos entender o seu momento.", description: "São só algumas respostas rápidas para personalizar a recomendação.", order: 1, isActive: true, visualVariant: "focused-form",
      formFields: [
        { id: uid("field"), label: "Seu principal objetivo", key: "objetivo", type: "select", required: true, options: ["Crescer agora", "Ganhar previsibilidade", "Conhecer as soluções"] },
        { id: uid("field"), label: "Como prefere continuar?", key: "preferencia", type: "radio", required: true, options: [input.primaryDestination, "Receber mais informações"] },
      ],
      options: [{ id: uid("option"), label: "Ver recomendação", value: "continue", actionType: "go_to_step", targetStepId: resultId }],
      blocks: [{ id: uid("block"), type: "form", variant: "single-column" }],
    },
    {
      id: resultId, type: "recommendation", title: "Esse é o melhor próximo passo.", description: "Com base nas suas respostas, preparamos uma recomendação objetiva.", order: 2, isActive: true, visualVariant: "spotlight",
      recommendation: { title: input.businessName, description: input.businessDescription, label: "Recomendado para você", benefits: ["Atendimento alinhado ao seu objetivo", "Próximo passo claro", "Experiência sem complicação"], deliverables: ["Orientação personalizada", "Contato com contexto", "Acompanhamento"] },
      options: [{ id: uid("option"), label: "Escolher como continuar", value: "continue", actionType: "go_to_step", targetStepId: actionId }],
      blocks: [{ id: uid("block"), type: "recommendation_card", variant: "brand-highlight" }],
    },
    {
      id: actionId, type: "action", title: "Escolha como quer continuar.", description: "Você está a um passo de avançar.", order: 3, isActive: true, visualVariant: "conversion",
      options: [
        { id: uid("option"), label: input.primaryDestination === "WhatsApp" ? "Falar no WhatsApp" : `Continuar por ${input.primaryDestination}`, value: "primary-action", icon: "ArrowUpRight", actionType: input.primaryDestination === "WhatsApp" ? "open_whatsapp" : "open_url", actionPayload: input.primaryDestination === "WhatsApp" ? { phone: input.phone || "5511999999999" } : { url: "https://example.com" } },
        { id: uid("option"), label: "Quero receber os detalhes", value: "capture-lead", icon: "Mail", actionType: "submit_form" },
      ],
      formFields: [
        { id: uid("field"), label: "Nome", key: "name", type: "text", required: true, placeholder: "Como podemos chamar você?" },
        { id: uid("field"), label: "WhatsApp", key: "phone", type: "phone", required: true, placeholder: "(00) 00000-0000" },
      ],
      blocks: [{ id: uid("block"), type: "cta_group", variant: "stacked" }],
    },
  ];
}

export class RuleBasedExperienceComposer {
  compose(input: ExperienceCompositionInput): Project {
    const now = new Date().toISOString();
    const brand = input.brand || {
      extractedColors: ["#6D5EF5", "#FF725E", "#19B88B"],
      activePalette: buildPalette(["#6D5EF5", "#FF725E", "#19B88B"]),
      paletteVariations: [], brandPersonality: input.brandPersonality || ["Equilibrada"],
    };
    return {
      id: uid("project"), workspaceId: "local-workspace", name: input.businessName, slug: slugify(input.slug || input.businessName), description: input.businessDescription,
      subtitle: "A gente te leva para o melhor próximo passo.", status: "draft", primaryGoal: input.primaryGoal, primaryDestination: input.primaryDestination,
      category: input.category, audience: input.audience, phone: input.phone, visualDirection: input.visualDirection || "Equilibrada", brand,
      designSystem: designSystem({ ...input, brand }), steps: nextSteps(input), version: 1, createdAt: now, updatedAt: now,
    };
  }
}

export class AIExperienceComposer {
  async compose(_input: ExperienceCompositionInput): Promise<Project> {
    void _input;
    throw new Error("Compositor de IA não configurado.");
  }
}

export class ExperienceComposerOrchestrator {
  constructor(private rules = new RuleBasedExperienceComposer(), private ai = new AIExperienceComposer()) {}
  async compose(input: ExperienceCompositionInput): Promise<Project> {
    if (process.env.NEXT_PUBLIC_FEATURE_AI === "true") {
      try { return await this.ai.compose(input); } catch { /* fallback determinístico */ }
    }
    return this.rules.compose(input);
  }
}

export const experienceComposer = new ExperienceComposerOrchestrator();
