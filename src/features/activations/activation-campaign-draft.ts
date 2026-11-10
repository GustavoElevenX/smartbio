import { activationKey } from "./activation-utils";
import type { ActivationDynamicSurface } from "./dynamic-home-contract";

export function activationCampaignDraft(input: {
  name: string; title: string; message: string; conditions: string; conversionGoalId: string;
  mode: ActivationDynamicSurface["mode"];
}): ActivationDynamicSurface | undefined {
  const title = (input.title || input.name).trim();
  if (!title || !input.conversionGoalId) return undefined;
  return {
    mode: input.mode, experienceKey: activationKey(input.name || title), title,
    message: input.message.trim() || undefined, conversionGoalId: input.conversionGoalId,
    sections: input.conditions.trim() ? [{ key: "conditions", kind: "conditions", content: { text: input.conditions.trim() } }] : [],
  };
}
