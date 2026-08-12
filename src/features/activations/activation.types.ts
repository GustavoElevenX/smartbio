export type ConversionActivationType = "promotion" | "launch" | "fill_calendar" | "lead_capture" | "product_push" | "service_push" | "location_push" | "waitlist" | "seasonal" | "announcement" | "custom";
export type ConversionActivationStatus = "draft" | "scheduled" | "active" | "paused" | "ended" | "archived";
export type ActivationOfferType = "percentage_discount" | "fixed_discount" | "free_shipping" | "special_price" | "free_item" | "bonus" | "coupon" | "no_discount";
export type ActivationPlacementType = "announcement_bar" | "hero_override" | "section_badge" | "product_badge" | "service_badge" | "conversion_cta" | "journey_banner" | "floating_cta";
export type CustomerEligibilityState = "unknown" | "new_to_virou" | "known_to_virou" | "known_historical_customer" | "known_external_customer";
export type FirstPurchaseRule = "first_purchase_via_virou" | "first_order_via_virou" | "first_purchase_business_verified";
export type ActivationConversionPolicy = "redemption_marks_conversion" | "manual_conversion" | "external_conversion";

export interface RuleCondition { field: string; operator: "eq" | "neq" | "in" | "not_in" | "gte" | "lte"; value: unknown }
export interface ActivationLimits { maxClaims?: number; maxRedemptions?: number; maxClaimsPerCustomer?: number; maxRedemptionsPerCustomer?: number }
export interface ActivationEligibility {
  customerRule?: "any" | FirstPurchaseRule | "known_customer";
  entryPointIds?: string[]; locationIds?: string[]; minSubtotal?: number; fulfillment?: string[]; weekdays?: number[];
  catalogItemIds?: string[]; catalogCategoryIds?: string[]; serviceOfferingIds?: string[]; customConditions?: RuleCondition[];
}
export interface ActivationOfferScope {
  catalogItemIds?: string[]; catalogCategoryIds?: string[]; serviceOfferingIds?: string[]; schedulableServiceIds?: string[];
  reservableUnitIds?: string[]; locationIds?: string[]; fulfillment?: Array<"delivery" | "pickup" | "digital" | "external">;
}
export interface ActivationOffer {
  id: string; activationId: string; offerType: ActivationOfferType; label: string; description?: string; percentage?: number; amount?: number;
  specialPrice?: number; currency: string; minSubtotal?: number; maxDiscount?: number; scope: ActivationOfferScope;
  benefitConfig: Record<string, unknown>; isActive: boolean; createdAt?: string; updatedAt?: string;
}
export interface ActivationPlacement {
  id: string; activationId: string; presencePageId?: string; presenceSectionId?: string; placementType: ActivationPlacementType;
  content: Record<string, unknown>; style: Record<string, unknown>; priority: number; isActive: boolean;
}
export interface ConversionActivation {
  id: string; workspaceId: string; projectId: string; activationKey: string; name: string; description?: string; activationType: ConversionActivationType;
  status: ConversionActivationStatus; conversionGoalId?: string; defaultDestinationId?: string; title?: string; message?: string; startsAt?: string;
  endsAt?: string; timezone: string; priority: number; requiresIdentity: boolean; identityMode: "none" | "phone" | "email" | "phone_or_email";
  identityVerification?: "none" | "otp"; completionChannel?: "native" | "whatsapp" | "external_url" | "email" | "phone";
  eligibility: ActivationEligibility; limits: ActivationLimits; settings: Record<string, unknown> & { conversionPolicy?: ActivationConversionPolicy; claimTtlMinutes?: number; claimAfterActivationEnd?: "honor_until_claim_expiry" | "expire_immediately"; termsText?: string; showRemainingUses?: boolean };
  offers: ActivationOffer[]; placements: ActivationPlacement[]; entryPointIds?: string[]; locationIds?: string[]; publishedSnapshot?: Record<string, unknown>;
  publishedAt?: string; version: number; createdAt?: string; updatedAt?: string;
}
export interface PublicActivation extends Pick<ConversionActivation, "id" | "name" | "title" | "message" | "activationType" | "conversionGoalId" | "defaultDestinationId" | "requiresIdentity" | "identityMode" | "completionChannel" | "startsAt" | "endsAt" | "timezone"> { offer?: Pick<ActivationOffer, "id" | "offerType" | "label" | "description" | "percentage" | "amount" | "specialPrice" | "currency" | "minSubtotal" | "maxDiscount" | "scope">; placements: ActivationPlacement[]; remainingRedemptions?: number }
export interface ActivationPerformance {
  activationId: string; views: number; ctaClicks: number; identities: number; claimsIssued: number; claimsPresented: number; redemptions: number;
  opportunities: number; conversions: number; confirmedValue: number;
  rates: { viewToClaim?: number; claimToRedemption?: number; viewToOpportunity?: number; opportunityToConversion?: number };
}
export interface CustomerHistoryCoverage { status: "virou_only" | "historical_import" | "external_sync"; lastUpdatedAt?: string; sourceCount: number }
