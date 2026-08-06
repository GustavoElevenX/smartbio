import { z } from "zod";
const capabilityKeySchema = z.enum(["qualification", "quote", "scheduling", "catalog_order", "reservation", "routing", "payment"]);

const uuidSchema = z.uuid();
const slugSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const moneySchema = z.number().finite().min(0).max(100_000_000);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const timezoneSchema = z.string().trim().min(3).max(80).regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/);
const phoneSchema = z.string().trim().max(40).regex(/^[\d+()\s-]+$/);
const jsonRecordSchema = z.record(z.string().max(120), z.json());

const ruleConditionSchema = z.object({
  field: z.string().trim().min(1).max(120),
  operator: z.enum(["equals", "contains", "greater_than", "less_than"]),
  value: z.union([z.string().max(500), z.number().finite(), z.boolean()]),
});

export const serviceOfferingObjectSchema = z.object({
  id: uuidSchema, projectId: uuidSchema, name: z.string().trim().min(1).max(160), slug: slugSchema,
  description: z.string().max(3000).optional(), shortDescription: z.string().max(300).optional(),
  serviceMode: z.enum(["contact", "quote", "schedule", "external_checkout", "external_url"]),
  priceMode: z.enum(["fixed", "starting_at", "range", "on_request", "free"]),
  price: moneySchema.optional(), minPrice: moneySchema.optional(), maxPrice: moneySchema.optional(), currency: currencySchema,
  imageAssetId: uuidSchema.optional(), destinationId: uuidSchema.optional(), externalUrl: z.url().optional(),
  isFeatured: z.boolean(), isActive: z.boolean(), order: z.number().int().min(0).max(10_000), settings: jsonRecordSchema,
});
export const serviceOfferingSchema = serviceOfferingObjectSchema.refine((value) => value.minPrice == null || value.maxPrice == null || value.minPrice <= value.maxPrice, { message: "A faixa de preço é inválida.", path: ["maxPrice"] });

export const projectPolicySchema = z.object({ id: uuidSchema, projectId: uuidSchema, type: z.enum(["privacy", "cancellation", "rescheduling", "delivery", "reservation", "payment", "custom"]), title: z.string().trim().min(1).max(180), content: z.string().trim().min(1).max(20_000), isActive: z.boolean(), settings: jsonRecordSchema });

export const quoteQuestionSchema = z.object({ id: uuidSchema, label: z.string().trim().min(1).max(180), key: z.string().trim().min(1).max(100), type: z.enum(["text", "email", "phone", "number", "textarea", "select", "radio", "checkbox", "date", "time", "url", "file"]), placeholder: z.string().max(300).optional(), required: z.boolean(), options: z.array(z.string().max(200)).max(50).optional() });
export const quoteRuleSchema = z.object({ id: uuidSchema, condition: ruleConditionSchema, operation: z.enum(["add", "multiply", "set", "range"]), amount: moneySchema.optional(), minAmount: moneySchema.optional(), maxAmount: moneySchema.optional() });
export const quoteDefinitionSchema = z.object({ id: uuidSchema, projectId: uuidSchema, title: z.string().trim().min(1).max(180), currency: currencySchema, baseAmount: moneySchema.optional(), estimationMode: z.enum(["exact", "range", "starting_at", "manual"]), questions: z.array(quoteQuestionSchema).max(100), rules: z.array(quoteRuleSchema).max(200), completionChannel: z.enum(["native", "whatsapp", "external_url", "email", "phone"]), isActive: z.boolean() });

export const schedulableServiceSchema = z.object({ id: uuidSchema, projectId: uuidSchema, serviceOfferingId: uuidSchema.optional(), name: z.string().trim().min(1).max(160), durationMinutes: z.number().int().min(1).max(24 * 60), bufferBeforeMinutes: z.number().int().min(0).max(24 * 60), bufferAfterMinutes: z.number().int().min(0).max(24 * 60), capacity: z.number().int().min(1).max(100_000), confirmationMode: z.enum(["instant", "manual_approval", "external_system"]), isActive: z.boolean() });
export const resourceSchema = z.object({ id: uuidSchema, projectId: uuidSchema, name: z.string().trim().min(1).max(160), kind: z.enum(["professional", "room", "asset"]), isActive: z.boolean() });
export const availabilityRuleSchema = z.object({ id: uuidSchema, projectId: uuidSchema, resourceId: uuidSchema.optional(), weekday: z.number().int().min(0).max(6), startTime: timeSchema, endTime: timeSchema, timezone: timezoneSchema });
export const availabilityExceptionSchema = z.object({ id: uuidSchema, projectId: uuidSchema, resourceId: uuidSchema.optional(), startsAt: z.iso.datetime({ local: true }), endsAt: z.iso.datetime({ local: true }), isAvailable: z.boolean(), reason: z.string().max(500).optional() }).refine((value) => new Date(value.endsAt) > new Date(value.startsAt), { message: "O fim deve ser posterior ao início.", path: ["endsAt"] });

export const catalogCategorySchema = z.object({ id: uuidSchema, projectId: uuidSchema, name: z.string().trim().min(1).max(160), order: z.number().int().min(0).max(10_000), isActive: z.boolean() });
export const catalogItemVariantSchema = z.object({ id: uuidSchema, name: z.string().trim().min(1).max(160), priceDelta: z.number().finite().min(-100_000_000).max(100_000_000), isAvailable: z.boolean() });
export const catalogItemSchema = z.object({ id: uuidSchema, projectId: uuidSchema, categoryId: uuidSchema.optional(), name: z.string().trim().min(1).max(160), description: z.string().max(3000).optional(), imageAssetId: uuidSchema.optional(), imageUrl: z.url().optional(), price: moneySchema.optional(), currency: currencySchema, isAvailable: z.boolean(), variants: z.array(catalogItemVariantSchema).max(100), metadata: jsonRecordSchema, isFeatured: z.boolean().optional(), order: z.number().int().min(0).max(10_000).optional() });

export const reservableUnitSchema = z.object({ id: uuidSchema, projectId: uuidSchema, name: z.string().trim().min(1).max(160), description: z.string().max(3000).optional(), capacityAdults: z.number().int().min(1).max(100_000), capacityChildren: z.number().int().min(0).max(100_000), quantity: z.number().int().min(1).max(100_000), basePrice: moneySchema.optional(), depositAmount: moneySchema.optional(), currency: currencySchema, confirmationMode: z.enum(["instant", "manual_approval", "external_system"]).optional(), rules: z.string().max(10_000).optional(), isActive: z.boolean(), mediaAssetIds: z.array(uuidSchema).max(100), amenities: z.array(z.string().max(180)).max(200) });
export const reservationBlockSchema = z.object({ id: uuidSchema, projectId: uuidSchema, unitId: uuidSchema.optional(), startsOn: z.iso.date(), endsOn: z.iso.date(), quantity: z.number().int().min(1).max(100_000), reason: z.string().max(500).optional() }).refine((value) => new Date(value.endsOn) > new Date(value.startsOn), { message: "O fim deve ser posterior ao início.", path: ["endsOn"] });

export const routingDestinationSchema = z.object({ id: uuidSchema, key: z.string().trim().min(1).max(120), type: z.enum(["location", "whatsapp", "seller", "schedule", "url", "email", "phone", "checkout", "form", "recommendation", "unavailable"]), label: z.string().trim().min(1).max(180), locationId: uuidSchema.optional(), value: z.string().max(2000).optional(), message: z.string().max(2000).optional() });
export const routingRuleSchema = z.object({ id: uuidSchema, projectId: uuidSchema, priority: z.number().int().min(-10_000).max(10_000), condition: ruleConditionSchema, destinationId: uuidSchema, isActive: z.boolean() });
export const businessLocationObjectSchema = z.object({ id: uuidSchema, projectId: uuidSchema, name: z.string().trim().min(1).max(180), address: z.string().max(1000).optional(), addressLine: z.string().max(500).optional(), addressNumber: z.string().max(80).optional(), addressExtra: z.string().max(180).optional(), city: z.string().max(180).optional(), state: z.string().max(100).optional(), neighborhood: z.string().max(180).optional(), postalCode: z.string().max(20).optional(), postalCodePrefixes: z.array(z.string().max(20)).max(100).optional(), countryCode: z.string().length(2), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), geocodingStatus: z.enum(["pending", "resolved", "manual", "failed"]), geocodingProvider: z.string().max(80).optional(), geocodedAt: z.iso.datetime().optional(), phone: phoneSchema.optional(), whatsapp: phoneSchema.optional(), externalUrl: z.url().optional(), timezone: timezoneSchema, openingHours: z.array(z.object({ weekday: z.number().int().min(0).max(6), opensAt: timeSchema, closesAt: timeSchema, isClosed: z.boolean().optional() })).max(50), serviceRadiusKm: z.number().min(0).max(50_000).optional(), deliveryRadiusKm: z.number().min(0).max(50_000).optional(), supportsDelivery: z.boolean(), supportsPickup: z.boolean(), supportsInPerson: z.boolean(), priority: z.number().int().min(-10_000).max(10_000), isActive: z.boolean(), routingDestinationId: uuidSchema.optional(), settings: jsonRecordSchema.optional() });
export const businessLocationSchema = businessLocationObjectSchema.refine((value) => (value.latitude == null) === (value.longitude == null), { message: "Latitude e longitude devem ser informadas juntas.", path: ["latitude"] });

export const commercialConfigSchema = z.object({
  serviceOfferings: z.array(serviceOfferingSchema).max(1000).optional(),
  quoteDefinition: quoteDefinitionSchema.optional(),
  schedulableServices: z.array(schedulableServiceSchema).max(1000).optional(), resources: z.array(resourceSchema).max(1000).optional(),
  availabilityRules: z.array(availabilityRuleSchema).max(5000).optional(), availabilityExceptions: z.array(availabilityExceptionSchema).max(5000).optional(),
  catalogCategories: z.array(catalogCategorySchema).max(1000).optional(), catalogItems: z.array(catalogItemSchema).max(10_000).optional(),
  reservableUnits: z.array(reservableUnitSchema).max(1000).optional(), reservationBlocks: z.array(reservationBlockSchema).max(5000).optional(),
  routingDestinations: z.array(routingDestinationSchema).max(1000).optional(), routingRules: z.array(routingRuleSchema).max(5000).optional(),
  locations: z.array(businessLocationSchema).max(1000).optional(), paymentUrl: z.url().optional(), policies: z.array(projectPolicySchema).max(1000).optional(),
});

const capabilitySchema = z.object({ key: capabilityKeySchema, enabled: z.boolean(), source: z.enum(["suggested", "user", "ai"]), version: z.number().int().min(1), configuration: jsonRecordSchema });
const requirementSchema = z.object({ id: z.string().min(1).max(200), key: z.string().min(1).max(160), label: z.string().min(1).max(180), capability: z.union([capabilityKeySchema, z.enum(["brand", "project"])]), status: z.enum(["verified", "needs_confirmation", "missing", "invalid"]), severity: z.enum(["blocking", "warning", "optional"]), value: z.json().optional(), origin: z.enum(["user", "website", "document", "logo_analysis", "ai_inference", "generated_copy", "system_default"]).optional(), sourceId: z.string().max(200).optional(), reason: z.string().min(1).max(500), actionLabel: z.string().max(120).optional(), actionPath: z.string().max(500).optional(), fieldMetadata: jsonRecordSchema.optional() });
const deletedSchema = z.object({ serviceOfferingIds: z.array(uuidSchema).default([]), quoteQuestionIds: z.array(uuidSchema).default([]), catalogItemIds: z.array(uuidSchema).default([]), catalogCategoryIds: z.array(uuidSchema).default([]), resourceIds: z.array(uuidSchema).default([]), locationIds: z.array(uuidSchema).default([]), policyIds: z.array(uuidSchema).default([]) });

export const commercialDataInputSchema = z.object({
  data: commercialConfigSchema,
  capabilities: z.array(capabilitySchema).max(20),
  dataRequirements: z.array(requirementSchema).max(1000),
  deleted: deletedSchema.default({ serviceOfferingIds: [], quoteQuestionIds: [], catalogItemIds: [], catalogCategoryIds: [], resourceIds: [], locationIds: [], policyIds: [] }),
  expectedProjectVersion: z.number().int().min(1),
});

export type CommercialDataInput = z.infer<typeof commercialDataInputSchema>;
