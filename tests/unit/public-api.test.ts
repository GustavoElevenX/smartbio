import { describe, expect, it } from "vitest";
import { POST as submitQuote } from "@/app/api/public/quotes/route";
import { POST as submitCatalogOrder } from "@/app/api/public/orders/route";

describe("endpoints públicos comerciais", () => {
  it("valida e aceita orçamento no modo local sem fingir persistência remota", async () => {
    const response = await submitQuote(new Request("http://localhost/api/public/quotes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: "demo-limpabem", sessionId: "session-test", idempotencyKey: "idem-test-0001", answers: { servico: "Sofá", quantidade: 2 }, currency: "BRL", visitorData: { name: "Teste", phone: "11999999999" }, attachments: [], honeypot: "" }) }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ ok: true, data: { accepted: true, persisted: false } });
  });

  it("mantém catálogo nativo protegido pelo flag desligado por padrão", async () => {
    const response = await submitCatalogOrder(new Request("http://localhost/api/public/orders", { method: "POST", body: "{}" }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: "feature_disabled" } });
  });
});
