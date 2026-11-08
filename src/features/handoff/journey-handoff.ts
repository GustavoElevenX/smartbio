import type { CommercialArchitecture } from "@/features/ai-setup/ai-setup.schema";
import type { BusinessLocation, FormField } from "@/types";
import { isFormFieldVisible } from "@/features/forms/form-field-utils";

export function withFreeTextRequest(fields: FormField[], answers: Record<string, unknown>): FormField[] {
  if (!String(answers.specific_request ?? "").trim() || fields.some((field) => field.key === "specific_request")) return fields;
  return [...fields, { id: "specific-request", key: "specific_request", label: "Pedido específico", type: "textarea", required: false, includeInHandoff: true }];
}

function displayValue(value: unknown, field: FormField) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  const text = String(value ?? "").trim();
  if (field.key === "fulfillment") return ({ delivery: "Entrega", pickup: "Retirada", digital: "Entrega digital", external: "Combinar com a equipe" }[text] || text);
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
  includeAll?: boolean;
  selectedLocation?: Pick<BusinessLocation, "id" | "name">;
  selectedOfferings?: Array<{ id: string; name: string }>;
  selections?: Array<{ stepId: string; stepTitle: string; optionId: string; optionLabel: string }>;
}) {
  const includeAll = input.includeAll === true || input.blueprint?.completion.handoffSummary === true;
  const entries = input.fields.flatMap((field) => {
    if (!isFormFieldVisible(field, input.answers)) return [];
    if (!includeAll && field.includeInHandoff === false) return [];
    const value = displayValue(input.answers[field.key], field);
    if (input.selectedLocation && [input.selectedLocation.id, input.selectedLocation.name].includes(value)) return [];
    return value ? [{ key: field.key, label: field.handoffLabel || field.label, value }] : [];
  });
  for (const selection of input.selections || []) {
    const label = selection.stepTitle.trim() || "Escolha";
    const value = selection.optionLabel.trim();
    if (!value || entries.some((item) => item.value.toLocaleLowerCase("pt-BR") === value.toLocaleLowerCase("pt-BR"))) continue;
    entries.push({ key: `choice_${selection.stepId}`, label, value });
  }
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
