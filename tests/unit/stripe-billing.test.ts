import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { productionReadinessIssues } from "@/lib/env/production-readiness";
import { readBillingConfig } from "@/server/billing/billing-config";
import { assertBillingMutationActor, billingEntitlementAction } from "@/server/billing/billing-service";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const service = source("src/server/billing/billing-service.ts");
const provider = source("src/server/billing/stripe-billing-provider.ts");
const webhook = source("src/app/api/billing/stripe/webhook/route.ts");
const ui = source("src/components/entitlements/billing-settings-real.tsx");
const sidebar = source("src/components/dashboard/dashboard-shell.tsx");
const migration = source("supabase/migrations/202608180044_stripe_billing.sql");

function actor(input: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    userId: "00000000-0000-4000-8000-000000000001",
    email: "owner@example.com",
    workspaceId: "00000000-0000-4000-8000-000000000002",
    role: "owner",
    persistence: "database",
    mode: "workspace",
    ...input,
  };
}

describe("Stripe billing domain", () => {
  it("preserva o trial sem assinatura financeira", () => {
    expect(service).toContain('plan: "trial"');
    expect(ui).toContain("Seu teste começa com a primeira estrutura.");
  });

  it("cria Customer somente quando o workspace ainda não possui um", () => {
    expect(service).toContain("if (!customerId)");
    expect(service).toContain("provider.createCustomer");
  });

  it("reutiliza external_customer_id do workspace", () => {
    expect(service).toContain("row?.external_customer_id");
    expect(service).toContain("external_customer_id: customerId");
  });

  it("usa exclusivamente o Price configurado no servidor", () => {
    expect(service).toContain("priceId: config.priceId!");
    expect(provider).toContain("line_items: [{ price: input.priceId, quantity: 1 }]");
    expect(source("src/app/api/billing/checkout/route.ts")).not.toContain("request.json");
  });

  it("permite mutação ao owner do workspace", () => {
    expect(() => assertBillingMutationActor(actor())).not.toThrow();
  });

  it("proíbe member de executar mutação financeira", () => {
    expect(() => assertBillingMutationActor(actor({ role: "member" }))).toThrow("Somente o owner");
  });

  it("proíbe platform support de executar mutação financeira", () => {
    expect(() => assertBillingMutationActor(actor({ mode: "platform_support" }))).toThrow("modo suporte");
  });

  it("protege contra assinatura e Checkout duplicados", () => {
    expect(service).toContain("findRecoverableSubscription");
    expect(service).toContain("pending_checkout_session_id");
    expect(service).toContain("sobe-checkout-${actor.workspaceId}-${slot}");
  });

  it("rejeita assinatura de webhook inválida", () => {
    expect(service).toContain("invalid_webhook_signature");
    expect(provider).toContain("webhooks.constructEvent");
  });

  it("lê o body bruto antes de verificar o webhook", () => {
    expect(webhook).toContain("request.text()");
    expect(webhook).not.toContain("request.json()");
  });

  it("mantém ledger idempotente para eventos repetidos", () => {
    expect(migration).toContain("unique(provider, provider_event_id)");
    expect(service).toContain('claim === "duplicate"');
  });

  it("ativa Pro somente para estado financeiro válido", () => {
    expect(billingEntitlementAction("active")).toBe("activate");
    expect(billingEntitlementAction("incomplete")).toBe("preserve");
  });

  it("mantém Pro durante past_due e cancelamento agendado", () => {
    expect(billingEntitlementAction("past_due")).toBe("activate");
    expect(service).toContain("snapshot.cancelAtPeriodEnd");
  });

  it("reativa a mesma Subscription removendo cancelamento", () => {
    expect(provider).toContain("cancel_at_period_end: false");
    expect(provider).toContain("subscriptions.update(subscriptionId");
  });

  it("expira entitlement após encerramento efetivo", () => {
    expect(billingEntitlementAction("canceled")).toBe("expire");
    expect(billingEntitlementAction("unpaid")).toBe("expire");
    expect(billingEntitlementAction("incomplete_expired")).toBe("expire");
  });

  it("registra falha de invoice e mostra recuperação na UI", () => {
    expect(service).toContain('event.type === "invoice.payment_failed"');
    expect(service).toContain("payment_failed_at");
    expect(ui).toContain("Não conseguimos processar sua última cobrança.");
  });

  it("valida que a forma de pagamento pertence ao Customer", () => {
    expect(provider).toContain("idOf(method.customer) !== input.customerId");
    expect(provider).toContain("default_payment_method: method.id");
  });

  it("retorna DTO próprio sem payload ou segredos Stripe", () => {
    const statusRoute = source("src/app/api/billing/status/route.ts");
    expect(statusRoute).toContain("getBillingStatus");
    expect(statusRoute).not.toContain("STRIPE_API_KEY");
    expect(ui).toContain("paymentMethod.brand");
  });

  it("tolera ambiente dev sem Stripe configurada", () => {
    expect(readBillingConfig({ NODE_ENV: "development" })).toMatchObject({
      enabled: false,
      configured: false,
    });
  });

  it("exige todas as variáveis quando billing está habilitado em produção", () => {
    const issues = productionReadinessIssues({
      NODE_ENV: "production",
      NEXT_PUBLIC_FEATURE_BILLING: "true",
    });
    expect(issues.map((issue) => issue.variable)).toEqual(expect.arrayContaining([
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      "STRIPE_API_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRO_PRICE_ID",
      "STRIPE_PRO_PRODUCT_ID",
    ]));
  });

  it("aponta a sidebar para a central nativa de cobrança", () => {
    expect(sidebar).toContain('href="/app/settings/billing"');
  });

  it("usa Checkout embedded atual sem Tax, trial ou métodos hardcoded", () => {
    expect(provider).toContain('ui_mode: "embedded_page"');
    expect(provider).toContain('billing_mode: { type: "flexible" }');
    expect(provider).toContain("integration_identifier");
    expect(provider).not.toContain("payment_method_types");
    expect(provider).not.toContain("automatic_tax");
    expect(provider).not.toContain("trial_period_days");
  });

  it("reconcilia eventos fora de ordem pelo snapshot atual", () => {
    expect(service).toContain("provider.retrieveSubscription(subscriptionId)");
    expect(service).not.toContain("event.data.object.status");
  });
});
