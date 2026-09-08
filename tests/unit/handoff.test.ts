import { describe, expect, it } from "vitest";
import { formatCommercialHandoff, formatHandoffUrl, toPerformanceEvidence } from "@/features/handoff/handoff-formatter";
import type { CommercialHandoffContext } from "@/features/handoff/commercial-handoff-context";
import { contactIdentityFromFields } from "@/features/forms/form-field-utils";

const context: CommercialHandoffContext = { projectId: "p", conversionGoalId: "goal-b2b", origin: { source: "linkedin", campaign: "industrial" }, identity: { name: "Ana", phone: "5511999999999", email: "ana@example.com" }, intent: { label: "Cotação industrial", productIds: ["motor-10"], serviceIds: ["instalacao"] }, qualification: [{ label: "Volume mensal", value: "500 unidades", include: true }, { label: "Anotação privada", value: "não enviar", include: false }], benefit: { label: "Condição B2B", code: "B2B10" } };

describe("commercial handoff", () => {
  it("reconhece a identidade por rótulo e tipo sem depender das chaves geradas pela IA", () => {
    expect(contactIdentityFromFields([
      { id: "n", key: "customer_name", label: "Nome", type: "text", required: true },
      { id: "p", key: "contact_number", label: "Contato", type: "phone", required: true },
    ], { customer_name: "Ana", contact_number: "5511999999999" })).toEqual({ name: "Ana", phone: "5511999999999" });
  });
  it("não duplica identidade que já está no resumo", () => {
    const message = formatCommercialHandoff({ ...context, qualification: [{ label: "Nome", value: "Ana", include: true }] });
    expect(message.match(/Nome: Ana/g)).toHaveLength(1);
  });
  it("formats B2B context and a valid WhatsApp URL", () => {
    const message = formatCommercialHandoff(context);
    expect(message).toContain("Contexto recebido pela Sobe");
    expect(message).toContain("Volume mensal: 500 unidades");
    expect(message).not.toContain("não enviar");
    expect(formatHandoffUrl("https://wa.me/551100000000", context)).toContain("text=");
  });
  it("removes PII and raw values from performance evidence", () => {
    const evidence = toPerformanceEvidence(context);
    expect(JSON.stringify(evidence)).not.toContain("ana@example.com");
    expect(JSON.stringify(evidence)).not.toContain("500 unidades");
  });
});
