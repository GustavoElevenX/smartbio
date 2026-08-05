import { buildPalette } from "@/features/brand-intelligence/colors";
import { businessAnalyzer, type BusinessAnalyzer } from "@/features/business-understanding/analyze-business";
import { capabilityPlanner, type CapabilityPlanner } from "@/features/capabilities/capability-planner";
import { assignProjectToCommercialConfig, defaultSlug, journeyComposer, type RuleBasedJourneyComposer } from "@/features/composition/journey-composer";
import { visualComposer, type VisualComposer } from "@/features/composition/visual-composer";
import { features } from "@/lib/constants";
import { uid } from "@/lib/utils";
import type { AIJourneyDraftPayload } from "@/features/composition/composition.schema";
import { aiJourneyDraftSchema } from "@/features/composition/composition.schema";
import type { BrandProfile, ExperienceCompositionInput, JourneyStep, Project, ProjectCapability } from "@/types";

export type AIJourneyComposer = (input: ExperienceCompositionInput, projectProfile: NonNullable<Project["businessProfile"]>, capabilities: ProjectCapability[]) => Promise<AIJourneyDraftPayload>;

function sanitizeAIJourney(steps: JourneyStep[]) {
  const ids = new Set(steps.map((step) => step.id));
  return steps.map((step, order) => ({
    ...step,
    order,
    options: step.options?.filter((option) => option.actionType !== "go_to_step" || Boolean(option.targetStepId && ids.has(option.targetStepId))),
  }));
}

export class CompositionOrchestrator {
  constructor(
    private readonly analyzer: BusinessAnalyzer = businessAnalyzer,
    private readonly planner: CapabilityPlanner = capabilityPlanner,
    private readonly journey: RuleBasedJourneyComposer = journeyComposer,
    private readonly visual: VisualComposer = visualComposer,
    private readonly aiJourney?: AIJourneyComposer,
  ) {}

  async compose(input: ExperienceCompositionInput): Promise<Project> {
    const profile = await this.analyzer.analyze(input);
    const capabilities = this.planner.plan(profile);
    let composition = this.journey.compose(input, profile, capabilities);
    if (features.aiJourneyComposition && this.aiJourney) {
      try {
        const draft = aiJourneyDraftSchema.parse(await this.aiJourney(input, profile, capabilities));
        composition = {
          ...composition,
          steps: sanitizeAIJourney(draft.steps as JourneyStep[]),
          requirements: draft.requirements,
        };
      } catch {
        // The deterministic composition remains complete enough to edit and safe to persist.
      }
    }
    const brand: BrandProfile = input.brand || {
      extractedColors: ["#6D5EF5", "#FF725E", "#19B88B"],
      activePalette: buildPalette(["#6D5EF5", "#FF725E", "#19B88B"]),
      paletteVariations: [],
      brandPersonality: input.brandPersonality || ["Equilibrada"],
    };
    const now = new Date().toISOString();
    const id = uid("project");
    const project: Project = {
      id,
      workspaceId: "local-workspace",
      name: input.businessName,
      slug: defaultSlug(input),
      description: input.businessDescription,
      subtitle: "Da atenção ao próximo passo comercial.",
      status: "draft",
      primaryGoal: input.primaryGoal,
      primaryDestination: input.primaryDestination,
      category: input.category,
      audience: input.audience,
      phone: input.phone,
      visualDirection: input.visualDirection || "Equilibrada",
      brand,
      designSystem: this.visual.compose({ ...input, brand }, brand, composition.steps),
      businessProfile: profile,
      capabilities,
      commercialConfig: assignProjectToCommercialConfig(composition.commercialConfig, id),
      steps: composition.steps,
      dataRequirements: composition.requirements,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    return project;
  }
}

export const compositionOrchestrator = new CompositionOrchestrator();
