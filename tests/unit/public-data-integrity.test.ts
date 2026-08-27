import { describe, expect, it } from "vitest";
import { POST as submitEvent } from "@/app/api/events/route";
import { POST as submitLead } from "@/app/api/leads/route";
import { derivePublicLeadQualification } from "@/features/leads/public-lead";
import {
  leadSchema,
  publicAnalyticsEventSchema,
  serverAnalyticsEventNames,
} from "@/lib/validation/schemas";

const eventPayload = (eventName: string) => ({
  projectId: "project",
  visitorId: "visitor",
  sessionId: "session",
  eventName,
});

const leadPayload = {
  projectId: "project",
  sessionId: "session",
  name: "Ana",
  phone: "11999999999",
  answers: { investimento: "12000" },
  honeypot: "",
};

describe("integridade dos eventos públicos", () => {
  it("aceita um evento público legítimo", async () => {
    expect(publicAnalyticsEventSchema.safeParse(eventPayload("page_view")).success).toBe(true);
    const response = await submitEvent(new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify(eventPayload("page_view")),
    }));
    expect(response.status).toBe(202);
  });

  it.each(["conversion_confirmed", "opportunity_created", "conversion_lost"])(
    "rejeita %s enviado por cliente anônimo",
    async (eventName) => {
      expect(publicAnalyticsEventSchema.safeParse(eventPayload(eventName)).success).toBe(false);
      const response = await submitEvent(new Request("http://localhost/api/events", {
        method: "POST",
        body: JSON.stringify(eventPayload(eventName)),
      }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: { code: "validation_error" },
      });
    },
  );

  it("mantém todo evento de autoridade do servidor fora do contrato público", () => {
    for (const eventName of serverAnalyticsEventNames) {
      expect(publicAnalyticsEventSchema.safeParse(eventPayload(eventName)).success).toBe(false);
    }
  });
});

describe("integridade da criação pública de leads", () => {
  it("mantém a criação legítima de lead funcional", async () => {
    expect(leadSchema.safeParse(leadPayload).success).toBe(true);
    const response = await submitLead(new Request("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify(leadPayload),
    }));
    expect(response.status).toBe(202);
  });

  it.each([
    ["status", "converted"],
    ["qualificationBand", "qualified"],
    ["score", 1000],
    ["estimatedValue", 100_000_000],
    ["qualificationReason", "eu decidi"],
    ["commercialAction", "payment"],
    ["commercialObjectId", "internal-id"],
    ["operationalStatus", "paid"],
    ["scheduledAt", "2026-08-27T12:00:00.000Z"],
    ["timeline", [{ label: "Convertido", at: "2026-08-27T12:00:00.000Z" }]],
  ])("rejeita o campo interno %s", (field, value) => {
    expect(leadSchema.safeParse({ ...leadPayload, [field]: value }).success).toBe(false);
  });

  it("não persiste um lead quando o cliente tenta enviar status comercial", async () => {
    const response = await submitLead(new Request("http://localhost/api/leads", {
      method: "POST",
      body: JSON.stringify({ ...leadPayload, status: "converted" }),
    }));
    expect(response.status).toBe(400);
  });

  it("remove campos derivados escondidos dentro de answers antes de qualificar", () => {
    const result = derivePublicLeadQualification({
      interesse: "consultoria",
      qualification_score: "999",
      qualification_band: "qualified",
      estimatedValue: "99999999",
    });
    expect(result.answers).toEqual({ interesse: "consultoria" });
  });

  it("recalcula score e faixa somente com regras publicadas no servidor", () => {
    const result = derivePublicLeadQualification(
      { investimento: "12000", qualification_band: "cold" },
      [{
        id: "rule",
        projectId: "project",
        condition: { field: "investimento", operator: "greater_than", value: 10000 },
        scoreDelta: 60,
        reason: "Faixa compatível",
      }],
    );
    expect(result.qualification).toMatchObject({
      score: 60,
      band: "qualified",
      reasons: ["Faixa compatível"],
    });
  });
});
