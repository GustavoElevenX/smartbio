import { capabilityRegistry, createCapability } from "@/features/capabilities/capability-registry";
import { draftCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import type { AIJourneyDraftPayload } from "@/features/composition/composition.schema";
import { mergeCommercialConfig } from "@/features/composition/merge-commercial-config";
import type { JourneyComposition } from "@/features/composition/journey-composer";
import type { BusinessCapabilityProfile, ConversionGoal, DataRequirement, JourneyStep, Project, ProjectCapability } from "@/types";

export interface AppliedAIJourneyDraft {
  steps: JourneyStep[];
  conversionGoals: ConversionGoal[];
  capabilities: ProjectCapability[];
  commercialConfig: NonNullable<Project["commercialConfig"]>;
  requirements: DataRequirement[];
  conflicts: ReturnType<typeof mergeCommercialConfig>["conflicts"];
}

function dedupeRequirements(values: DataRequirement[]) {
  const map = new Map<string, DataRequirement>();
  for (const value of values) {
    const current = map.get(value.key);
    if (!current || current.status !== "verified") map.set(value.key, value);
  }
  return [...map.values()];
}

export function applyAIJourneyDraft(input: {
  deterministic: JourneyComposition;
  draft: AIJourneyDraftPayload;
  profile: BusinessCapabilityProfile;
  projectId: string;
  existingCapabilities?: ProjectCapability[];
}): AppliedAIJourneyDraft {
  const capabilities = new Map<ProjectCapability["key"], ProjectCapability>();
  for (const capability of input.existingCapabilities || []) capabilities.set(capability.key, capability);
  for (const capability of input.draft.suggestedCapabilities) {
    if (!(capability.key in capabilityRegistry)) continue;
    const existing = capabilities.get(capability.key);
    if (existing?.source === "user") continue;
    const base = createCapability(capability.key, "ai", capability.configuration);
    capabilities.set(capability.key, { ...base, enabled: capability.enabled && capabilityRegistry[capability.key].enabledByFeature, source: "ai", version: capability.version });
  }
  const deterministicCapabilities = Object.values(capabilityRegistry)
    .filter((definition) => input.deterministic.requirements.some((requirement) => requirement.capability === definition.key))
    .map((definition) => createCapability(definition.key));
  for (const capability of deterministicCapabilities) if (!capabilities.has(capability.key)) capabilities.set(capability.key, capability);
  const merged = mergeCommercialConfig(input.deterministic.commercialConfig, input.draft.commercialConfigPatch, input.projectId);
  const commercialConfig = merged.value;
  const planned = [...capabilities.values()];
  const fallbackStepId = input.draft.steps[0]?.id || input.deterministic.steps[0]?.id || "";
  const stepIds = new Set(input.draft.steps.map((step) => step.id));
  const conversionGoals = input.draft.suggestedConversionGoals.map((goal, order) => ({
    id: `goal-${goal.key}`,
    projectId: input.projectId,
    name: goal.name,
    description: goal.description,
    kind: goal.type,
    targetStepId: goal.entryStepKey && stepIds.has(goal.entryStepKey) ? goal.entryStepKey : fallbackStepId,
    isPrimary: order === 0,
    isActive: true,
    order,
  }));
  return {
    steps: input.draft.steps as JourneyStep[],
    conversionGoals,
    capabilities: planned,
    commercialConfig,
    requirements: dedupeRequirements([...input.deterministic.requirements, ...draftCapabilityRequirements(planned), ...(input.draft.requirements as DataRequirement[]), ...merged.requirements]),
    conflicts: merged.conflicts,
  };
}
