import { describe, expect, it } from "vitest";

import { RuleBasedExperienceComposer } from "@/features/composition/experience-composer";
import { getProjectReadiness } from "@/features/publishing/project-readiness";
import { haversineDistanceKm, resolveNearestLocation } from "@/features/routing/geo-routing-engine";
import { isOpenAt } from "@/features/routing/opening-hours";
import { canUseLocalAuth, canUseLocalStore } from "@/lib/runtime-mode";
import { safeNextPath } from "@/lib/safe-next";
import type { BusinessLocation, Project } from "@/types";

function location(
  id: string,
  input: Partial<BusinessLocation> = {},
): BusinessLocation {
  return {
    id,
    projectId: "project",
    name: id,
    countryCode: "BR",
    latitude: -23.55,
    longitude: -46.63,
    geocodingStatus: "resolved",
    timezone: "America/Sao_Paulo",
    openingHours: [{ weekday: 3, opensAt: "09:00", closesAt: "18:00" }],
    supportsDelivery: true,
    supportsPickup: true,
    supportsInPerson: true,
    priority: 0,
    isActive: true,
    ...input,
  };
}

function validProject(): Project {
  const project = new RuleBasedExperienceComposer().compose({
    businessName: "Aurora",
    businessDescription: "Atendimento especializado para empresas locais.",
    primaryGoal: "Gerar leads",
    primaryDestination: "Formulário",
    slug: "aurora",
  });
  return {
    ...project,
    capabilities: [],
    dataRequirements: [],
    commercialConfig: {},
    steps: [{
      id: crypto.randomUUID(),
      type: "action",
      title: "Vamos conversar?",
      description: "Envie seus dados para nossa equipe.",
      order: 0,
      isActive: true,
      options: [{
        id: crypto.randomUUID(),
        label: "Enviar dados",
        value: "lead",
        actionType: "submit_form",
      }],
    }],
  };
}

describe("segurança do modo local", () => {
  it("nunca habilita autenticação ou store local em produção", () => {
    expect(canUseLocalAuth({ NODE_ENV: "production", ENABLE_LOCAL_DEV_AUTH: "true" })).toBe(false);
    expect(canUseLocalStore({ NODE_ENV: "production", NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE: "true" })).toBe(false);
  });

  it("aceita somente redirects internos seguros", () => {
    expect(safeNextPath("/app/projects?id=1#editor")).toBe("/app/projects?id=1#editor");
    expect(safeNextPath("//evil.example/path")).toBe("/app");
    expect(safeNextPath("https://evil.example/path")).toBe("/app");
  });
});

describe("motor geográfico", () => {
  it("calcula Haversine com distância realista", () => {
    const distance = haversineDistanceKm(
      { latitude: -23.5505, longitude: -46.6333 },
      { latitude: -22.9068, longitude: -43.1729 },
    );
    expect(distance).toBeGreaterThan(350);
    expect(distance).toBeLessThan(380);
  });

  it("prefere uma unidade aberta e elegível à mais próxima fechada", () => {
    const result = resolveNearestLocation(
      {
        latitude: -23.55,
        longitude: -46.63,
        fulfillment: "pickup",
        requestedAt: "2026-08-05T15:00:00.000Z",
      },
      [
        location("closed", { openingHours: [{ weekday: 3, opensAt: "00:00", closesAt: "00:00", isClosed: true }] }),
        location("open", { latitude: -23.58, priority: 2 }),
      ],
    );
    expect(result.recommended?.locationId).toBe("open");
  });

  it("retorna fallback fora do raio ou sem delivery", () => {
    const outside = resolveNearestLocation(
      { latitude: -23.8, longitude: -46.8, fulfillment: "delivery", requestedAt: "2026-08-05T15:00:00.000Z" },
      [location("tiny-radius", { deliveryRadiusKm: 1 })],
    );
    expect(outside.recommended).toBeUndefined();
    expect(outside.fallbackReason).toBe("outside_service_radius");

    const unsupported = resolveNearestLocation(
      { latitude: -23.55, longitude: -46.63, fulfillment: "delivery", requestedAt: "2026-08-05T15:00:00.000Z" },
      [location("pickup-only", { supportsDelivery: false })],
    );
    expect(unsupported.fallbackReason).toBe("fulfillment_unavailable");
  });
});

describe("horário de funcionamento", () => {
  it("considera timezone brasileiro, virada do dia, fechado e 24h", () => {
    expect(isOpenAt([{ weekday: 5, opensAt: "22:00", closesAt: "02:00" }], "2026-08-08T04:00:00.000Z", "America/Sao_Paulo")).toBe(true);
    expect(isOpenAt([{ weekday: 3, opensAt: "00:00", closesAt: "00:00" }], "2026-08-05T15:00:00.000Z", "America/Sao_Paulo")).toBe(true);
    expect(isOpenAt([{ weekday: 3, opensAt: "00:00", closesAt: "00:00", isClosed: true }], "2026-08-05T15:00:00.000Z", "America/Sao_Paulo")).toBe(false);
  });
});

describe("readiness de publicação", () => {
  it("aceita um projeto mínimo sem dados fictícios", () => {
    expect(getProjectReadiness(validProject()).publishable).toBe(true);
  });

  it("bloqueia placeholder por metadata, mesmo sem depender do texto", () => {
    const project = validProject();
    project.steps[0].settings = {
      generatedFields: {
        title: {
          generatedByAI: true,
          generatedPlaceholder: true,
          verificationStatus: "needs_confirmation",
        },
      },
    };
    expect(getProjectReadiness(project).blocking.some((item) => item.key.includes("placeholder"))).toBe(true);
  });

  it("bloqueia serviço ativo sem destino", () => {
    const project = validProject();
    project.commercialConfig = {
      serviceOfferings: [{
        id: crypto.randomUUID(),
        projectId: project.id,
        name: "Consultoria",
        slug: "consultoria",
        serviceMode: "contact",
        priceMode: "fixed",
        price: 300,
        currency: "BRL",
        isFeatured: true,
        isActive: true,
        order: 0,
        settings: {},
      }],
    };
    expect(getProjectReadiness(project).blocking.some((item) => item.key.includes("destination"))).toBe(true);
  });
});
