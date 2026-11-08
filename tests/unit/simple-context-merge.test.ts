import { expect, it } from "vitest";
import { mergeSimpleContextReview } from "@/features/simple-settings/context-merge";
import type { ProjectCommercialContext } from "@/features/commercial-context/project-commercial-context.schema";

it("mescla somente os campos editados e sinaliza uma disputa pelo mesmo campo", () => {
  const base = { revision: 1, summary: { whatItSells: "Bolos", commercialModel: "Encomendas" }, intentContexts: [{ id: "a", label: "Encomendar", status: "inferred", confidence: 0.7 }] } as ProjectCommercialContext;
  const draft = { ...base, summary: { ...base.summary, whatItSells: "Bolos e doces" } };
  const latest = { ...base, revision: 2, summary: { ...base.summary, commercialModel: "Revenda" }, intentContexts: [{ ...base.intentContexts[0], status: "confirmed" as const }] };
  const merged = mergeSimpleContextReview(base, draft, latest);
  expect(merged.conflicts).toEqual([]);
  expect(merged.context.summary).toMatchObject({ whatItSells: "Bolos e doces", commercialModel: "Revenda" });
  expect(merged.context.intentContexts[0].status).toBe("confirmed");
  const collision = mergeSimpleContextReview(base, draft, { ...latest, summary: { ...latest.summary, whatItSells: "Salgados" } });
  expect(collision.conflicts).toEqual(["Produtos ou serviços principais"]);
});
