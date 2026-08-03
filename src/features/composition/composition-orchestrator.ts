import { buildPalette } from "@/features/brand-intelligence/colors";
import { businessAnalyzer, type BusinessAnalyzer } from "@/features/business-understanding/analyze-business";
import { capabilityPlanner, type CapabilityPlanner } from "@/features/capabilities/capability-planner";
import { assignProjectToCommercialConfig, defaultSlug, journeyComposer, type RuleBasedJourneyComposer } from "@/features/composition/journey-composer";
import { visualComposer, type VisualComposer } from "@/features/composition/visual-composer";
import { features } from "@/lib/constants";
import { uid } from "@/lib/utils";
import type { BrandProfile, ExperienceCompositionInput, Project } from "@/types";

export class CompositionOrchestrator {
  constructor(
    private readonly analyzer: BusinessAnalyzer = businessAnalyzer,
    private readonly planner: CapabilityPlanner = capabilityPlanner,
    private readonly journey: RuleBasedJourneyComposer = journeyComposer,
    private readonly visual: VisualComposer = visualComposer,
  ) {}

  async compose(input: ExperienceCompositionInput): Promise<Project> {
    const profile = await this.analyzer.analyze(input);
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
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    void features.aiJourneyComposition;
    return project;
  }
}

export const compositionOrchestrator = new CompositionOrchestrator();
