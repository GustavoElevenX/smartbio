import "server-only";

import { capabilityPlanner } from "@/features/capabilities/capability-planner";
import { CompositionOrchestrator, type AIJourneyComposer } from "@/features/composition/composition-orchestrator";
import { journeyComposer } from "@/features/composition/journey-composer";
import { visualComposer } from "@/features/composition/visual-composer";
import { getAIProvider, isAIConfigured } from "@/server/ai/ai-client";
import { createServerBusinessAnalyzer } from "@/server/composition/create-server-business-analyzer";

export function createServerCompositionOrchestrator(context: { workspaceId: string; userId: string; setupSessionId?: string }) {
  const aiJourney: AIJourneyComposer | undefined = isAIConfigured() ? async (input, profile, capabilities) => getAIProvider().composeJourney({ input, profile, capabilities, answers: {}, workspaceId: context.workspaceId, userId: context.userId, setupSessionId: context.setupSessionId }) : undefined;
  return new CompositionOrchestrator(createServerBusinessAnalyzer(context), capabilityPlanner, journeyComposer, visualComposer, aiJourney);
}
