import type { CustomerEligibilityState, CustomerHistoryCoverage } from "@/features/activations/activation.types";
export type CustomerEvidenceType = "first_seen" | "order_submitted" | "opportunity_converted" | "benefit_redeemed" | "historical_customer_import" | "external_customer" | "manual_confirmation";
export interface CustomerIdentity { id: string; workspaceId: string; projectId: string; phoneE164?: string; phoneHash?: string; emailNormalized?: string; emailHash?: string; externalCustomerId?: string; firstSeenAt: string; lastSeenAt: string; metadata: Record<string, unknown> }
export interface CustomerIdentityEvidence { id: string; customerIdentityId: string; projectId: string; evidenceType: CustomerEvidenceType; sourceType?: string; sourceId?: string; occurredAt: string; metadata: Record<string, unknown> }
export interface CustomerEligibilityHistory { state: CustomerEligibilityState; evidence: CustomerIdentityEvidence[]; coverage: CustomerHistoryCoverage }
