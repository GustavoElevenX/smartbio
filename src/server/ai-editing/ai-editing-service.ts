import "server-only";
import { z } from "zod";
import { preserveStepOperationalFields } from "@/features/ai-editing/protected-fields";
import { getAIProvider, isAIConfigured } from "@/server/ai/ai-client";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import type { JourneyStep, Project } from "@/types";

export const copyInputSchema = z.object({
  projectId: z.uuid(), stepId: z.string().optional(), fieldPath: z.string().min(1).max(240),
  currentValue: z.string().min(1).max(4000),
  action: z.enum(["improve", "shorten", "make_direct", "make_premium", "make_friendly", "generate_variations", "fix"]),
  customInstruction: z.string().max(500).optional(),
});
const actionMap = { improve: "improve", shorten: "shorten", make_direct: "direct", make_premium: "premium", make_friendly: "adapt_tone", generate_variations: "variations", fix: "correct" } as const;
function fallbackCopy(value: string, action: z.infer<typeof copyInputSchema>["action"]) { if (action === "shorten") return value.split(/(?<=[.!?])\s+/)[0].slice(0, Math.max(40, Math.ceil(value.length * .65))); if (action === "fix") return value.trim().replace(/\s+/g, " "); return value.trim(); }

export async function generateCopySuggestions(actor: AuthenticatedActor, rawInput: unknown) {
  const input = copyInputSchema.parse(rawInput);
  await assertProjectAccess(actor, input.projectId, "write");
  const project = await loadProjectForActor(actor, input.projectId);
  if (!project && actor.persistence !== "memory") throw new Error("Projeto não encontrado.");
  if (!isAIConfigured()) return { suggestions: [fallbackCopy(input.currentValue, input.action)], usedFallback: true };
  const context = project ? `${project.name}: ${project.description}. Campo: ${input.fieldPath}. ${input.customInstruction || ""}` : `Campo: ${input.fieldPath}. ${input.customInstruction || ""}`;
  const result = await getAIProvider().generateCopy({ workspaceId: actor.workspaceId, projectId: input.projectId, userId: actor.userId, field: input.fieldPath.toLowerCase().includes("title") ? "title" : input.fieldPath.toLowerCase().includes("cta") ? "cta" : "text", value: input.currentValue, action: actionMap[input.action], tone: input.action === "make_friendly" ? "amigável" : undefined, businessContext: context });
  return { suggestions: result.suggestions, usedFallback: false };
}

const projectSnapshotSchema = z.custom<Project>((value) => Boolean(value && typeof value === "object"));
const stepInputSchema = z.object({ instruction: z.string().max(500).optional(), projectSnapshot: projectSnapshotSchema.optional() });
export async function regenerateStep(actor: AuthenticatedActor, projectId: string, stepId: string, rawInput: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const input = stepInputSchema.parse(rawInput);
  const project = actor.persistence === "memory" ? input.projectSnapshot : await loadProjectForActor(actor, projectId);
  if (!project || project.id !== projectId) throw new Error("Projeto não encontrado.");
  const index = project.steps.findIndex((step) => step.id === stepId);
  if (index < 0) throw new Error("Etapa não encontrada.");
  const before = project.steps[index];
  let after: JourneyStep = structuredClone(before);
  let usedFallback = !isAIConfigured();
  if (isAIConfigured()) {
    try {
      const context = `Negócio: ${project.name}. Propósito: ${before.type}. Anterior: ${project.steps[index - 1]?.title || "início"}. Próxima: ${project.steps[index + 1]?.title || "fim"}. Capacidades: ${(project.capabilities || []).filter((item) => item.enabled).map((item) => item.key).join(", ")}. Instrução: ${input.instruction || "melhorar clareza"}`;
      const [title, description] = await Promise.all([
        getAIProvider().generateCopy({ workspaceId: actor.workspaceId, projectId, userId: actor.userId, field: "title", value: before.title, action: "improve", businessContext: context }),
        before.description ? getAIProvider().generateCopy({ workspaceId: actor.workspaceId, projectId, userId: actor.userId, field: "text", value: before.description, action: "improve", businessContext: context }) : Promise.resolve({ suggestions: [] }),
      ]);
      after = preserveStepOperationalFields(before, { ...before, title: title.suggestions[0] || before.title, description: description.suggestions[0] || before.description });
      usedFallback = false;
    } catch { usedFallback = true; }
  }
  return { before, after, diff: { title: before.title === after.title ? undefined : { before: before.title, after: after.title }, description: before.description === after.description ? undefined : { before: before.description, after: after.description } }, usedFallback };
}

const visualInputSchema = z.object({ instruction: z.string().min(2).max(500), projectSnapshot: projectSnapshotSchema.optional() });
export async function regenerateVisualDirection(actor: AuthenticatedActor, projectId: string, rawInput: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const input = visualInputSchema.parse(rawInput);
  const project = actor.persistence === "memory" ? input.projectSnapshot : await loadProjectForActor(actor, projectId);
  if (!project || project.id !== projectId) throw new Error("Projeto não encontrado.");
  const before = structuredClone(project.designSystem);
  let aiDirection = project.visualDirection;
  let usedFallback = !isAIConfigured();
  if (isAIConfigured() && getAIProvider().analyzeBrand) {
    try { const result = await getAIProvider().analyzeBrand!({ workspaceId: actor.workspaceId, projectId, userId: actor.userId, businessName: project.name, businessDescription: `${project.description}\nInstrução visual: ${input.instruction}`, extractedColors: project.brand.extractedColors }); aiDirection = result.visualDirection; usedFallback = false; }
    catch { usedFallback = true; }
  }
  const lower = `${input.instruction} ${aiDirection}`.toLowerCase();
  const after: Project["designSystem"] = structuredClone(before);
  if (lower.includes("premium")) { after.spacing.density = "spacious"; after.typography.headingWeight = 800; after.elevation.cardShadow = "0 18px 60px rgba(20,18,32,.16)"; after.cards.style = "elevated"; }
  if (lower.includes("minimal")) { after.spacing.density = "balanced"; after.cards.style = "outlined"; after.motion.transition = "fade"; after.shape.cardRadius = Math.min(after.shape.cardRadius, 18); }
  if (lower.includes("vibr")) { after.cards.style = "gradient"; after.buttons.style = "gradient"; after.motion.cardHover = true; }
  if (lower.includes("produto")) { after.spacing.cardGap = Math.max(after.spacing.cardGap, 18); after.cards.style = "elevated"; }
  return { before, after, visualDirection: aiDirection, diff: { spacing: before.spacing, nextSpacing: after.spacing, cards: before.cards, nextCards: after.cards, typography: before.typography, nextTypography: after.typography }, usedFallback };
}
