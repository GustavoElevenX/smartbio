import type { CommercialArchitecture } from "@/features/ai-setup/ai-setup.schema";
import type { BusinessLocation, FormField } from "@/types";

function displayValue(value: unknown, field: FormField) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  const text = String(value ?? "").trim();
  if (field.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}/${month}/${year}`;
  }
  return text;
}

export function buildJourneyHandoff(input: {
  blueprint?: CommercialArchitecture["journeyBlueprints"][number];
  intent?: CommercialArchitecture["intents"][number] | { label: string };
  answers: Record<string, unknown>;
  fields: FormField[];
  selectedLocation?: Pick<BusinessLocation, "id" | "name">;
  selectedOfferings?: Array<{ id: string; name: string }>;
}) {
  const includeAll = input.blueprint?.completion.handoffSummary === true;
  const entries = input.fields.flatMap((field) => {
    if (!includeAll && !field.includeInHandoff) return [];
    const value = displayValue(input.answers[field.key], field);
    return value ? [{ key: field.key, label: field.handoffLabel || field.label, value }] : [];
  });
  if (input.selectedOfferings?.length && !entries.some((item) => /produto|oferta|servi/i.test(item.label))) {
    entries.push({ key: "selected_offerings", label: input.selectedOfferings.length > 1 ? "Opções" : "Opção", value: input.selectedOfferings.map((item) => item.name).join(", ") });
  }
  return {
    interest: input.intent?.label,
    location: input.selectedLocation?.name,
    entries,
    answers: Object.fromEntries(entries.map((entry) => [entry.label, entry.value])),
  };
}
