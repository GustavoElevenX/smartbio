import { expect, it } from "vitest";
import { commercialDataInputSchema } from "@/features/commercial-data/commercial-data.schema";

it("permite salvar requisitos legados sem origem e preserva a ausência de proveniência", () => {
  const result = commercialDataInputSchema.parse({
    data: {}, capabilities: [], expectedProjectVersion: 1,
    dataRequirements: [{ id: "requirement", key: "qualification.questions", label: "Perguntas", capability: "qualification", status: "verified", severity: "blocking", reason: "Configurado", origin: null }],
  });
  expect(result.dataRequirements[0].origin).toBeUndefined();
});
