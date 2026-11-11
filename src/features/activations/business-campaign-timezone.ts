import type { Project } from "@/types";

const fallbackTimezone = "America/Sao_Paulo";

function validTimezone(value: string | undefined): value is string {
  if (!value) return false;
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: value }); return true; }
  catch { return false; }
}

/** Usa a unidade escolhida, depois a principal do negócio e por fim a regra de agenda. */
export function businessCampaignTimezone(project: Project | null | undefined, locationIds: string[] = []): string {
  const active = (project?.commercialConfig?.locations || []).filter((item) => item.isActive);
  const selected = locationIds.map((id) => active.find((item) => item.id === id)).find((item) => validTimezone(item?.timezone));
  if (selected && validTimezone(selected.timezone)) return selected.timezone;
  const primary = active.toSorted((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .find((item) => validTimezone(item.timezone));
  if (primary) return primary.timezone;
  const rule = project?.commercialConfig?.availabilityRules?.find((item) => validTimezone(item.timezone));
  return rule?.timezone || fallbackTimezone;
}
