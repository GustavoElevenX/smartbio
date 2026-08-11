import type { ConversionGoal, EntryPoint, JourneyStep } from "@/types";

export interface ResolvedEntryPoint { entry?: EntryPoint; goal?: ConversionGoal; step?: JourneyStep; }

export function resolveEntryPoint(entries: EntryPoint[], goals: ConversionGoal[], steps: JourneyStep[], key?: string | null): ResolvedEntryPoint {
  if (!key) return {};
  const entry = entries.find((item) => item.isActive && item.key === key);
  if (!entry) return {};
  const goal = entry.conversionGoalId ? goals.find((item) => item.isActive && item.id === entry.conversionGoalId) : undefined;
  const targetStepId = entry.targetStepId || goal?.targetStepId;
  return { entry, goal, step: steps.find((item) => item.isActive && item.id === targetStepId) };
}
