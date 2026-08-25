import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { CapabilityPlanner } from "@/features/capabilities/capability-planner";
import { deterministicCompositionOrchestrator } from "@/features/composition/composition-orchestrator";
import { assignProjectToCommercialConfig, defaultSlug, RuleBasedJourneyComposer } from "@/features/composition/journey-composer";
import { defaultBrandProfile, defaultProjectSubtitle, VisualComposer } from "@/features/composition/visual-composer";
import { uid } from "@/lib/utils";
import { synthesizePublicDescription } from "@/features/composition/public-copy";
import type { ExperienceCompositionInput, Project } from "@/types";

/** Compatibility facade for callers and tests that require synchronous deterministic composition. */
export class RuleBasedExperienceComposer {
  private readonly analyzer = new RuleBasedBusinessAnalyzer();
  private readonly planner = new CapabilityPlanner();
  private readonly journey = new RuleBasedJourneyComposer();
  private readonly visual = new VisualComposer();

  compose(input: ExperienceCompositionInput): Project {
    const profile = this.analyzer.analyze(input);
    const capabilities = this.planner.plan(profile);
    const composition = this.journey.compose(input, profile, capabilities);
    const brand = input.brand || defaultBrandProfile(input);
    const now = new Date().toISOString();
    const id = uid("project");
    return {
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
      dataRequirements: composition.requirements,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
  }
}

export class AIExperienceComposer {
  async compose(input: ExperienceCompositionInput): Promise<Project> {
    return deterministicCompositionOrchestrator.compose(input);
  }
}

export class ExperienceComposerOrchestrator {
  async compose(input: ExperienceCompositionInput) {
    return deterministicCompositionOrchestrator.compose(input);
  }
}

export const experienceComposer = new ExperienceComposerOrchestrator();
