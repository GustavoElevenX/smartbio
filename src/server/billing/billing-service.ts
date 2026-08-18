import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAppUrl } from "@/lib/app-url";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { assignWorkspacePlan } from "@/server/entitlements/plan-service";
import { recordPlatformGrowthEvent } from "@/server/platform-acquisition/platform-acquisition";
import type {
  BillingInvoice,
  BillingProvider,
  BillingSubscriptionSnapshot,
  BillingWebhookEvent,
} from "./billing-provider";
import { readBillingConfig } from "./billing-config";
import { StripeBillingProvider } from "./stripe-billing-provider";

export class BillingOperationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "billing_error",
  ) {
    super(message);
  }
}

type StripeRequestFailure = {
  type: string;
  code?: string;
  statusCode?: number;
  requestId?: string;
  param?: string;
};

function stripeRequestFailure(error: unknown): StripeRequestFailure | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as Record<string, unknown>;
  const type = typeof candidate.type === "string" ? candidate.type : undefined;
  const requestId = typeof candidate.requestId === "string" ? candidate.requestId : undefined;
  if (!type?.startsWith("Stripe") && !requestId) return undefined;
  return {
    type: type || "StripeError",
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    statusCode: typeof candidate.statusCode === "number" ? candidate.statusCode : undefined,
    requestId,
    param: typeof candidate.param === "string" ? candidate.param : undefined,
  };
}

function stripeFailureResponse(error: StripeRequestFailure) {
  console.error("billing_operation_failed", {
    provider: "stripe",
    type: error.type,
    code: error.code,
    statusCode: error.statusCode,
    requestId: error.requestId,
    param: error.param,
  });

  if (error.statusCode === 401 || error.type === "StripeAuthenticationError") {
    return new BillingOperationError(
      "A chave Stripe de produção é inválida ou expirou.",
      503,
      "stripe_authentication_failed",
    );
  }
  if (error.statusCode === 403 || error.type === "StripePermissionError") {
    return new BillingOperationError(
      "A chave Stripe não possui permissão para criar o Checkout.",
      503,
      "stripe_permission_denied",
    );
  }
  if (error.code === "resource_missing" || error.code === "livemode_mismatch") {
    return new BillingOperationError(
      "A Stripe não encontrou o recurso de produção configurado. Confira o Price ID LIVE.",
      503,
      "stripe_live_resource_missing",
    );
  }
  if (error.code === "testmode_charges_only") {
    return new BillingOperationError(
      "A conta Stripe ainda não está habilitada para cobranças reais.",
      503,
      "stripe_live_charges_disabled",
    );
  }
  const diagnostic = [
    error.type,
    error.statusCode ? `HTTP ${error.statusCode}` : undefined,
    error.param ? `parâmetro ${error.param}` : undefined,
    error.requestId ? `requisição ${error.requestId}` : undefined,
  ].filter(Boolean).join(" · ");
  return new BillingOperationError(
    `A Stripe recusou a criação do Checkout${error.code ? ` (${error.code})` : ""}. ${diagnostic}`,
    502,
    "stripe_request_failed",
  );
}

export interface BillingStatusDto {
  enabled: boolean;
  configured: boolean;
  canManage: boolean;
  plan: "trial" | "pro";
  financialStatus?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  invoices: BillingInvoice[];
  canCancel: boolean;
  canReactivate: boolean;
  canUpdatePaymentMethod: boolean;
}

type SubscriptionRow = {
  workspace_id: string;
  plan_key: string;
  status: string;
  provider: string | null;
  provider_price_id: string | null;
  external_customer_id: string | null;
  external_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  pending_checkout_session_id: string | null;
  pending_checkout_expires_at: string | null;
};

const ACTIVE_ENTITLEMENT_STATUSES = new Set(["active", "past_due"]);
const TERMINAL_ENTITLEMENT_STATUSES = new Set([
  "canceled",
  "incomplete_expired",
  "paused",
  "unpaid",
]);
const MUTABLE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "past_due",
  "paused",
  "unpaid",
]);
const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export function billingEntitlementAction(status: string) {
  if (ACTIVE_ENTITLEMENT_STATUSES.has(status)) return "activate" as const;
  if (TERMINAL_ENTITLEMENT_STATUSES.has(status)) return "expire" as const;
  return "preserve" as const;
}

export function assertBillingMutationActor(actor: AuthenticatedActor) {
  if (actor.mode === "platform_support")
    throw new BillingOperationError(
      "O modo suporte não pode executar operações financeiras.",
      403,
      "billing_support_forbidden",
    );
  if (actor.role !== "owner")
    throw new BillingOperationError(
      "Somente o owner pode alterar a cobrança.",
      403,
      "billing_owner_required",
    );
}

function configuredDependencies() {
  const config = readBillingConfig();
  if (!config.enabled)
    throw new BillingOperationError(
      "A cobrança ainda não está habilitada.",
      503,
      "billing_disabled",
    );
  if (!config.configured || !config.apiKey || !config.priceId)
    throw new BillingOperationError(
      "A cobrança ainda não está configurada.",
      503,
      "billing_not_configured",
    );
  const database = createServiceClient();
  if (!database)
    throw new BillingOperationError(
      "A persistência de cobrança está indisponível.",
      503,
      "billing_storage_unavailable",
    );
  return {
    config,
    database,
    provider: StripeBillingProvider.fromApiKey(config.apiKey),
  };
}

async function subscriptionRow(database: SupabaseClient, workspaceId: string) {
  const { data, error } = await database
    .from("subscriptions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data as SubscriptionRow | null;
}

async function workspaceOwnerId(database: SupabaseClient, workspaceId: string) {
  const { data, error } = await database
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data?.user_id)
    throw new Error("Owner do workspace não encontrado para sincronização.");
  return data.user_id as string;
}

async function syncEntitlement(
  database: SupabaseClient,
  workspaceId: string,
  snapshot: BillingSubscriptionSnapshot,
  actorUserId: string,
) {
  const action = billingEntitlementAction(snapshot.status);
  if (action === "preserve") return;
  const desiredStatus = action === "activate" ? "active" : "expired";
  const { data: current, error } = await database
    .from("workspace_plan_assignments")
    .select("plan_key,status,source,ends_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  const desiredEndsAt = action === "activate"
    ? snapshot.cancelAtPeriodEnd
      ? snapshot.currentPeriodEnd || null
      : null
    : snapshot.currentPeriodEnd || null;
  if (
    current?.plan_key === "pro" &&
    current.status === desiredStatus &&
    current.source === "billing" &&
    (current.ends_at || null) === desiredEndsAt
  ) return;
  await assignWorkspacePlan(database, {
    workspaceId,
    planKey: "pro",
    status: desiredStatus,
    endsAt: desiredEndsAt || undefined,
    reason: `stripe_subscription_${snapshot.status}`,
    actorUserId,
    source: "billing",
  });
}

export async function applySubscriptionSnapshot(
  database: SupabaseClient,
  provider: BillingProvider,
  workspaceId: string,
  subscriptionId: string,
  expectedPriceId: string,
  options: { invoiceId?: string; paymentFailed?: boolean } = {},
) {
  const snapshot = await provider.retrieveSubscription(subscriptionId);
  if (snapshot.workspaceId !== workspaceId)
    throw new Error("Metadata da assinatura não corresponde ao workspace.");
  if (snapshot.priceId !== expectedPriceId)
    throw new Error("Preço da assinatura não corresponde ao SOBE Pro.");
  const now = new Date().toISOString();
  const paymentFailureUpdate = options.paymentFailed === undefined
    ? {}
    : { payment_failed_at: options.paymentFailed ? now : null };
  const { error } = await database.from("subscriptions").upsert(
    {
      workspace_id: workspaceId,
      plan_key: "pro",
      status: snapshot.status,
      provider: provider.key,
      provider_price_id: snapshot.priceId,
      external_customer_id: snapshot.customerId,
      external_subscription_id: snapshot.id,
      current_period_end: snapshot.currentPeriodEnd || null,
      cancel_at_period_end: snapshot.cancelAtPeriodEnd,
      cancelled_at: snapshot.cancelledAt || null,
      latest_invoice_id: options.invoiceId || snapshot.latestInvoiceId || null,
      ...paymentFailureUpdate,
      provider_updated_at: snapshot.providerUpdatedAt,
      pending_checkout_session_id: null,
      pending_checkout_expires_at: null,
      updated_at: now,
    },
    { onConflict: "workspace_id" },
  );
  if (error) throw error;
  const ownerId = await workspaceOwnerId(database, workspaceId);
  await syncEntitlement(database, workspaceId, snapshot, ownerId);
  if (snapshot.status === "active")
    await recordPlatformGrowthEvent(database, {
      eventName: "subscription_started",
      userId: ownerId,
      workspaceId,
      path: "/app/settings/billing",
      metadata: { provider: provider.key },
      idempotencyKey: `subscription_started:${snapshot.id}`,
    });
  if (snapshot.status === "canceled")
    await recordPlatformGrowthEvent(database, {
      eventName: "subscription_cancelled",
      userId: ownerId,
      workspaceId,
      path: "/app/settings/billing",
      metadata: { provider: provider.key, stage: "effective" },
      idempotencyKey: `subscription_cancelled:effective:${snapshot.id}`,
    });
  return snapshot;
}

export async function getBillingStatus(actor: AuthenticatedActor): Promise<BillingStatusDto> {
  const config = readBillingConfig();
  const canManage = actor.role === "owner" && actor.mode === "workspace";
  const base: BillingStatusDto = {
    enabled: config.enabled,
    configured: config.configured,
    canManage,
    plan: "trial",
    cancelAtPeriodEnd: false,
    invoices: [],
    canCancel: false,
    canReactivate: false,
    canUpdatePaymentMethod: false,
  };
  const database = createServiceClient();
  if (!database) return base;
  const row = await subscriptionRow(database, actor.workspaceId);
  if (!row?.external_subscription_id) return base;

  let status = row.status;
  let currentPeriodEnd = row.current_period_end || undefined;
  let cancelAtPeriodEnd = row.cancel_at_period_end;
  let paymentMethod: BillingStatusDto["paymentMethod"];
  let invoices: BillingInvoice[] = [];
  if (config.configured && config.apiKey && config.priceId) {
    const provider = StripeBillingProvider.fromApiKey(config.apiKey);
    const snapshot = await applySubscriptionSnapshot(
      database,
      provider,
      actor.workspaceId,
      row.external_subscription_id,
      config.priceId,
    );
    status = snapshot.status;
    currentPeriodEnd = snapshot.currentPeriodEnd;
    cancelAtPeriodEnd = snapshot.cancelAtPeriodEnd;
    paymentMethod = snapshot.defaultPaymentMethod
      ? {
          brand: snapshot.defaultPaymentMethod.brand,
          last4: snapshot.defaultPaymentMethod.last4,
          expMonth: snapshot.defaultPaymentMethod.expMonth,
          expYear: snapshot.defaultPaymentMethod.expYear,
        }
      : undefined;
    invoices = await provider.listInvoices(snapshot.customerId);
  }
  return {
    ...base,
    plan: "pro",
    financialStatus: status,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    paymentMethod,
    invoices,
    canCancel: canManage && status === "active" && !cancelAtPeriodEnd,
    canReactivate: canManage && status === "active" && cancelAtPeriodEnd,
    canUpdatePaymentMethod: canManage && MUTABLE_SUBSCRIPTION_STATUSES.has(status),
  };
}

export async function startCheckout(actor: AuthenticatedActor) {
  assertBillingMutationActor(actor);
  const { config, database, provider } = configuredDependencies();
  let row = await subscriptionRow(database, actor.workspaceId);
  let customerId = row?.external_customer_id;
  if (!customerId) {
    const customer = await provider.createCustomer({
      email: actor.email,
      workspaceId: actor.workspaceId,
      idempotencyKey: `sobe-customer-${actor.workspaceId}`,
    });
    customerId = customer.id;
    const { error } = await database.from("subscriptions").upsert(
      {
        workspace_id: actor.workspaceId,
        plan_key: "pro",
        status: "incomplete",
        provider: provider.key,
        provider_price_id: config.priceId,
        external_customer_id: customerId,
      },
      { onConflict: "workspace_id" },
    );
    if (error) throw error;
    row = await subscriptionRow(database, actor.workspaceId);
  }

  const recoverable = await provider.findRecoverableSubscription(customerId, config.priceId!);
  if (recoverable) {
    if (recoverable.workspaceId !== actor.workspaceId)
      throw new BillingOperationError(
        "A assinatura existente não corresponde a este workspace.",
        409,
        "subscription_workspace_mismatch",
      );
    await applySubscriptionSnapshot(
      database,
      provider,
      actor.workspaceId,
      recoverable.id,
      config.priceId!,
    );
    throw new BillingOperationError(
      "Este workspace já possui uma assinatura recuperável.",
      409,
      "subscription_already_exists",
    );
  }

  if (
    row?.pending_checkout_session_id &&
    row.pending_checkout_expires_at &&
    new Date(row.pending_checkout_expires_at) > new Date()
  ) {
    const existing = await provider.retrieveCheckoutSession(row.pending_checkout_session_id);
    if (existing.status === "open") return existing;
  }

  const slot = Math.floor(Date.now() / (30 * 60_000));
  const idempotencyKey = `sobe-checkout-${actor.workspaceId}-${slot}`;
  const session = await provider.createCheckoutSession({
    customerId,
    workspaceId: actor.workspaceId,
    priceId: config.priceId!,
    returnUrl: `${resolveAppUrl()}/app/settings/billing?checkout=return&session_id={CHECKOUT_SESSION_ID}`,
    idempotencyKey,
  });
  const { error } = await database
    .from("subscriptions")
    .update({
      pending_checkout_session_id: session.id,
      pending_checkout_expires_at: session.expiresAt,
      checkout_attempt_key: idempotencyKey,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", actor.workspaceId);
  if (error) throw error;
  await recordPlatformGrowthEvent(database, {
    eventName: "checkout_started",
    userId: actor.userId,
    workspaceId: actor.workspaceId,
    path: "/app/settings/billing",
    metadata: { provider: provider.key },
    idempotencyKey: `checkout_started:${session.id}`,
  });
  return session;
}

async function mutateSubscription(
  actor: AuthenticatedActor,
  operation: "cancel" | "reactivate",
) {
  assertBillingMutationActor(actor);
  const { config, database, provider } = configuredDependencies();
  const row = await subscriptionRow(database, actor.workspaceId);
  if (!row?.external_subscription_id)
    throw new BillingOperationError("Assinatura não encontrada.", 404, "subscription_not_found");
  const snapshot = operation === "cancel"
    ? await provider.scheduleCancellation(row.external_subscription_id)
    : await provider.reactivateSubscription(row.external_subscription_id);
  if (snapshot.workspaceId !== actor.workspaceId || snapshot.priceId !== config.priceId)
    throw new BillingOperationError("Assinatura inválida para este workspace.", 409);
  await applySubscriptionSnapshot(
    database,
    provider,
    actor.workspaceId,
    snapshot.id,
    config.priceId!,
  );
  if (operation === "cancel")
    await recordPlatformGrowthEvent(database, {
      eventName: "subscription_cancelled",
      userId: actor.userId,
      workspaceId: actor.workspaceId,
      path: "/app/settings/billing",
      metadata: { provider: provider.key, stage: "scheduled" },
      idempotencyKey: `subscription_cancelled:scheduled:${snapshot.id}`,
    });
  return snapshot;
}

export const scheduleSubscriptionCancellation = (actor: AuthenticatedActor) =>
  mutateSubscription(actor, "cancel");
export const reactivateSubscription = (actor: AuthenticatedActor) =>
  mutateSubscription(actor, "reactivate");

export async function createBillingSetupIntent(actor: AuthenticatedActor) {
  assertBillingMutationActor(actor);
  const { database, provider } = configuredDependencies();
  const row = await subscriptionRow(database, actor.workspaceId);
  if (!row?.external_customer_id || !row.external_subscription_id)
    throw new BillingOperationError("Assinatura não encontrada.", 404, "subscription_not_found");
  return provider.createSetupIntent(row.external_customer_id, actor.workspaceId);
}

export async function saveBillingPaymentMethod(
  actor: AuthenticatedActor,
  paymentMethodId: string,
) {
  assertBillingMutationActor(actor);
  const { database, provider } = configuredDependencies();
  const row = await subscriptionRow(database, actor.workspaceId);
  if (!row?.external_customer_id || !row.external_subscription_id)
    throw new BillingOperationError("Assinatura não encontrada.", 404, "subscription_not_found");
  return provider.updateDefaultPaymentMethod({
    customerId: row.external_customer_id,
    subscriptionId: row.external_subscription_id,
    paymentMethodId,
  });
}

async function markWebhook(
  database: SupabaseClient,
  event: BillingWebhookEvent,
  status: "processed" | "failed",
  error?: string,
) {
  const { error: updateError } = await database
    .from("billing_webhook_events")
    .update({
      processing_status: status,
      processed_at: status === "processed" ? new Date().toISOString() : null,
      error: error?.slice(0, 500) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "stripe")
    .eq("provider_event_id", event.id);
  if (updateError) throw updateError;
}

export async function processStripeWebhook(payload: string, signature: string) {
  const { config, database, provider } = configuredDependencies();
  if (!config.webhookSecret)
    throw new BillingOperationError("Webhook Stripe não configurado.", 503);
  let event: BillingWebhookEvent;
  try {
    event = provider.parseWebhook(payload, signature, config.webhookSecret);
  } catch {
    throw new BillingOperationError(
      "Assinatura de webhook inválida.",
      400,
      "invalid_webhook_signature",
    );
  }
  const { data: claim, error: claimError } = await database.rpc(
    "claim_billing_webhook_event",
    {
      event_provider: "stripe",
      event_provider_id: event.id,
      event_name: event.type,
      event_created_at: event.createdAt,
    },
  );
  if (claimError) throw claimError;
  if (claim === "duplicate") return { duplicate: true };
  if (claim === "busy")
    throw new BillingOperationError("Evento já está em processamento.", 409, "webhook_busy");
  try {
    if (HANDLED_EVENTS.has(event.type) && event.subscriptionId) {
      let workspaceId = event.workspaceId;
      if (!workspaceId) {
        const { data } = await database
          .from("subscriptions")
          .select("workspace_id")
          .eq("external_subscription_id", event.subscriptionId)
          .maybeSingle();
        workspaceId = data?.workspace_id;
      }
      if (!workspaceId) throw new Error("Workspace do evento Stripe não encontrado.");
      await applySubscriptionSnapshot(
        database,
        provider,
        workspaceId,
        event.subscriptionId,
        config.priceId!,
        {
          invoiceId: event.invoiceId,
          paymentFailed: event.type === "invoice.payment_failed"
            ? true
            : event.type === "invoice.paid"
              ? false
              : undefined,
        },
      );
    }
    await markWebhook(database, event, "processed");
    return { duplicate: false };
  } catch (error) {
    await markWebhook(
      database,
      event,
      "failed",
      error instanceof Error ? error.message : "Falha de processamento",
    );
    throw error;
  }
}

export function billingErrorResponse(error: unknown) {
  const stripeFailure = stripeRequestFailure(error);
  if (stripeFailure) return billingErrorResponse(stripeFailureResponse(stripeFailure));
  if (error instanceof BillingOperationError)
    return Response.json(
      { ok: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  console.error("billing_operation_failed");
  return Response.json(
    { ok: false, error: { code: "billing_failed", message: "Não foi possível concluir a operação de cobrança." } },
    { status: 500 },
  );
}
