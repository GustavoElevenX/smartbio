import { resolveVisualIntent } from "./visual-intent";
import { mix, readableForeground, buildPalette } from "@/features/brand-intelligence/colors";
import type { BrandProfile, ExperienceCompositionInput, JourneyStep, ProjectDesignSystem } from "@/types";

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
  const identityIndex = ({ clear: 0, editorial: 1, expressive: 2, organic: 3, essential: 0 })[resolveVisualIntent(input)];
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
    const intent = resolveVisualIntent({ ...input, brandPersonality: input.brandPersonality || brand.brandPersonality });
    const dark = input.preferredTheme === "dark";
    const expressive = intent === "expressive";
    const editorial = intent === "editorial";
    const organic = intent === "organic";
    const spacious = editorial || organic;
    const colors = { ...palette };
    if (input.preferredTheme === "dark" || input.preferredTheme === "light") {
      colors.background = mix(palette.primary, dark ? "#090D12" : "#FFFFFF", dark ? .92 : .97);
      colors.surface = dark ? "#171C24" : "#FFFFFF";
      colors.surfaceElevated = dark ? "#222935" : "#FFFFFF";
      colors.foreground = readableForeground(colors.background);
      colors.mutedForeground = dark ? "#BDC6D3" : "#495463";
      colors.muted = mix(colors.background, colors.foreground, .07);
      colors.border = mix(colors.background, colors.foreground, .2);
    }
    return {
      mode: dark ? "dark" : input.preferredTheme || "light",
      colors,
      typography: {
        headingFont: editorial ? "Manrope" : expressive ? "Sora" : "Plus Jakarta Sans",
        bodyFont: "Inter",
        headingWeight: editorial || organic ? 600 : 800,
        bodyWeight: 450,
        scale: expressive || editorial ? "expressive" : intent === "essential" ? "compact" : "standard",
      },
      shape: { cardRadius: organic ? 16 : 12, buttonRadius: organic ? 16 : editorial ? 4 : 12, inputRadius: 14, borderWidth: 1 },
      elevation: { cardShadow: "0 16px 40px rgba(20,20,35,.10)", floatingShadow: "0 24px 70px rgba(12,12,20,.18)", glowColor: palette.primary, glowIntensity: 0 },
      spacing: { density: input.preferredDensity === "immersive" ? "spacious" : input.preferredDensity || (spacious ? "spacious" : "balanced"), sectionGap: spacious ? 40 : journey.length > 5 ? 24 : 32, cardGap: spacious ? 16 : 12 },
      imagery: { decorativeStyle: "none", overlayOpacity: dark ? 0.3 : 0.06 },
      motion: { transition: "fade", duration: 180, cardHover: true },
      buttons: { style: "solid", height: "large", iconPosition: "right" },
      cards: { style: intent === "essential" || editorial ? "flat" : "outlined", borderColor: colors.border, surfaceOpacity: 1 },
    };
  }
}

export const visualComposer = new VisualComposer();
