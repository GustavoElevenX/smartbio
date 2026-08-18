import "server-only";

export type BillingFinancialStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "paused"
  | "trialing"
  | "unpaid";

export interface BillingPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface BillingInvoice {
  id: string;
  number?: string;
  createdAt: string;
  amountPaid: number;
  amountDue: number;
  currency: string;
  status: string;
  hostedUrl?: string;
  pdfUrl?: string;
}

export interface BillingSubscriptionSnapshot {
  id: string;
  customerId: string;
  priceId: string;
  workspaceId?: string;
  status: BillingFinancialStatus;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string;
  providerUpdatedAt: string;
  defaultPaymentMethod?: BillingPaymentMethod;
  latestInvoiceId?: string;
}

export interface BillingCheckoutSession {
  id: string;
  clientSecret: string;
  expiresAt: string;
  status?: string;
  subscriptionId?: string;
}

export interface BillingWebhookEvent {
  id: string;
  type: string;
  createdAt: string;
  subscriptionId?: string;
  workspaceId?: string;
  invoiceId?: string;
}

export interface BillingProvider {
  readonly key: "stripe";
  createCustomer(input: {
    email: string;
    workspaceId: string;
    idempotencyKey: string;
  }): Promise<{ id: string }>;
  createCheckoutSession(input: {
    customerId: string;
    workspaceId: string;
    priceId: string;
    returnUrl: string;
    idempotencyKey: string;
  }): Promise<BillingCheckoutSession>;
  retrieveCheckoutSession(sessionId: string): Promise<BillingCheckoutSession>;
  findRecoverableSubscription(
    customerId: string,
    priceId: string,
  ): Promise<BillingSubscriptionSnapshot | undefined>;
  retrieveSubscription(subscriptionId: string): Promise<BillingSubscriptionSnapshot>;
  scheduleCancellation(subscriptionId: string): Promise<BillingSubscriptionSnapshot>;
  reactivateSubscription(subscriptionId: string): Promise<BillingSubscriptionSnapshot>;
  createSetupIntent(customerId: string, workspaceId: string): Promise<{ id: string; clientSecret: string }>;
  updateDefaultPaymentMethod(input: {
    customerId: string;
    subscriptionId: string;
    paymentMethodId: string;
  }): Promise<BillingPaymentMethod>;
  listInvoices(customerId: string, limit?: number): Promise<BillingInvoice[]>;
  parseWebhook(payload: string, signature: string, secret: string): BillingWebhookEvent;
}
