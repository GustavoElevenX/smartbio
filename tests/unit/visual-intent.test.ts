import { resolveVisualIntent } from "@/features/composition/visual-intent";
import { expect, it } from "vitest";
import { defaultBrandProfile, visualComposer } from "@/features/composition/visual-composer";
import { contrastRatio } from "@/features/brand-intelligence/colors";
import type { ExperienceCompositionInput } from "@/types";

const input: ExperienceCompositionInput = { businessName: "Ateliê", businessDescription: "Peças feitas à mão", primaryGoal: "Consultar peças", primaryDestination: "WhatsApp", slug: "atelie" };
it("preserva identidade ao renomear e interpreta toda a personalidade", () => {
  const brief = { ...input, brandPersonality: ["Confiante", "Editorial"] };
  const brand = defaultBrandProfile(brief);
  const design = visualComposer.compose(brief, brand, []);
  expect(visualComposer.compose({ ...brief, businessName: "Outro nome" }, brand, [])).toEqual(design);
  expect(design.typography.headingFont).toBe("Manrope");
  expect(design.colors.primary).toBe(brand.activePalette.primary);
});
it("respeita tema claro mesmo com direção premium e mantém contraste no escuro", () => {
  const brief = { ...input, visualDirection: "Premium editorial", preferredTheme: "light" as const };
  const brand = defaultBrandProfile(brief);
  expect(visualComposer.compose(brief, brand, []).mode).toBe("light");
  const dark = visualComposer.compose({ ...brief, preferredTheme: "dark" }, brand, []);
  expect(contrastRatio(dark.colors.foreground, dark.colors.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(dark.colors.mutedForeground, dark.colors.background)).toBeGreaterThanOrEqual(4.5);
});
it("direções distintas mudam tipografia, ritmo e forma sem mudar a cor confirmada", () => {
  const brand = defaultBrandProfile(input);
  const essential = visualComposer.compose({ ...input, visualDirection: "Minimalista" }, brand, []);
  const expressive = visualComposer.compose({ ...input, visualDirection: "Criativa e vibrante" }, brand, []);
  expect(essential.typography).not.toEqual(expressive.typography);
  expect(essential.cards.style).not.toBe(expressive.cards.style);
  expect(essential.colors.primary).toBe(expressive.colors.primary);
});

it("prioriza o pedido visual sobre a personalidade anterior", () => {
  expect(resolveVisualIntent({ visualDirection: "Criativa e vibrante", brandPersonality: ["Elegante", "Minimalista"] })).toBe("expressive");
});
