import { describe, expect, it } from "vitest";
import type { Project } from "@/types";
import type { PublishedActivationSnapshot } from "@/features/activations/published-activation.schema";
import type { PublicActivation } from "@/features/activations/activation.types";
import { businessCampaignTimezone } from "@/features/activations/business-campaign-timezone";
import { campaignPresentation } from "@/features/activations/campaign-presentation";
import { selectPublishedOffer } from "@/features/activations/select-published-offer";
import { formatCommercialHandoff, formatVisitorHandoff } from "@/features/handoff/handoff-formatter";
import { buildCommercialBriefing } from "@/features/handoff/commercial-briefing";
import type { CommercialHandoffContext } from "@/features/handoff/commercial-handoff-context";

describe("Fase 4C: campanha publicada e atendimento", () => {
  it("usa o fuso da unidade escolhida e fallback previsível", () => {
    const project = { commercialConfig: { locations: [
      { id: "rio", timezone: "America/Sao_Paulo", priority: 10, isActive: true },
      { id: "manaus", timezone: "America/Manaus", priority: 1, isActive: true },
    ] } } as unknown as Project;
    expect(businessCampaignTimezone(project, ["manaus"])).toBe("America/Manaus");
    expect(businessCampaignTimezone(project)).toBe("America/Sao_Paulo");
    expect(businessCampaignTimezone({} as Project)).toBe("America/Sao_Paulo");
  });

  it("mostra seções publicadas sem fabricar oferta ou condições", () => {
    const surface = { mode: "exclusive" as const, experienceKey: "teste", title: "Título",
      conversionGoalId: "goal", sections: [
        { key: "hero", kind: "hero" as const, content: { title: "Título publicado", text: "Mensagem aprovada" } },
        { key: "offer", kind: "offer" as const, content: { title: "Produto inventado", text: "R$ 1,00" } },
        { key: "conditions", kind: "conditions" as const, content: { text: "Consulte a equipe" } },
        { key: "action", kind: "action" as const, content: { ctaLabel: "Conversar" } },
      ] };
    const activation = { placements: [] } as unknown as PublicActivation;
    const noOffer = campaignPresentation(surface, activation);
    expect(noOffer.title).toBe("Título publicado");
    expect(noOffer.blocks.map((block) => block.kind)).toEqual(["conditions", "action"]);
    expect(JSON.stringify(noOffer)).not.toContain("R$ 1,00");
    const withOffer = campaignPresentation(surface, { ...activation, offer: {
      id: "offer", offerType: "bonus", label: "Brinde aprovado", description: "Após confirmação",
      currency: "BRL", scope: {},
    } });
    expect(withOffer.blocks.find((block) => block.kind === "offer")?.label).toBe("Brinde aprovado");
    expect(JSON.stringify(withOffer)).not.toContain("Produto inventado");
  });

  it("seleciona a primeira oferta ativa do snapshot", () => {
    const snapshot = { offers: [
      { id: "old", isActive: false }, { id: "live", isActive: true }, { id: "later", isActive: true },
    ] } as PublishedActivationSnapshot;
    expect(selectPublishedOffer(snapshot)?.id).toBe("live");
  });

  it("mantém versão, oferta e declaração do visitante no mesmo contexto", () => {
    const context: CommercialHandoffContext = {
      projectId: "project", projectName: "Empresa", origin: { source: "campaign", campaign: "novembro", activationId: "a", activationVersion: 3 },
      identity: { name: "Ana" }, intent: { label: "Saber disponibilidade" },
      qualification: [{ label: "Preferência informada", value: "Modelo azul", include: true, source: "visitor" }],
      pending: ["disponibilidade depende de confirmação da equipe"],
      benefit: { offerId: "offer-1", label: "Oferta confirmada", code: "CODIGO" },
    };
    const briefing = buildCommercialBriefing(context);
    expect(briefing).toMatchObject({ activationVersion: 3, offerId: "offer-1", offerLabel: "Oferta confirmada" });
    expect(formatCommercialHandoff(context)).toContain("Versão da campanha: 3");
    expect(formatVisitorHandoff(context)).toContain("Modelo azul");
    expect(formatVisitorHandoff(context)).toContain("Oferta confirmada");
    expect(formatVisitorHandoff(context)).not.toContain("disponibilidade confirmada");
  });
});
