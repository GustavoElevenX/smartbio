import { describe, expect, it } from "vitest";
import { activationCampaignDraft } from "@/features/activations/activation-campaign-draft";
import { campaignLocalTimeToIso, toCampaignLocalTime } from "@/features/activations/campaign-timezone";
import { publishedActivationSnapshotSchema } from "@/features/activations/published-activation.schema";
import { publishedActivationStatus } from "@/features/activations/published-activation-status";
import { resolveAttribution } from "@/features/attribution/attribution";
import { publishActivationSnapshot } from "@/server/activations/activation-publisher";
import { ActivationService } from "@/server/activations/activation-service";
import { ActivationRepository } from "@/server/activations/activation-repository";
import { resolveCampaignHome, resolveExclusiveCampaign, resolvePublishedCampaignRows } from "@/server/activations/published-campaign-resolver";
import type { ConversionActivation } from "@/features/activations/activation.types";

const id = (suffix: number) => `10000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const at = (value: string) => new Date(value);
const now = at("2026-11-10T12:00:00.000Z");

function campaign(suffix = 1, overrides: Partial<ConversionActivation> = {}): ConversionActivation {
  const activationKey = `campanha-${suffix}`;
  return {
    id: id(suffix), workspaceId: id(90), projectId: id(91), activationKey,
    name: `Campanha ${suffix}`, activationType: "promotion", status: "draft",
    conversionGoalId: "goal", destinationMode: "native", title: `Título ${suffix}`,
    message: "Apresentação confirmada", timezone: "America/Sao_Paulo", priority: 0,
    requiresIdentity: false, identityMode: "none", identityVerification: "none",
    completionChannel: "native", eligibility: {}, limits: {},
    settings: { dynamicSurface: { mode: "exclusive_and_home", experienceKey: activationKey,
      title: `Título ${suffix}`, conversionGoalId: "goal", sections: [] } },
    offers: [], placements: [], entryPointIds: [], locationIds: [], version: 1,
    ...overrides,
  };
}

function published(suffix: number, overrides: Partial<ConversionActivation> = {}) {
  return publishActivationSnapshot(campaign(suffix, overrides), now);
}

function row(item: ConversionActivation, status = item.status) {
  return { status, published_at: item.publishedAt, published_snapshot: item.publishedSnapshot };
}

describe("Fase 4B: publicação versionada", () => {
  it("aceita snapshots v1 e v2 e só cria página exclusiva em v2", () => {
    const item = published(1);
    const v1 = { ...item.publishedSnapshot, snapshotVersion: 1 };
    expect(publishedActivationSnapshotSchema.safeParse(v1).success).toBe(true);
    expect(publishedActivationSnapshotSchema.safeParse(item.publishedSnapshot).success).toBe(true);
    expect(resolveExclusiveCampaign(resolvePublishedCampaignRows([row({ ...item, publishedSnapshot: v1 })], now), item.activationKey)).toBeNull();
    expect(resolveExclusiveCampaign(resolvePublishedCampaignRows([row(item)], now), item.activationKey)?.snapshot.activationVersion).toBe(1);
  });

  it("mantém o conteúdo publicado ao editar o rascunho até republicar", () => {
    const first = published(2);
    const edited = { ...first, version: 2, title: "Novo rascunho", priority: 500,
      settings: { dynamicSurface: { mode: "exclusive" as const, experienceKey: first.activationKey,
        title: "Novo rascunho", conversionGoalId: "goal", sections: [] } } };
    const live = resolveCampaignHome(resolvePublishedCampaignRows([row(edited)], now), now);
    expect(live?.snapshot).toMatchObject({ title: "Título 2", priority: 0, activationVersion: 1 });
    const republished = publishActivationSnapshot(edited, at("2026-11-10T12:01:00Z"));
    expect(republished.publishedSnapshot).toMatchObject({ title: "Novo rascunho", activationVersion: 2,
      dynamicSurface: { mode: "exclusive" } });
  });

  it("não muda o status operacional nem o snapshot por PATCH", async () => {
    const service = new ActivationService(null);
    const created = await service.create({ workspaceId: id(90), projectId: id(91), data: {
      name: "Campanha editável", activationKey: "campanha-editavel", activationType: "promotion",
      conversionGoalId: "goal", destinationMode: "native", title: "Versão publicada",
      settings: { dynamicSurface: { mode: "exclusive_and_home", experienceKey: "campanha-editavel",
        title: "Versão publicada", conversionGoalId: "goal", sections: [] } },
    } });
    await service.action(id(91), created.id, "publish");
    const edited = await service.patch(id(91), created.id, { title: "Novo rascunho", status: "ended",
      publishedSnapshot: {}, publishedAt: "2020-01-01T00:00:00Z" });
    expect(edited).toMatchObject({ status: "active", title: "Novo rascunho", publishedSnapshot: {
      title: "Versão publicada", snapshotVersion: 2,
    } });
    expect(edited?.publishedVersion).toBeLessThan(edited!.version);
  });

  it("não confirma publicação se a versão revisada mudou em outra edição", async () => {
    const query = { update: () => query, eq: () => query, select: () => query,
      maybeSingle: async () => ({ data: null, error: null }) };
    const repository = new ActivationRepository({ from: () => query } as never);
    await expect(repository.publish(published(9))).rejects.toThrow(/mudou desde a revisão/);
  });

  it("rejeita página com chave ou objetivo diferentes da ativação", () => {
    expect(() => publishActivationSnapshot(campaign(3, { settings: { dynamicSurface: {
      mode: "exclusive", experienceKey: "outra-chave", title: "Oferta", conversionGoalId: "goal", sections: [],
    } } }), now)).toThrow(/chave e a meta/);
  });
});

describe("Fase 4B: início, término e concorrência", () => {
  it("inicia e termina pelo período publicado, respeitando pausa e retomada", () => {
    const item = published(4, { startsAt: "2026-11-10T13:00:00Z", endsAt: "2026-11-10T15:00:00Z" });
    const snapshot = publishedActivationSnapshotSchema.parse(item.publishedSnapshot);
    expect(publishedActivationStatus(item.status, snapshot, now)).toBe("scheduled");
    expect(publishedActivationStatus(item.status, snapshot, at("2026-11-10T14:00:00Z"))).toBe("active");
    expect(publishedActivationStatus("paused", snapshot, at("2026-11-10T14:00:00Z"))).toBe("paused");
    expect(publishedActivationStatus("active", snapshot, at("2026-11-10T14:00:00Z"))).toBe("active");
    expect(publishedActivationStatus("active", snapshot, at("2026-11-10T15:00:00Z"))).toBe("ended");
    expect(publishedActivationStatus("ended", snapshot, at("2026-11-10T14:00:00Z"))).toBe("ended");
  });

  it("escolhe prioridade, publicação e ID, restaurando a próxima campanha automaticamente", () => {
    const first = published(5, { priority: 2 });
    const second = published(6, { priority: 4, endsAt: "2026-11-10T13:00:00Z" });
    const exclusive = published(7, { priority: 100, settings: { dynamicSurface: {
      mode: "exclusive", experienceKey: "campanha-7", title: "Exclusiva", conversionGoalId: "goal", sections: [],
    } } });
    const campaigns = resolvePublishedCampaignRows([row(first), row(second), row(exclusive)], now);
    expect(resolveCampaignHome(campaigns, now)?.snapshot.activationId).toBe(second.id);
    expect(resolveCampaignHome(resolvePublishedCampaignRows([row(first), row(second, "paused"), row(exclusive)], now), now)?.snapshot.activationId).toBe(first.id);
    expect(resolveCampaignHome(resolvePublishedCampaignRows([row(first), row(second), row(exclusive)], at("2026-11-10T13:00:00Z")), at("2026-11-10T13:00:00Z"))?.snapshot.activationId).toBe(first.id);
    expect(resolveExclusiveCampaign(campaigns, exclusive.activationKey)?.snapshot.activationId).toBe(exclusive.id);
    const newer = publishActivationSnapshot(campaign(8, { priority: 2 }), at("2026-11-10T12:02:00Z"));
    expect(resolveCampaignHome(resolvePublishedCampaignRows([row(first), row(newer)], at("2026-11-10T12:02:01Z")))?.snapshot.activationId).toBe(newer.id);
  });
});

describe("Fase 4B: criação e contexto", () => {
  it("gera página sem catálogo e sem inventar condições", () => {
    expect(activationCampaignDraft({ name: "Oferta", title: "Oferta", message: "Fale conosco",
      conditions: "", conversionGoalId: "goal", mode: "exclusive" })).toMatchObject({
      experienceKey: "oferta", mode: "exclusive", sections: [
        { key: "hero", kind: "hero", content: { title: "Oferta", text: "Fale conosco" } },
        { key: "action", kind: "action" },
      ],
    });
  });

  it("converte horário da campanha independentemente do fuso do navegador", () => {
    expect(campaignLocalTimeToIso("2026-11-10T09:00", "America/Sao_Paulo")).toBe("2026-11-10T12:00:00.000Z");
    expect(toCampaignLocalTime("2026-11-10T12:00:00.000Z", "America/Sao_Paulo")).toBe("2026-11-10T09:00");
    expect(() => campaignLocalTimeToIso("2026-03-08T02:30", "America/New_York")).toThrow(/não existe/);
    expect(campaignLocalTimeToIso("2026-11-01T01:30", "America/New_York")).toBe("2026-11-01T05:30:00.000Z");
  });

  it("preserva UTM explícita e entrada específica antes do contexto de campanha", () => {
    expect(resolveAttribution({ explicit: { campaign: "utm" }, campaignFallback: "campanha" }).campaign).toBe("utm");
    expect(resolveAttribution({ explicit: {}, entry: { id: "entrada", utmCampaign: "entrada" } as never,
      campaignFallback: "campanha" }).campaign).toBe("entrada");
    expect(resolveAttribution({ explicit: {}, campaignFallback: "campanha" }).campaign).toBe("campanha");
  });
});
