import { businessCapabilityProfileSchema } from "@/features/business-understanding/business-profile.schema";
import type { BusinessCapabilityProfile, ExperienceCompositionInput } from "@/types";

export type BusinessAnalysisExecutor = (input: ExperienceCompositionInput) => Promise<unknown>;

export class AIBusinessAnalyzer {
  constructor(private readonly executor?: BusinessAnalysisExecutor) {}

  async analyze(input: ExperienceCompositionInput): Promise<BusinessCapabilityProfile> {
    if (!this.executor) throw new Error("Analisador de negócio por IA não configurado.");
    const payload = await this.executor(input);
    return businessCapabilityProfileSchema.parse(payload) as BusinessCapabilityProfile;
  }
}
