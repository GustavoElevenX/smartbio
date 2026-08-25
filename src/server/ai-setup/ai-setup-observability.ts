import "server-only";
import type { AISetupActor } from "@/server/auth/setup-actor";

export type AISetupLifecycleEvent =
  | "onboarding_session_created"
  | "onboarding_session_resumed"
  | "onboarding_session_invalid"
  | "onboarding_session_recovered"
  | "onboarding_session_restarted"
  | "onboarding_analyze_failed"
  | "onboarding_generate_failed";

export function logAISetupLifecycle(
  event: AISetupLifecycleEvent,
  actor: AISetupActor,
  sessionId?: string,
  details: { code?: string; status?: string } = {},
) {
  console.info(event, {
    sessionId,
    workspaceId: actor.workspaceId,
    userId: actor.userId,
    persistence: actor.persistence,
    ...details,
  });
}
