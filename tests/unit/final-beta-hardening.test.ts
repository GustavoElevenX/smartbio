import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commercialDataInputSchema } from "@/features/commercial-data/commercial-data.schema";
import { mergeCommercialConfig } from "@/features/composition/merge-commercial-config";
import { publicRateLimitIdentifier, publicRequestIp } from "@/server/rate-limit/public-identifier";
import { notificationRetryDelaySeconds } from "@/server/notifications/notification-service";
import { activeWorkspaceCookieOptions, ACTIVE_WORKSPACE_COOKIE } from "@/server/auth/active-workspace";
import type { Project } from "@/types";

describe("identidade pública do rate limit", () => {
  it("prioriza o header da plataforma e combina projeto e sessão", () => {
    const request = new Request("https://smartbio.test", { headers: { "cf-connecting-ip": "203.0.113.8", "x-forwarded-for": "198.51.100.4, 10.0.0.1" } });
    expect(publicRequestIp(request)).toBe("203.0.113.8");
    expect(publicRateLimitIdentifier(request, { projectId: "project", sessionId: "session" })).toBe("project:session:203.0.113.8");
  });

  it("usa somente o primeiro forwarded IP e possui fallback estável", () => {
    expect(publicRequestIp(new Request("https://smartbio.test", { headers: { "x-forwarded-for": "198.51.100.4, 10.0.0.1" } }))).toBe("198.51.100.4");
    expect(publicRateLimitIdentifier(new Request("https://smartbio.test"), { projectId: "project" })).toBe("project:unknown");
  });
});

describe("workspace ativo e outbox", () => {
  it("usa cookie HTTP-only com política segura", () => {
    const options = activeWorkspaceCookieOptions();
    expect(ACTIVE_WORKSPACE_COOKIE).toBe("smartbio_active_workspace");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("segue o backoff de 1m, 5m, 30m e 2h", () => {
    expect([2, 3, 4, 5].map(notificationRetryDelaySeconds)).toEqual([60, 300, 1800, 7200]);
  });
});

describe("migração das rotas públicas", () => {
  const routes = [
    "src/app/api/leads/route.ts", "src/app/api/events/route.ts", "src/app/api/public/availability/route.ts",
    "src/app/api/public/reservations/availability/route.ts", "src/app/api/public/routing/resolve/route.ts",
    "src/app/api/public/routing/nearest/route.ts", "src/app/api/public/quotes/route.ts",
    "src/app/api/public/quotes/[id]/attachments/route.ts", "src/app/api/public/bookings/route.ts",
    "src/app/api/public/bookings/[id]/cancel-request/route.ts", "src/app/api/public/bookings/[id]/reschedule-request/route.ts",
    "src/app/api/public/orders/route.ts", "src/app/api/public/reservations/route.ts",
    "src/app/api/public/reservations/[id]/cancel-request/route.ts",
  ];

  it("usa o provider distribuído e aplica headers nas rotas previstas", () => {
    for (const route of routes) {
      const source = readFileSync(join(process.cwd(), route), "utf8");
      expect(source, route).not.toContain("server/services/rate-limit");
      expect(source, route).toContain("consumeRateLimit");
      expect(source, route).toContain("applyRateLimitHeaders");
    }
  });
});

describe("dados comerciais e patch de IA", () => {
  it("rejeita estruturas superficiais e exige concorrência otimista", () => {
    expect(commercialDataInputSchema.safeParse({ data: { serviceOfferings: [{}] }, capabilities: [], dataRequirements: [] }).success).toBe(false);
  });

  it("preserva preço verificado, mantém o item e cria requisito de conflito", () => {
    const projectId = crypto.randomUUID();
    const id = crypto.randomUUID();
    const existing: NonNullable<Project["commercialConfig"]> = { serviceOfferings: [{
      id, projectId, name: "Consultoria", slug: "consultoria", serviceMode: "contact", priceMode: "fixed",
      price: 500, currency: "BRL", isFeatured: true, isActive: true, order: 0,
      settings: { verificationStatus: "verified" },
    }] };
    const result = mergeCommercialConfig(existing, { serviceOfferings: [{ id, name: "Consultoria premium", slug: "consultoria", price: 1 }] }, projectId);
    expect(result.value.serviceOfferings).toHaveLength(1);
    expect(result.value.serviceOfferings?.[0].price).toBe(500);
    expect(result.value.serviceOfferings?.[0].name).toBe("Consultoria premium");
    expect(result.conflicts.some((item) => item.path.endsWith(".price"))).toBe(true);
    expect(result.requirements.some((item) => item.key.endsWith(".price"))).toBe(true);
  });
});
