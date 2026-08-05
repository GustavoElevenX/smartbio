import { buildPalette } from "@/features/brand-intelligence/colors";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { CapabilityPlanner } from "@/features/capabilities/capability-planner";
import { compositionOrchestrator } from "@/features/composition/composition-orchestrator";
import { assignProjectToCommercialConfig, defaultSlug, RuleBasedJourneyComposer } from "@/features/composition/journey-composer";
import { VisualComposer } from "@/features/composition/visual-composer";
import { uid } from "@/lib/utils";
import type { BrandProfile, ExperienceCompositionInput, Project } from "@/types";

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
    const brand: BrandProfile = input.brand || {
      extractedColors: ["#6D5EF5", "#FF725E", "#19B88B"],
      activePalette: buildPalette(["#6D5EF5", "#FF725E", "#19B88B"]),
      paletteVariations: [],
      brandPersonality: input.brandPersonality || ["Equilibrada"],
    };
    const now = new Date().toISOString();
    const id = uid("project");
    return {
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
  }
}

export class AIExperienceComposer {
  async compose(input: ExperienceCompositionInput): Promise<Project> {
    return compositionOrchestrator.compose(input);
  }
}

export class ExperienceComposerOrchestrator {
  async compose(input: ExperienceCompositionInput) {
    return compositionOrchestrator.compose(input);
  }
}

export const experienceComposer = new ExperienceComposerOrchestrator();
