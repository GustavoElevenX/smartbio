import { buildPalette } from "@/features/brand-intelligence/colors";
import type { BrandProfile, ExperienceCompositionInput, JourneyStep, ProjectDesignSystem } from "@/types";

function hash(value: string) {
  return [...value].reduce((accumulator, character) => ((accumulator << 5) - accumulator + character.charCodeAt(0)) | 0, 0);
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function defaultIdentity(input: ExperienceCompositionInput) {
  const text = normalized(`${input.businessName} ${input.businessDescription} ${input.category || ""}`);
  if (["pet", "cao", "caes", "gato", "banho e tosa", "veterin"].some((term) => text.includes(term))) {
    return {
      colors: ["#2F6B5B", "#F2B45B", "#D97A61"],
      personality: ["Acolhedora", "Confiável", "Leve"],
      subtitle: "Cuidado, confiança e o próximo passo para o seu pet.",
    };
  }
  if (["clinica", "saude", "terapia", "fisioterapia", "odontologia"].some((term) => text.includes(term))) {
    return {
      colors: ["#246B76", "#76C7B7", "#E8B86D"],
      personality: ["Confiável", "Calma", "Humana"],
      subtitle: "Acolhimento claro para chegar ao atendimento certo.",
    };
  }
  if (["restaurante", "comida", "sucos", "cafe", "confeitaria"].some((term) => text.includes(term))) {
    return {
      colors: ["#B55235", "#F2B84B", "#496B3E"],
      personality: ["Apetitosa", "Próxima", "Vibrante"],
      subtitle: "Escolha fácil, pedido direto e sabor no próximo passo.",
    };
  }
  if (["hotel", "pousada", "chale", "hospedagem"].some((term) => text.includes(term))) {
    return {
      colors: ["#315B65", "#D7A86E", "#7C9A78"],
      personality: ["Acolhedora", "Natural", "Elegante"],
      subtitle: "Da descoberta à estadia, com clareza e acolhimento.",
    };
  }
  return {
    colors: ["#5D50D6", "#FF806B", "#20A985"],
    personality: ["Equilibrada", "Clara", "Confiante"],
    subtitle: "Da atenção ao próximo passo comercial.",
  };
}

export function defaultBrandProfile(input: ExperienceCompositionInput): BrandProfile {
  const identity = defaultIdentity(input);
  return {
    extractedColors: identity.colors,
    activePalette: buildPalette(identity.colors),
    paletteVariations: [
      { name: "Fiel", palette: buildPalette(identity.colors, "faithful") },
      { name: "Equilibrada", palette: buildPalette(identity.colors, "balanced") },
      { name: "Ousada", palette: buildPalette(identity.colors, "bold") },
    ],
    brandPersonality: input.brandPersonality || identity.personality,
  };
}

export function defaultProjectSubtitle(input: ExperienceCompositionInput) {
  return defaultIdentity(input).subtitle;
}

export class VisualComposer {
  compose(input: ExperienceCompositionInput, brand: BrandProfile, journey: JourneyStep[]): ProjectDesignSystem {
    const palette = brand.activePalette || buildPalette(["#6D5EF5", "#FF725E", "#19B88B"]);
    const personality = input.brandPersonality?.[0]?.toLowerCase() || "equilibrada";
    const dark = input.preferredTheme === "dark" || personality.includes("premium");
    const directionIndex = Math.abs(hash(`${input.businessName}:${input.businessDescription}:${journey.map((step) => step.type).join(":")}`)) % 4;
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
}

export const visualComposer = new VisualComposer();
