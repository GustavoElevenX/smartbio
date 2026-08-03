import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPalette } from "@/features/brand-intelligence/colors";
import type { BrandProfile, JourneyStep, Project, ProjectDesignSystem } from "@/types";

const projectSelect = `
  id,workspace_id,name,slug,description,status,primary_goal,category,theme,settings,published_at,created_at,updated_at,
  brand_profiles(extracted_colors,active_palette,palette_variations,design_system,brand_personality,analysis_metadata),
  business_profiles(signals),project_capabilities(capability_key,enabled,source,settings),
  quote_definitions(id,name,currency,base_price,is_active,settings,quote_rules(id,field_key,operator,expected_value,operation,price_delta,min_delta,max_delta,rule_order)),
  schedulable_services(id,name,duration_minutes,buffer_before_minutes,buffer_after_minutes,confirmation_mode,is_active,settings),
  resources(id,name,resource_type,is_active),availability_rules(id,resource_id,weekday,starts_at,ends_at,timezone),availability_exceptions(id,resource_id,starts_at,ends_at,is_available,reason),
  catalog_categories(id,name,category_order,is_active),catalog_items(id,category_id,name,description,image_asset_id,price,currency,is_available,variants,metadata),
  reservable_units(id,name,description,capacity_adults,capacity_children,quantity,base_price,currency,is_active,media_asset_ids,amenities),reservation_blocks(id,unit_id,starts_on,ends_on,quantity,reason),
  routing_destinations(id,label,channel,value,is_active),routing_rules(id,destination_id,conditions,priority,is_active),
  journey_steps(id,type,title,description,step_order,is_active,settings,
    content_blocks(id,block_type,block_order,content,settings),
    step_options(id,label,description,icon,value,option_order,action_type,target_step_id,action_payload),
    form_definitions(form_fields(id,label,field_key,field_type,placeholder,required,field_order,options))
  )`;

function first<T>(value: T | T[] | null | undefined): T | undefined { return Array.isArray(value) ? value[0] : value || undefined; }

function fallbackDesign(colors: ReturnType<typeof buildPalette>): ProjectDesignSystem {
  return {
    mode: "light", colors,
    typography: { headingFont: "Manrope", bodyFont: "Inter", headingWeight: 800, bodyWeight: 450, scale: "expressive" },
    shape: { cardRadius: 22, buttonRadius: 16, inputRadius: 14, borderWidth: 1 },
    elevation: { cardShadow: "0 18px 44px rgba(28,25,50,.1)", floatingShadow: "0 30px 80px rgba(20,18,40,.18)", glowColor: colors.primary, glowIntensity: .1 },
    spacing: { density: "balanced", sectionGap: 28, cardGap: 12 }, imagery: { decorativeStyle: "soft-orbs", overlayOpacity: .12 },
    motion: { transition: "slide", duration: 280, cardHover: true }, buttons: { style: "solid", height: "large", iconPosition: "right" },
    cards: { style: "elevated", borderColor: colors.border, surfaceOpacity: 1 },
  };
}

function fromRow(row: Record<string, unknown>): Project | null {
  const settings = row.settings && typeof row.settings === "object" ? row.settings as Record<string, unknown> : {};
  const payload = settings.projectPayload;
  if (payload && typeof payload === "object") return payload as Project;
  const brandRow = first(row.brand_profiles as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const extracted = Array.isArray(brandRow?.extracted_colors) ? brandRow.extracted_colors.map(String) : ["#6D5EF5", "#19B88B", "#FF725E"];
  const colors = { ...buildPalette(extracted), ...(brandRow?.active_palette as object || {}) };
  const brand: BrandProfile = { extractedColors: extracted, activePalette: colors, paletteVariations: Array.isArray(brandRow?.palette_variations) ? brandRow.palette_variations as BrandProfile["paletteVariations"] : [], brandPersonality: Array.isArray(brandRow?.brand_personality) ? brandRow.brand_personality.map(String) : ["Equilibrada"], analysisMetadata: brandRow?.analysis_metadata as BrandProfile["analysisMetadata"] };
  const theme = row.theme && typeof row.theme === "object" ? row.theme as Partial<ProjectDesignSystem> : {};
  const designSystem: ProjectDesignSystem = { ...fallbackDesign(colors), ...theme, colors: { ...colors, ...(theme.colors || {}) } };
  const stepRows = Array.isArray(row.journey_steps) ? row.journey_steps as Array<Record<string, unknown>> : [];
  const steps: JourneyStep[] = stepRows.map((step) => {
    const stepSettings = step.settings && typeof step.settings === "object" ? step.settings as Record<string, unknown> : {};
    const options = Array.isArray(step.step_options) ? (step.step_options as Array<Record<string, unknown>>).sort((a, b) => Number(a.option_order) - Number(b.option_order)).map((option) => ({ id: String(option.id), label: String(option.label), description: option.description ? String(option.description) : undefined, icon: option.icon ? String(option.icon) : undefined, value: String(option.value), actionType: option.action_type as JourneyStep["options"] extends Array<infer T> ? T extends { actionType: infer A } ? A : never : never, targetStepId: option.target_step_id ? String(option.target_step_id) : undefined, actionPayload: option.action_payload as Record<string, string | number | boolean> })) : [];
    const definitions = Array.isArray(step.form_definitions) ? step.form_definitions as Array<Record<string, unknown>> : [];
    const fields = definitions.flatMap((definition) => Array.isArray(definition.form_fields) ? definition.form_fields as Array<Record<string, unknown>> : []).sort((a, b) => Number(a.field_order) - Number(b.field_order)).map((field) => ({ id: String(field.id), label: String(field.label), key: String(field.field_key), type: field.field_type as NonNullable<JourneyStep["formFields"]>[number]["type"], placeholder: field.placeholder ? String(field.placeholder) : undefined, required: Boolean(field.required), options: Array.isArray(field.options) ? field.options.map(String) : undefined }));
    const normalizedBlocks = Array.isArray(step.content_blocks) ? (step.content_blocks as Array<Record<string, unknown>>).sort((a, b) => Number(a.block_order) - Number(b.block_order)).map((block) => ({ id: String(block.id), type: block.block_type as NonNullable<JourneyStep["blocks"]>[number]["type"], content: block.content as Record<string, unknown>, ...(block.settings && typeof block.settings === "object" ? { variant: String((block.settings as Record<string, unknown>).variant || "") || undefined, style: (block.settings as Record<string, unknown>).style as Record<string, string | number | boolean> } : {}) })) : [];
    return { id: String(step.id), type: step.type as JourneyStep["type"], title: String(step.title), description: step.description ? String(step.description) : undefined, order: Number(step.step_order), isActive: Boolean(step.is_active), visualVariant: stepSettings.visualVariant ? String(stepSettings.visualVariant) : undefined, blocks: normalizedBlocks.length ? normalizedBlocks : stepSettings.blocks as JourneyStep["blocks"], recommendation: stepSettings.recommendation as JourneyStep["recommendation"], settings: stepSettings.stepSettings as Record<string, unknown>, options, formFields: fields };
  }).sort((a, b) => a.order - b.order);
  const profileRow = first(row.business_profiles as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const capabilities = Array.isArray(row.project_capabilities) ? (row.project_capabilities as Array<Record<string, unknown>>).map((item) => ({ key: item.capability_key, enabled: item.enabled, source: item.source, version: Number((item.settings as Record<string, unknown>)?.version || 1), configuration: item.settings || {} })) as Project["capabilities"] : undefined;
  const records = (key: string) => Array.isArray(row[key]) ? row[key] as Array<Record<string, unknown>> : [];
  const quoteRow = first(row.quote_definitions as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const quoteSettings = quoteRow?.settings && typeof quoteRow.settings === "object" ? quoteRow.settings as Record<string, unknown> : {};
  const commercialConfig: NonNullable<Project["commercialConfig"]> = {
    quoteDefinition: quoteRow ? { id: String(quoteRow.id), projectId: String(row.id), title: String(quoteRow.name), currency: String(quoteRow.currency), baseAmount: quoteRow.base_price == null ? undefined : Number(quoteRow.base_price), estimationMode: (quoteSettings.estimationMode || "range") as "exact" | "range" | "starting_at" | "manual", questions: Array.isArray(quoteSettings.questions) ? quoteSettings.questions as never[] : [], completionChannel: (quoteSettings.completionChannel || "native") as "native", isActive: Boolean(quoteRow.is_active), rules: (Array.isArray(quoteRow.quote_rules) ? quoteRow.quote_rules as Array<Record<string, unknown>> : []).sort((a, b) => Number(a.rule_order) - Number(b.rule_order)).map((rule) => ({ id: String(rule.id), condition: { field: String(rule.field_key), operator: rule.operator as "equals" | "contains" | "greater_than" | "less_than", value: rule.expected_value as string | number | boolean }, operation: rule.operation as "add" | "multiply" | "set" | "range", amount: rule.price_delta == null ? undefined : Number(rule.price_delta), minAmount: rule.min_delta == null ? undefined : Number(rule.min_delta), maxAmount: rule.max_delta == null ? undefined : Number(rule.max_delta) })) } : undefined,
    schedulableServices: records("schedulable_services").map((item) => ({ id: String(item.id), projectId: String(row.id), name: String(item.name), durationMinutes: Number(item.duration_minutes), bufferBeforeMinutes: Number(item.buffer_before_minutes), bufferAfterMinutes: Number(item.buffer_after_minutes), capacity: Number((item.settings as Record<string, unknown>)?.capacity || 1), confirmationMode: item.confirmation_mode as "instant" | "manual_approval" | "external_system", isActive: Boolean(item.is_active) })),
    resources: records("resources").map((item) => ({ id: String(item.id), projectId: String(row.id), name: String(item.name), kind: item.resource_type as "professional" | "room" | "asset", isActive: Boolean(item.is_active) })),
    availabilityRules: records("availability_rules").map((item) => ({ id: String(item.id), projectId: String(row.id), resourceId: item.resource_id ? String(item.resource_id) : undefined, weekday: Number(item.weekday), startTime: String(item.starts_at), endTime: String(item.ends_at), timezone: String(item.timezone) })),
    availabilityExceptions: records("availability_exceptions").map((item) => ({ id: String(item.id), projectId: String(row.id), resourceId: item.resource_id ? String(item.resource_id) : undefined, startsAt: String(item.starts_at), endsAt: String(item.ends_at), isAvailable: Boolean(item.is_available), reason: item.reason ? String(item.reason) : undefined })),
    catalogCategories: records("catalog_categories").map((item) => ({ id: String(item.id), projectId: String(row.id), name: String(item.name), order: Number(item.category_order), isActive: Boolean(item.is_active) })),
    catalogItems: records("catalog_items").map((item) => ({ id: String(item.id), projectId: String(row.id), categoryId: item.category_id ? String(item.category_id) : undefined, name: String(item.name), description: item.description ? String(item.description) : undefined, imageAssetId: item.image_asset_id ? String(item.image_asset_id) : undefined, price: item.price == null ? undefined : Number(item.price), currency: String(item.currency), isAvailable: Boolean(item.is_available), variants: Array.isArray(item.variants) ? item.variants as never[] : [], metadata: item.metadata as Record<string, unknown> || {} })),
    reservableUnits: records("reservable_units").map((item) => ({ id: String(item.id), projectId: String(row.id), name: String(item.name), description: item.description ? String(item.description) : undefined, capacityAdults: Number(item.capacity_adults), capacityChildren: Number(item.capacity_children), quantity: Number(item.quantity), basePrice: item.base_price == null ? undefined : Number(item.base_price), currency: String(item.currency), isActive: Boolean(item.is_active), mediaAssetIds: Array.isArray(item.media_asset_ids) ? item.media_asset_ids.map(String) : [], amenities: Array.isArray(item.amenities) ? item.amenities.map(String) : [] })),
    reservationBlocks: records("reservation_blocks").map((item) => ({ id: String(item.id), projectId: String(row.id), unitId: item.unit_id ? String(item.unit_id) : undefined, startsOn: String(item.starts_on), endsOn: String(item.ends_on), quantity: Number(item.quantity), reason: item.reason ? String(item.reason) : undefined })),
    routingDestinations: records("routing_destinations").map((item) => ({ id: String(item.id), key: String(item.id), type: item.channel === "whatsapp" ? "whatsapp" : item.channel === "url" ? "url" : "location", label: String(item.label), value: String(item.value) })),
    routingRules: records("routing_rules").map((item) => ({ id: String(item.id), projectId: String(row.id), destinationId: String(item.destination_id), priority: Number(item.priority), condition: (Array.isArray(item.conditions) ? item.conditions[0] : {}) as NonNullable<NonNullable<Project["commercialConfig"]>["routingRules"]>[number]["condition"], isActive: Boolean(item.is_active) })),
  };
  return { id: String(row.id), workspaceId: String(row.workspace_id), name: String(row.name), slug: String(row.slug), description: String(row.description || ""), subtitle: String(settings.subtitle || ""), status: row.status as Project["status"], primaryGoal: String(row.primary_goal || ""), primaryDestination: String(settings.primaryDestination || "WhatsApp"), category: row.category ? String(row.category) : undefined, audience: settings.audience ? String(settings.audience) : undefined, phone: settings.phone ? String(settings.phone) : undefined, visualDirection: String(settings.visualDirection || "Equilibrada"), designSystem, brand, steps, businessProfile: profileRow?.signals as Project["businessProfile"], capabilities, commercialConfig, version: Number(settings.version || 1), createdAt: String(row.created_at), updatedAt: String(row.updated_at), publishedAt: row.published_at ? String(row.published_at) : undefined };
}

export async function getPublishedProject(supabase: SupabaseClient, column: "id" | "slug", value: string): Promise<Project | null> {
  const { data, error } = await supabase.from("projects").select(projectSelect).eq(column, value).eq("status", "published").maybeSingle();
  if (error || !data) return null;
  return fromRow(data as unknown as Record<string, unknown>);
}

export async function getPublishedProjectBySlug(supabase: SupabaseClient, slug: string): Promise<Project | null> {
  return getPublishedProject(supabase, "slug", slug);
}
