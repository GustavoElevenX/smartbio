import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import type { Project } from "@/types";

export function stageGeneratedDraft(
  session: AISetupSession,
  projectDraft: Project,
  usedFallback: boolean,
): AISetupSession {
  return {
    ...session,
    status: "review",
    projectDraft,
    usedFallback,
  };
}
