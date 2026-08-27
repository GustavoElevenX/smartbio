import { buildPalette } from "@/features/brand-intelligence/colors";
import type { BrandProfile, ExperienceCompositionInput, JourneyStep, ProjectDesignSystem } from "@/types";

function hash(value: string) {
  return [...value].reduce((accumulator, character) => ((accumulator << 5) - accumulator + character.charCodeAt(0)) | 0, 0);
}

function defaultIdentity(input: ExperienceCompositionInput) {
  const palettes = [
    ["#0054FC", "#FF806B", "#20A985"],
    ["#315B65", "#D7A86E", "#7C9A78"],
    ["#6D4AFF", "#EC6F66", "#20A4A8"],
    ["#2F6B5B", "#F2B45B", "#D97A61"],
  ];
  const personalities = [
    ["Equilibrada", "Clara", "Confiante"],
    ["Acolhedora", "Natural", "Elegante"],
    ["Expressiva", "Próxima", "Contemporânea"],
    ["Humana", "Confiável", "Leve"],
  ];
  const identityIndex = Math.abs(hash(`${input.businessName}:${input.primaryGoal}:${input.primaryDestination}`)) % palettes.length;
  const goal = input.primaryGoal.trim().replace(/[.!?]+$/, "");
  return {
    colors: palettes[identityIndex],
    personality: personalities[identityIndex],
    subtitle: goal ? `${goal}, com um caminho claro do início ao próximo passo.` : "Um caminho claro do interesse ao próximo passo.",
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
    const palette = brand.activePalette || buildPalette(["#0054FC", "#0186FC", "#01D2DF", "#02E5CD"]);
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
