import { deterministicBusinessAnalyzer, type BusinessAnalyzer } from "@/features/business-understanding/analyze-business";
import { capabilityPlanner, type CapabilityPlanner } from "@/features/capabilities/capability-planner";
import { assignProjectToCommercialConfig, defaultSlug, journeyComposer, type RuleBasedJourneyComposer } from "@/features/composition/journey-composer";
import { defaultBrandProfile, defaultProjectSubtitle, visualComposer, type VisualComposer } from "@/features/composition/visual-composer";
import { features } from "@/lib/constants";
import { uid } from "@/lib/utils";
import type { AIJourneyDraftPayload } from "@/features/composition/composition.schema";
import { aiJourneyDraftSchema } from "@/features/composition/composition.schema";
import { applyAIJourneyDraft } from "@/features/composition/apply-ai-journey-draft";
import type { ExperienceCompositionInput, JourneyStep, Project, ProjectCapability } from "@/types";
import { synthesizePublicDescription } from "@/features/composition/public-copy";
import type { CommercialArchitecture } from "@/features/ai-setup/ai-setup.schema";

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
    private readonly analyzer: BusinessAnalyzer = deterministicBusinessAnalyzer,
    private readonly planner: Pick<CapabilityPlanner, "plan"> = capabilityPlanner,
    private readonly journey: RuleBasedJourneyComposer = journeyComposer,
    private readonly visual: VisualComposer = visualComposer,
    private readonly aiJourney?: AIJourneyComposer,
    private readonly commercialArchitecture?: CommercialArchitecture,
  ) {}

  async compose(input: ExperienceCompositionInput): Promise<Project> {
    const id = uid("project");
    const profile = await this.analyzer.analyze(input);
    let capabilities = this.planner.plan(profile);
    let composition = this.journey.compose(input, profile, capabilities, this.commercialArchitecture);
    let conversionGoals: Project["conversionGoals"];
    if (features.aiJourneyComposition && this.aiJourney && !this.commercialArchitecture) {
      try {
        const draft = aiJourneyDraftSchema.parse(await this.aiJourney(input, profile, capabilities));
        const applied = applyAIJourneyDraft({ deterministic: composition, draft, profile, projectId: id, existingCapabilities: capabilities });
        capabilities = applied.capabilities;
        conversionGoals = applied.conversionGoals;
        composition = { steps: sanitizeAIJourney(applied.steps), commercialConfig: applied.commercialConfig, requirements: applied.requirements };
      } catch {
        // The deterministic composition remains complete enough to edit and safe to persist.
      }
    }
    const brand = input.brand || defaultBrandProfile(input);
    const now = new Date().toISOString();
    const project: Project = {
      id,
      workspaceId: "local-workspace",
      name: input.businessName,
      slug: defaultSlug(input),
      description: synthesizePublicDescription({ businessName: input.businessName, primaryGoal: input.primaryGoal }),
      subtitle: defaultProjectSubtitle(input),
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
      conversionGoals,
      dataRequirements: composition.requirements,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    return project;
  }
}

export const deterministicCompositionOrchestrator = new CompositionOrchestrator();
