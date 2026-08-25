import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { validateSetupPhone } from "@/features/ai-setup/setup-phone";

export type AISetupLifecycleState =
  | "idle"
  | "initializing"
  | "active"
  | "saving"
  | "analyzing"
  | "generating"
  | "completed"
  | "invalid_session"
  | "recovering";

export function hasRelevantSetupInformation(session: AISetupSession | null) {
  if (!session) return false;
  return Boolean(
    session.initialInput.businessName.trim() ||
      session.initialInput.description.trim() ||
      session.initialInput.phone?.trim() ||
      Object.keys(session.answers).length ||
      session.sources.length,
  );
}

export function hasConfirmedSetupPhone(
  session: AISetupSession | null,
  editingBusinessInfo: boolean,
) {
  if (!session || editingBusinessInfo || !session.extractedProfile) return false;
  const result = validateSetupPhone(session.initialInput.phone);
  return Boolean(result.valid && result.normalized);
}
