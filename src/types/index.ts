import type { PresenceSite, PublicSurfaceMode } from "@/features/presence/presence.types";

export type ProjectStatus = "draft" | "published" | "archived";
export type StepType =
  | "welcome"
  | "choice"
  | "form"
  | "content"
  | "recommendation"
  | "action"
  | "thank_you"
  | "quote"
  | "catalog"
  | "cart"
  | "availability"
  | "schedule"
  | "reservation"
  | "routing"
  | "confirmation";

export type ActionType =
  | "go_to_step"
  | "open_url"
  | "open_whatsapp"
  | "submit_form"
  | "show_recommendation"
  | "start_capability"
  | "finish";

export type ContentBlockType =
  | "text"
  | "image"
  | "video"
  | "choice_grid"
  | "choice_list"
  | "benefits"
  | "testimonial"
  | "form"
  | "recommendation_card"
  | "cta_group"
  | "location_card"
  | "product_cards"
  | "schedule_slots"
  | "media_upload"
  | "quantity_selector"
  | "price_estimate"
  | "service_selector"
  | "resource_selector"
  | "calendar"
  | "date_range"
  | "guest_selector"
  | "availability_results"
  | "reservable_unit_cards"
  | "catalog_categories"
  | "catalog_item_cards"
  | "cart_summary"
  | "fulfillment_selector"
  | "location_selector"
  | "route_result"
  | "policy_card"
  | "deposit_card"
  | "booking_summary"
  | "quote_summary";

export type OfferKind =
  | "physical_product"
  | "digital_product"
  | "service"
  | "professional_service"
  | "hospitality"
  | "rental"
  | "event"
  | "content"
  | "membership"
  | "mixed";

export type CommercialIntent =
  | "buy"
  | "order"
  | "request_quote"
  | "schedule"
  | "reserve"
  | "check_availability"
  | "request_proposal"
  | "contact"
  | "visit"
  | "register"
  | "pay_deposit"
  | "continue_external";

export type ConfirmationMode = "instant" | "manual_approval" | "external_system";

export type CapacityKind =
  | "none"
  | "time_slot"
  | "professional"
  | "location"
  | "room"
  | "table"
  | "asset"
  | "inventory"
  | "daily_capacity";

export type CompletionChannel = "native" | "whatsapp" | "external_url" | "email" | "phone";

export type JourneyMode = "explicit_choice" | "assisted_discovery";

export type JourneyQuestionPurpose =
  | "need"
  | "signal"
  | "context"
  | "constraint"
  | "explicit_choice";

export interface StructuredJourneyQuestion {
  id: string;
  question: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox";
  options?: string[];
  purpose: JourneyQuestionPurpose;
  required: boolean;
}

export type DataOrigin =
  | "user"
  | "website"
  | "document"
  | "logo_analysis"
  | "ai_inference"
  | "generated_copy"
  | "system_default";

export type DataVerificationStatus = "verified" | "needs_confirmation" | "missing" | "invalid";

export interface GeneratedFieldMetadata {
  generatedByAI: boolean;
  generatedPlaceholder: boolean;
  verificationStatus: DataVerificationStatus;
  sourceId?: string;
}

export interface SourcedValue<T> {
  value: T | null;
  origin: DataOrigin;
  verificationStatus: DataVerificationStatus;
  sourceId?: string;
  confidence?: number;
  notes?: string;
}

export interface DataRequirement {
  id: string;
  key: string;
  label: string;
  capability: CapabilityKey | "brand" | "project";
  status: DataVerificationStatus;
  severity: "blocking" | "warning" | "optional";
  value?: unknown;
  origin?: DataOrigin;
  sourceId?: string;
  reason: string;
  actionLabel?: string;
  actionPath?: string;
  fieldMetadata?: GeneratedFieldMetadata;
}

export type CapabilityKey =
  | "qualification"
  | "quote"
  | "scheduling"
  | "catalog_order"
  | "reservation"
  | "routing"
  | "payment";

export interface BusinessRule {
  key: string;
  description: string;
  value?: string | number | boolean;
}

export interface BusinessCapabilityProfile {
  offerKinds: OfferKind[];
  primaryIntents: CommercialIntent[];
  secondaryIntents: CommercialIntent[];
  confirmationMode: ConfirmationMode;
  capacityKinds: CapacityKind[];
  hasMultipleLocations: boolean;
  requiresQualification: boolean;
  requiresMediaUpload: boolean;
  requiresPayment: boolean;
  allowsCancellationRequest: boolean;
  allowsRescheduleRequest: boolean;
  completionChannel: CompletionChannel;
  requiredVisitorData: string[];
  businessRules: BusinessRule[];
  analysisMetadata?: {
    source: "rules" | "ai" | "user";
    confidence: number;
    reasons: string[];
    analyzedAt: string;
  };
}

export interface ProjectCapability {
  key: CapabilityKey;
  enabled: boolean;
  source: "suggested" | "user" | "ai";
  version: number;
  configuration: Record<string, unknown>;
}

export type RuleOperator = "equals" | "contains" | "greater_than" | "less_than";

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: string | number | boolean;
}

export interface QualificationRule {
  id: string;
  projectId: string;
  condition: RuleCondition;
  scoreDelta?: number;
  recommendationKey?: string;
  routeKey?: string;
  reason?: string;
}

export interface QualificationResult {
  score: number;
  band: "cold" | "potential" | "qualified";
  recommendationKey?: string;
  routeKey?: string;
  reasons: string[];
}

export interface MediaReference {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  storagePath?: string;
}

export interface ServiceOffering {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  serviceMode: "contact" | "quote" | "schedule" | "external_checkout" | "external_url";
  priceMode: "fixed" | "starting_at" | "range" | "on_request" | "free";
  price?: number;
  minPrice?: number;
  maxPrice?: number;
  currency: string;
  imageAssetId?: string;
  destinationId?: string;
  externalUrl?: string;
  isFeatured: boolean;
  isActive: boolean;
  order: number;
  settings: Record<string, unknown>;
}

export interface ProjectPolicy {
  id: string;
  projectId: string;
  type: "privacy" | "cancellation" | "rescheduling" | "delivery" | "reservation" | "payment" | "custom";
  title: string;
  content: string;
  isActive: boolean;
  settings: Record<string, unknown>;
}

export interface QuoteCalculationRule {
  id: string;
  condition: RuleCondition;
  operation: "add" | "multiply" | "set" | "range";
  amount?: number;
  minAmount?: number;
  maxAmount?: number;
}

export interface QuoteDefinition {
  id: string;
  projectId: string;
  title: string;
  currency: string;
  baseAmount?: number;
  estimationMode: "exact" | "range" | "starting_at" | "manual";
  questions: FormField[];
  rules: QuoteCalculationRule[];
  completionChannel: CompletionChannel;
  isActive: boolean;
}

export interface QuoteRequest {
  id: string;
  projectId: string;
  sessionId: string;
  idempotencyKey?: string;
  leadId?: string;
  status: "draft" | "submitted" | "reviewing" | "quoted" | "accepted" | "rejected";
  answers: Record<string, unknown>;
  estimatedMin?: number;
  estimatedMax?: number;
  currency: string;
  attachments: MediaReference[];
  createdAt: string;
  updatedAt?: string;
}

export interface SchedulableService {
  id: string;
  projectId: string;
  serviceOfferingId?: string;
  name: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  capacity: number;
  confirmationMode: ConfirmationMode;
  isActive: boolean;
}

export interface SchedulableResource {
  id: string;
  projectId: string;
  name: string;
  kind: "professional" | "room" | "asset";
  isActive: boolean;
}

export interface AvailabilityRule {
  id: string;
  projectId: string;
  resourceId?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface AvailabilityException {
  id: string;
  projectId: string;
  resourceId?: string;
  startsAt: string;
  endsAt: string;
  isAvailable: boolean;
  reason?: string;
}

export interface Booking {
  id: string;
  projectId: string;
  sessionId: string;
  idempotencyKey?: string;
  leadId?: string;
  serviceId: string;
  resourceId?: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "cancel_requested" | "cancelled" | "reschedule_requested" | "completed" | "no_show";
  confirmationMode: ConfirmationMode;
  visitorData: Record<string, unknown>;
  createdAt?: string;
}

export interface CatalogVariant {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
}

export interface CatalogCategory {
  id: string;
  projectId: string;
  name: string;
  order: number;
  isActive: boolean;
}

export interface CatalogItem {
  id: string;
  projectId: string;
  categoryId?: string;
  name: string;
  description?: string;
  imageAssetId?: string;
  imageUrl?: string;
  price?: number;
  currency: string;
  isAvailable: boolean;
  variants: CatalogVariant[];
  metadata: Record<string, unknown>;
  isFeatured?: boolean;
  order?: number;
}

export interface OrderRequestItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  variantId?: string;
  notes?: string;
}

export interface OrderRequest {
  id: string;
  projectId: string;
  sessionId: string;
  idempotencyKey?: string;
  leadId?: string;
  status: "draft" | "submitted" | "confirmed" | "cancel_requested" | "cancelled";
  fulfillment: "delivery" | "pickup" | "digital" | "external";
  locationId?: string;
  items: OrderRequestItem[];
  totals: {
    subtotal: number;
    deliveryFee?: number;
    discount?: number;
    total: number;
    currency: string;
  };
  visitorData: Record<string, unknown>;
  createdAt?: string;
}

export interface ReservableUnit {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  capacityAdults: number;
  capacityChildren: number;
  quantity: number;
  basePrice?: number;
  depositAmount?: number;
  currency: string;
  confirmationMode?: ConfirmationMode;
  rules?: string;
  isActive: boolean;
  mediaAssetIds: string[];
  amenities: string[];
}

export interface ReservationBlock {
  id: string;
  projectId: string;
  unitId?: string;
  startsOn: string;
  endsOn: string;
  quantity: number;
  reason?: string;
}

export interface Reservation {
  id: string;
  projectId: string;
  sessionId: string;
  idempotencyKey?: string;
  leadId?: string;
  unitId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  status: "pending" | "confirmed" | "cancel_requested" | "cancelled" | "change_requested" | "completed";
  total?: number;
  depositAmount?: number;
  visitorData: Record<string, unknown>;
  createdAt?: string;
}

export interface OpeningHoursRule {
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed?: boolean;
}

export interface BusinessLocation {
  id: string;
  projectId: string;
  name: string;
  address?: string;
  addressLine?: string;
  addressNumber?: string;
  addressExtra?: string;
  city?: string;
  state?: string;
  neighborhood?: string;
  postalCode?: string;
  postalCodePrefixes?: string[];
  countryCode: string;
  latitude?: number;
  longitude?: number;
  geocodingStatus: "pending" | "resolved" | "manual" | "failed";
  geocodingProvider?: string;
  geocodedAt?: string;
  phone?: string;
  whatsapp?: string;
  externalUrl?: string;
  timezone: string;
  openingHours: OpeningHoursRule[];
  serviceRadiusKm?: number;
  deliveryRadiusKm?: number;
  supportsDelivery: boolean;
  supportsPickup: boolean;
  supportsInPerson: boolean;
  priority: number;
  isActive: boolean;
  routingDestinationId?: string;
  settings?: Record<string, unknown>;
}

export interface RoutingDestination {
  id: string;
  key: string;
  type: "location" | "whatsapp" | "seller" | "schedule" | "url" | "email" | "phone" | "checkout" | "form" | "recommendation" | "unavailable";
  label: string;
  locationId?: string;
  value?: string;
  message?: string;
}

export interface RoutingRule {
  id: string;
  projectId: string;
  priority: number;
  condition: RuleCondition;
  destinationId: string;
  isActive: boolean;
}

export interface RouteResult {
  destination?: RoutingDestination;
  ruleId?: string;
  fallback: boolean;
  reason: string;
}

export interface CartState {
  items: OrderRequestItem[];
  fulfillment?: OrderRequest["fulfillment"];
  notes?: string;
  totals: OrderRequest["totals"];
}

export interface QuoteDraft {
  answers: Record<string, unknown>;
  attachments: MediaReference[];
  estimatedMin?: number;
  estimatedMax?: number;
  currency: string;
}

export interface JourneyRuntimeState {
  visitorId: string;
  sessionId: string;
  currentStepId: string;
  answers: Record<string, unknown>;
  selectedOfferIds: string[];
  selectedLocationId?: string;
  selectedResourceId?: string;
  selectedSlot?: string;
  selectedDateRange?: { start: string; end: string };
  guests?: { adults: number; children: number };
  cart: CartState;
  quoteDraft?: QuoteDraft;
  recommendationKey?: string;
  recommendationReason?: string;
  recommendationConfidence?: "clear" | "possible" | "uncertain";
  routeResult?: RouteResult;
  idempotencyKeys?: Partial<Record<CapabilityKey, string>>;
  conversionGoalId?: string;
  entryPointId?: string;
  attribution?: AttributionContext;
}

export interface BrandPalette {
  sourceColors: string[];
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  success: string;
  warning: string;
  destructive: string;
  gradientStart?: string;
  gradientEnd?: string;
}

export interface ProjectDesignSystem {
  mode: "light" | "dark" | "auto";
  colors: BrandPalette;
  typography: {
    headingFont: string;
    bodyFont: string;
    headingWeight: number;
    bodyWeight: number;
    scale: "compact" | "standard" | "expressive";
  };
  shape: {
    cardRadius: number;
    buttonRadius: number;
    inputRadius: number;
    borderWidth: number;
  };
  elevation: {
    cardShadow: string;
    floatingShadow: string;
    glowColor?: string;
    glowIntensity?: number;
  };
  spacing: {
    density: "compact" | "balanced" | "spacious";
    sectionGap: number;
    cardGap: number;
  };
  imagery: {
    backgroundAssetId?: string;
    backgroundPosition?: string;
    overlayColor?: string;
    overlayOpacity?: number;
    decorativeStyle?: string;
  };
  motion: {
    transition: "none" | "fade" | "slide" | "scale";
    duration: number;
    cardHover: boolean;
  };
  buttons: {
    style: "solid" | "outline" | "soft" | "glass" | "gradient";
    height: "compact" | "normal" | "large";
    iconPosition: "left" | "right";
  };
  cards: {
    style: "flat" | "outlined" | "elevated" | "glass" | "gradient";
    borderColor?: string;
    surfaceOpacity?: number;
  };
}

export interface StepOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  value: string;
  actionType: ActionType;
  targetStepId?: string;
  actionPayload?: Record<string, string | number | boolean>;
  conversionGoalId?: string;
}

export type ConversionGoalKind =
  | "buy"
  | "request_quote"
  | "schedule"
  | "reserve"
  | "contact"
  | "visit"
  | "learn"
  | "custom";

export type ConversionGoalType = ConversionGoalKind;

export interface SuggestedConversionGoal {
  key: string;
  name: string;
  description?: string;
  type: ConversionGoalType;
  capabilityKey?: CapabilityKey;
  entryStepKey?: string;
  reasoning: string;
}

export interface ConversionGoal {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  kind: ConversionGoalKind;
  targetStepId: string;
  destinationLabel?: string;
  isPrimary: boolean;
  isActive: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface EntryPoint {
  id: string;
  projectId: string;
  key: string;
  name: string;
  conversionGoalId?: string;
  targetStepId?: string;
  surfaceMode?: PublicSurfaceMode;
  presencePageId?: string;
  channel: "bio" | "story" | "instagram_reel" | "tiktok" | "youtube" | "ad" | "qr" | "linkedin" | "other";
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttributionContext {
  entryPointId?: string;
  conversionGoalId?: string;
  source: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referrer?: string;
  presencePageId?: string;
  presenceSectionId?: string;
  activationId?: string;
  benefitClaimId?: string;
}

export interface FormField {
  id: string;
  label: string;
  key: string;
  type: "text" | "email" | "phone" | "number" | "textarea" | "select" | "radio" | "checkbox" | "date" | "time" | "url" | "file";
  placeholder?: string;
  required: boolean;
  options?: string[];
  includeInHandoff?: boolean;
  handoffLabel?: string;
  purpose?: JourneyQuestionPurpose;
}

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  variant?: string;
  content?: Record<string, unknown>;
  style?: Record<string, string | number | boolean>;
}

export interface JourneyStep {
  id: string;
  type: StepType;
  title: string;
  description?: string;
  order: number;
  visualVariant?: string;
  options?: StepOption[];
  blocks?: ContentBlock[];
  formFields?: FormField[];
  recommendation?: {
    title: string;
    description: string;
    label?: string;
    benefits: string[];
    deliverables?: string[];
  };
  settings?: Record<string, unknown>;
  isActive: boolean;
}

export interface BrandProfile {
  primaryLogoAssetId?: string;
  lightLogoAssetId?: string;
  darkLogoAssetId?: string;
  faviconAssetId?: string;
  logoDataUrl?: string;
  lightLogoDataUrl?: string;
  darkLogoDataUrl?: string;
  faviconDataUrl?: string;
  extractedColors: string[];
  activePalette: BrandPalette;
  paletteVariations: Array<{ name: "Fiel" | "Equilibrada" | "Ousada"; palette: BrandPalette }>;
  brandPersonality: string[];
  analysisMetadata?: {
    confidence: number;
    orientation?: "horizontal" | "vertical" | "square";
    luminance?: "light" | "dark" | "mixed";
    colorCount?: number;
  };
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string;
  subtitle: string;
  status: ProjectStatus;
  primaryGoal: string;
  primaryDestination: string;
  category?: string;
  audience?: string;
  phone?: string;
  visualDirection: string;
  designSystem: ProjectDesignSystem;
  brand: BrandProfile;
  steps: JourneyStep[];
  conversionGoals?: ConversionGoal[];
  entryPoints?: EntryPoint[];
  presence?: PresenceSite;
  mediaAssets?: MediaAsset[];
  businessProfile?: BusinessCapabilityProfile;
  capabilities?: ProjectCapability[];
  commercialConfig?: {
    serviceOfferings?: ServiceOffering[];
    qualificationRules?: QualificationRule[];
    quoteDefinition?: QuoteDefinition;
    schedulableServices?: SchedulableService[];
    resources?: SchedulableResource[];
    availabilityRules?: AvailabilityRule[];
    availabilityExceptions?: AvailabilityException[];
    catalogCategories?: CatalogCategory[];
    catalogItems?: CatalogItem[];
    reservableUnits?: ReservableUnit[];
    reservationBlocks?: ReservationBlock[];
    locations?: BusinessLocation[];
    routingRules?: RoutingRule[];
    routingDestinations?: RoutingDestination[];
    paymentUrl?: string;
    policies?: ProjectPolicy[];
  };
  dataRequirements?: DataRequirement[];
  version: number;
  publishedVersionId?: string;
  publishedVersionNumber?: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface MediaAsset {
  id: string;
  workspaceId: string;
  projectId?: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  assetType?: "logo" | "favicon" | "image" | "video" | "background" | "product" | "service" | "accommodation" | "portfolio" | "testimonial" | "document_preview";
  status?: "processing" | "ready" | "failed" | "published";
  altText?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface BusinessSource {
  id: string;
  workspaceId: string;
  projectId?: string;
  setupSessionId?: string;
  type: "website" | "text" | "pdf" | "image" | "csv";
  name: string;
  sourceUrl?: string;
  storagePath?: string;
  mimeType?: string;
  fileSize?: number;
  checksum?: string;
  status: "pending" | "uploaded" | "processing" | "processed" | "failed";
  extractedText?: string;
  extractedData: Record<string, unknown>;
  processingError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSourceFact {
  id: string;
  sourceId: string;
  projectId?: string;
  key: string;
  type: string;
  value: unknown;
  evidenceExcerpt?: string;
  confidence?: number;
  verificationStatus: DataVerificationStatus | "rejected";
  appliedAt?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  workspaceId: string;
  projectId?: string;
  userId?: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  readAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  workspaceId: string;
  userId: string;
  eventKey: string;
  inApp: boolean;
  email: boolean;
}

export interface Lead {
  id: string;
  projectId: string;
  projectName: string;
  sessionId: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  source?: string;
  campaign?: string;
  recommendation?: string;
  answers: Record<string, string>;
  score?: number;
  qualificationBand?: QualificationResult["band"];
  qualificationReason?: string;
  commercialAction?: CapabilityKey;
  commercialObjectId?: string;
  operationalStatus?: string;
  estimatedValue?: number;
  scheduledAt?: string;
  locationName?: string;
  items?: OrderRequestItem[];
  attachments?: MediaReference[];
  timeline?: Array<{ label: string; at: string; metadata?: Record<string, unknown> }>;
  notes?: string;
  createdAt: string;
}

export type AnalyticsEventName =
  | "page_view"
  | "presence_page_viewed"
  | "presence_section_viewed"
  | "presence_cta_clicked"
  | "presence_conversion_started"
  | "session_started"
  | "step_viewed"
  | "option_clicked"
  | "form_started"
  | "form_submitted"
  | "recommendation_viewed"
  | "cta_clicked"
  | "whatsapp_clicked"
  | "external_link_clicked"
  | "journey_completed"
  | "capability_started"
  | "qualification_completed"
  | "quote_started"
  | "quote_submitted"
  | "quote_estimate_viewed"
  | "media_uploaded"
  | "availability_searched"
  | "slot_selected"
  | "booking_submitted"
  | "booking_confirmed"
  | "booking_cancel_requested"
  | "catalog_viewed"
  | "item_viewed"
  | "item_added"
  | "cart_viewed"
  | "order_submitted"
  | "reservation_search_started"
  | "reservation_option_viewed"
  | "reservation_submitted"
  | "reservation_confirmed"
  | "reservation_cancel_requested"
  | "route_resolved"
  | "payment_started"
  | "entry_point_loaded"
  | "conversion_goal_selected"
  | "conversion_goal_resolved"
  | "opportunity_created"
  | "conversion_confirmed"
  | "conversion_lost"
  | "activation_viewed"
  | "activation_cta_clicked"
  | "activation_started"
  | "customer_identified"
  | "benefit_eligibility_checked"
  | "benefit_claim_issued"
  | "benefit_claim_presented"
  | "benefit_claim_redeemed"
  | "benefit_claim_rejected"
  | "activation_opportunity_created";

export interface AnalyticsEvent {
  id: string;
  projectId: string;
  visitorId: string;
  sessionId: string;
  eventName: AnalyticsEventName;
  projectVersionId?: string;
  conversionGoalId?: string;
  entryPointId?: string;
  presencePageId?: string;
  presenceSectionId?: string;
  destinationId?: string;
  activationId?: string;
  benefitClaimId?: string;
  stepId?: string;
  optionId?: string;
  metadata?: Record<string, unknown>;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  deviceType?: string;
  createdAt: string;
}

export type OpportunityStatus = "new" | "in_progress" | "converted" | "lost" | "archived";
export type OpportunitySourceType = "lead" | "quote" | "booking" | "order" | "reservation" | "routed_contact";

export interface OpportunityTimelineItem {
  id: string;
  opportunityId: string;
  eventType: "created" | "status_changed" | "converted" | "lost" | "note";
  label: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CommercialOpportunity {
  id: string;
  workspaceId: string;
  projectId: string;
  projectName?: string;
  sessionId?: string;
  projectVersionId?: string;
  conversionGoalId?: string;
  entryPointId?: string;
  presencePageId?: string;
  presenceSectionId?: string;
  destinationId?: string;
  activationId?: string;
  benefitClaimId?: string;
  customerIdentityId?: string;
  sourceType: OpportunitySourceType;
  sourceId: string;
  status: OpportunityStatus;
  title: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  summary?: string;
  estimatedValue?: number;
  confirmedValue?: number;
  currency: string;
  lossReason?: string;
  firstHandledAt?: string;
  convertedAt?: string;
  lostAt?: string;
  attribution?: AttributionContext;
  metadata: Record<string, unknown>;
  timeline?: OpportunityTimelineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OptimizationSuggestion {
  id: string;
  projectId: string;
  kind: "goal_dropoff" | "entry_underperformance" | "destination_friction" | "journey_friction" | "presence_cta" | "presence_structure" | "landing_page";
  title: string;
  explanation: string;
  evidence: Record<string, number | string>;
  targetMetric?: "intention_rate" | "action_rate" | "opportunity_rate" | "conversion_rate" | "confirmed_value_per_session";
  proposedChange?: {
    changeType: "shorten_journey" | "reorder_step" | "remove_optional_field" | "change_cta_copy" | "move_primary_cta" | "change_goal_priority" | "change_entry_surface" | "simplify_choice_set";
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    riskLevel: "low" | "medium" | "high";
  };
  status: "open" | "dismissed" | "applied";
  createdAt: string;
}

export interface ExperienceCompositionInput {
  businessName: string;
  businessDescription: string;
  primaryGoal: string;
  primaryDestination: string;
  slug: string;
  category?: string;
  audience?: string;
  phone?: string;
  brandPersonality?: string[];
  visualDirection?: string;
  brand?: BrandProfile;
  preferredDensity?: "compact" | "balanced" | "immersive";
  preferredTheme?: "light" | "dark" | "auto";
  websiteUrl?: string;
  offerKinds?: OfferKind[];
  primaryIntents?: CommercialIntent[];
  secondaryIntents?: CommercialIntent[];
  confirmationMode?: ConfirmationMode;
  capacityKinds?: CapacityKind[];
  hasMultipleLocations?: boolean;
  requiresQualification?: boolean;
  requiresMediaUpload?: boolean;
  requiresPayment?: boolean;
  allowsCancellationRequest?: boolean;
  allowsRescheduleRequest?: boolean;
  completionChannel?: CompletionChannel;
  requiredVisitorData?: string[];
  businessRules?: BusinessRule[];
}
