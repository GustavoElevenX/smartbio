import { features } from "@/lib/constants";
import { AIBusinessAnalyzer } from "@/features/business-understanding/ai-business-analyzer";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import type { BusinessCapabilityProfile, ExperienceCompositionInput } from "@/types";

export interface BusinessAnalyzer {
  analyze(input: ExperienceCompositionInput): BusinessCapabilityProfile | Promise<BusinessCapabilityProfile>;
}

export class BusinessAnalyzerOrchestrator {
  constructor(
    private readonly rules: BusinessAnalyzer = new RuleBasedBusinessAnalyzer(),
    private readonly ai: BusinessAnalyzer = new AIBusinessAnalyzer(),
  ) {}

  async analyze(input: ExperienceCompositionInput) {
    if (features.aiBusinessAnalysis) {
      try {
        return await this.ai.analyze(input);
      } catch {
        // The deterministic analyzer is the guaranteed fallback.
      }
    }
    return this.rules.analyze(input);
  }
}

export const deterministicBusinessAnalyzer = new BusinessAnalyzerOrchestrator(
  new RuleBasedBusinessAnalyzer(),
  { analyze: () => { throw new Error("Executor de IA indisponível no analisador determinístico."); } },
);
