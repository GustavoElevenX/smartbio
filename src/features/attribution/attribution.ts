import type { AttributionContext, EntryPoint } from "@/types";
import { sourceFromReferrer } from "./referrer";
import type { UtmValues } from "./utm";

export function resolveAttribution(input: { explicit: UtmValues; entry?: EntryPoint; referrer?: string; conversionGoalId?: string }): AttributionContext {
  const entry = input.entry;
  return {
    entryPointId: entry?.id, conversionGoalId: input.conversionGoalId || entry?.conversionGoalId,
    source: input.explicit.source || entry?.utmSource || sourceFromReferrer(input.referrer),
    medium: input.explicit.medium || entry?.utmMedium,
    campaign: input.explicit.campaign || entry?.utmCampaign,
    content: input.explicit.content || entry?.utmContent,
    term: input.explicit.term || entry?.utmTerm,
    referrer: input.referrer,
  };
}
