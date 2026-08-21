import { describe, expect, it } from "vitest";
import { casaDeSucos } from "@/data/demo-projects";
import { presentProjectReadiness } from "@/features/publishing/readiness-presentation";

describe("apresentação humana da prontidão", () => {
  it("traduz pendências técnicas em próximos passos compreensíveis", () => {
    const project = structuredClone(casaDeSucos);
    project.status = "draft";
    project.presence = { pages: [] };
    const result = presentProjectReadiness(project, {
      score: 20,
      publishable: false,
      blocking: [{ id: "phone", key: "contact.whatsapp.phone", label: "Telefone", capability: "project", status: "missing", severity: "blocking", reason: "Phone required" }],
      warnings: [],
      optional: [],
    });

    expect(result.publishable).toBe(false);
    expect(result.items.find((item) => item.id === "phone")).toMatchObject({
      title: "Confirme o WhatsApp de atendimento",
      actionLabel: "Informar WhatsApp",
      actionPath: `/app/projects/${project.id}/settings#contact`,
    });
    expect(JSON.stringify(result.items)).not.toMatch(/conversionGoalId|targetStepId|capability/i);
  });
});
