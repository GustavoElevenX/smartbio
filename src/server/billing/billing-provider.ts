// PAYMENT_GATEWAY_PENDING: the selected provider must implement only this boundary.
export interface BillingProvider{readonly key:string;createCheckoutSession(input:unknown):Promise<never>;createCustomerPortal(input:unknown):Promise<never>;parseWebhook(input:unknown):Promise<never>}
