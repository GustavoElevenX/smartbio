import "server-only";

import { AIBusinessAnalyzer } from "@/features/business-understanding/ai-business-analyzer";
import { BusinessAnalyzerOrchestrator, type BusinessAnalyzer } from "@/features/business-understanding/analyze-business";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { getAIProvider, isAIConfigured } from "@/server/ai/ai-client";

export function createServerBusinessAnalyzer(context: { workspaceId: string; userId: string; setupSessionId?: string }): BusinessAnalyzer {
  const ai = new AIBusinessAnalyzer(async (input) => {
    if (!isAIConfigured()) throw new Error("IA não configurada.");
    const result = await getAIProvider().analyzeBusiness({ input, workspaceId: context.workspaceId, userId: context.userId, setupSessionId: context.setupSessionId });
    return result.profile;
  });
  return new BusinessAnalyzerOrchestrator(new RuleBasedBusinessAnalyzer(), ai);
}
