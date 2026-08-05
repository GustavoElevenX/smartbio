import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import type { DataRequirement } from "@/types";

export interface SetupReadiness {
  progress: number;
  verified: number;
  total: number;
  blocking: number;
  readyToGenerate: boolean;
}

export function calculateSetupReadiness(requirements: DataRequirement[], session?: Pick<AISetupSession, "initialInput">): SetupReadiness {
  const baseSignals = session
    ? [session.initialInput.businessName, session.initialInput.description, session.initialInput.websiteUrl || session.initialInput.phone]
    : [];
  const baseVerified = baseSignals.filter(Boolean).length;
  const verified = requirements.filter((item) => item.status === "verified").length;
  const blocking = requirements.filter((item) => item.severity === "blocking" && item.status !== "verified").length;
  const total = requirements.length + baseSignals.length;
  const completed = verified + baseVerified;
  return {
    progress: total ? Math.round((completed / total) * 100) : 0,
    verified,
    total: requirements.length,
    blocking,
    readyToGenerate: Boolean(session?.initialInput.businessName && session.initialInput.description.length >= 15),
  };
}
