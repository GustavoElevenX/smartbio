import "server-only";

import Stripe from "stripe";
import type {
  BillingCheckoutSession,
  BillingFinancialStatus,
  BillingPaymentMethod,
  BillingProvider,
  BillingSubscriptionSnapshot,
  BillingWebhookEvent,
} from "./billing-provider";

// stripe-node narrows this to the release default, while the account contract
// intentionally pins the latest stable version approved for SOBE.
const STRIPE_API_VERSION = "2026-06-24.dahlia" as Stripe.LatestApiVersion;
const RECOVERABLE_STATUSES = new Set([
  "active",
  "incomplete",
  "past_due",
  "paused",
  "trialing",
  "unpaid",
]);

function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

function iso(seconds?: number | null) {
  return seconds ? new Date(seconds * 1000).toISOString() : undefined;
}

function paymentMethod(value: Stripe.PaymentMethod | string | null): BillingPaymentMethod | undefined {
  if (!value || typeof value === "string" || !value.card) return undefined;
  return {
    id: value.id,
    brand: value.card.brand,
    last4: value.card.last4,
    expMonth: value.card.exp_month,
    expYear: value.card.exp_year,
  };
}

export function stripeSubscriptionSnapshot(
  subscription: Stripe.Subscription,
): BillingSubscriptionSnapshot {
  const item = subscription.items.data[0];
  return {
    id: subscription.id,
    customerId: idOf(subscription.customer)!,
    priceId: item?.price.id || "",
    workspaceId: subscription.metadata.workspace_id || undefined,
    status: subscription.status as BillingFinancialStatus,
    currentPeriodEnd: iso(item?.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelledAt: iso(subscription.canceled_at),
    providerUpdatedAt: iso(subscription.ended_at || subscription.created)!,
    defaultPaymentMethod: paymentMethod(subscription.default_payment_method),
    latestInvoiceId: idOf(subscription.latest_invoice),
  };
}

function checkoutSession(session: Stripe.Checkout.Session): BillingCheckoutSession {
  if (!session.client_secret)
    throw new Error("A sessão de Checkout não retornou client_secret.");
  return {
    id: session.id,
    clientSecret: session.client_secret,
    expiresAt: iso(session.expires_at)!,
    status: session.status || undefined,
    subscriptionId: idOf(session.subscription),
  };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  return idOf(invoice.parent?.subscription_details?.subscription);
}

export class StripeBillingProvider implements BillingProvider {
  readonly key = "stripe" as const;

  constructor(private readonly stripe: Stripe) {}

  static fromApiKey(apiKey: string) {
    return new StripeBillingProvider(
      new Stripe(apiKey, { apiVersion: STRIPE_API_VERSION }),
    );
  }

  async createCustomer(input: {
    email: string;
    workspaceId: string;
    idempotencyKey: string;
  }) {
    const customer = await this.stripe.customers.create(
      {
        email: input.email,
        metadata: { workspace_id: input.workspaceId, app: "sobe" },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return { id: customer.id };
  }

  async createCheckoutSession(input: {
    customerId: string;
    workspaceId: string;
    priceId: string;
    returnUrl: string;
    idempotencyKey: string;
  }) {
    const session = await this.stripe.checkout.sessions.create(
      {
        customer: input.customerId,
        client_reference_id: input.workspaceId,
        integration_identifier: "sobe_billing_xqrmztka",
        line_items: [{ price: input.priceId, quantity: 1 }],
        metadata: { workspace_id: input.workspaceId, app: "sobe" },
        mode: "subscription",
        redirect_on_completion: "if_required",
        return_url: input.returnUrl,
        subscription_data: {
          billing_mode: { type: "flexible" },
          metadata: { workspace_id: input.workspaceId, app: "sobe" },
        },
        ui_mode: "embedded_page",
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return checkoutSession(session);
  }

  async retrieveCheckoutSession(sessionId: string) {
    return checkoutSession(await this.stripe.checkout.sessions.retrieve(sessionId));
  }

  async findRecoverableSubscription(customerId: string, priceId: string) {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 25,
      expand: ["data.default_payment_method"],
    });
    const match = subscriptions.data.find(
      (subscription) =>
        RECOVERABLE_STATUSES.has(subscription.status) &&
        subscription.items.data.some((item) => item.price.id === priceId),
    );
    return match ? stripeSubscriptionSnapshot(match) : undefined;
  }

  async retrieveSubscription(subscriptionId: string) {
    return stripeSubscriptionSnapshot(
      await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["default_payment_method"],
      }),
    );
  }

  async scheduleCancellation(subscriptionId: string) {
    return stripeSubscriptionSnapshot(
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      }),
    );
  }

  async reactivateSubscription(subscriptionId: string) {
    return stripeSubscriptionSnapshot(
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      }),
    );
  }

  async createSetupIntent(customerId: string, workspaceId: string) {
    const intent = await this.stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      metadata: { app: "sobe", workspace_id: workspaceId },
    });
    if (!intent.client_secret)
      throw new Error("O SetupIntent não retornou client_secret.");
    return { id: intent.id, clientSecret: intent.client_secret };
  }

  async updateDefaultPaymentMethod(input: {
    customerId: string;
    subscriptionId: string;
    paymentMethodId: string;
  }) {
    const method = await this.stripe.paymentMethods.retrieve(input.paymentMethodId);
    if (idOf(method.customer) !== input.customerId || !method.card)
      throw new Error("Forma de pagamento inválida para este workspace.");
    await Promise.all([
      this.stripe.customers.update(input.customerId, {
        invoice_settings: { default_payment_method: method.id },
      }),
      this.stripe.subscriptions.update(input.subscriptionId, {
        default_payment_method: method.id,
      }),
    ]);
    return paymentMethod(method)!;
  }

  async listInvoices(customerId: string, limit = 8) {
    const invoices = await this.stripe.invoices.list({ customer: customerId, limit });
    return invoices.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number || undefined,
      createdAt: iso(invoice.created)!,
      amountPaid: invoice.amount_paid,
      amountDue: invoice.amount_due,
      currency: invoice.currency,
      status: invoice.status || "unknown",
      hostedUrl: invoice.hosted_invoice_url || undefined,
      pdfUrl: invoice.invoice_pdf || undefined,
    }));
  }

  parseWebhook(payload: string, signature: string, secret: string): BillingWebhookEvent {
    const event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    const object = event.data.object;
    let subscriptionId: string | undefined;
    let workspaceId: string | undefined;
    let invoiceId: string | undefined;
    if (object.object === "checkout.session") {
      subscriptionId = idOf(object.subscription);
      workspaceId = object.metadata?.workspace_id || object.client_reference_id || undefined;
    } else if (object.object === "subscription") {
      subscriptionId = object.id;
      workspaceId = object.metadata.workspace_id || undefined;
    } else if (object.object === "invoice") {
      invoiceId = object.id;
      subscriptionId = invoiceSubscriptionId(object);
      workspaceId = object.parent?.subscription_details?.metadata?.workspace_id || undefined;
    }
    return {
      id: event.id,
      type: event.type,
      createdAt: iso(event.created)!,
      subscriptionId,
      workspaceId,
      invoiceId,
    };
  }
}
