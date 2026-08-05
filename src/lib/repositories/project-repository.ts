"use client";

import { localStore } from "@/lib/local-store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { canUseLocalStore } from "@/lib/runtime-mode";
import type { FormField, JourneyStep, Project, StepOption } from "@/types";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function uuid() { return crypto.randomUUID(); }

function normalizeIds(project: Project): Project {
  if (isUuid(project.id) && project.steps.every((step) => isUuid(step.id))) return project;
  const projectId = isUuid(project.id) ? project.id : uuid();
  const stepIds = new Map(project.steps.map((step) => [step.id, isUuid(step.id) ? step.id : uuid()]));
  const steps = project.steps.map((step): JourneyStep => ({
    ...step,
    id: stepIds.get(step.id)!,
    options: step.options?.map((option): StepOption => ({ ...option, id: isUuid(option.id) ? option.id : uuid(), targetStepId: option.targetStepId ? stepIds.get(option.targetStepId) || option.targetStepId : undefined })),
    formFields: step.formFields?.map((field): FormField => ({ ...field, id: isUuid(field.id) ? field.id : uuid() })),
    blocks: step.blocks?.map((block) => ({ ...block, id: isUuid(block.id) ? block.id : uuid() })),
  }));
  const commercialConfig = project.commercialConfig ? structuredClone(project.commercialConfig) : undefined;
  if (commercialConfig) {
    for (const rule of commercialConfig.qualificationRules || []) { rule.id = isUuid(rule.id) ? rule.id : uuid(); rule.projectId = projectId; }
    if (commercialConfig.quoteDefinition) { commercialConfig.quoteDefinition.id = isUuid(commercialConfig.quoteDefinition.id) ? commercialConfig.quoteDefinition.id : uuid(); commercialConfig.quoteDefinition.projectId = projectId; }
    for (const collection of [commercialConfig.serviceOfferings, commercialConfig.schedulableServices, commercialConfig.resources, commercialConfig.availabilityRules, commercialConfig.availabilityExceptions, commercialConfig.catalogCategories, commercialConfig.catalogItems, commercialConfig.reservableUnits, commercialConfig.reservationBlocks, commercialConfig.locations, commercialConfig.routingRules, commercialConfig.policies]) {
      for (const item of collection || []) { item.id = isUuid(item.id) ? item.id : uuid(); item.projectId = projectId; }
    }
    for (const rule of commercialConfig.quoteDefinition?.rules || []) rule.id = isUuid(rule.id) ? rule.id : uuid();
    for (const destination of commercialConfig.routingDestinations || []) destination.id = isUuid(destination.id) ? destination.id : uuid();
  }
  return { ...project, id: projectId, steps, commercialConfig };
}

function projectPayload(row: { settings?: unknown }) {
  if (!row.settings || typeof row.settings !== "object") return null;
  const payload = (row.settings as Record<string, unknown>).projectPayload;
  return payload && typeof payload === "object" ? payload as Project : null;
}

async function workspaceId() {
  const supabase = createClient();
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  return data?.workspace_id || null;
}

async function saveNormalized(project: Project) {
  const supabase = createClient();
  const workspace = await workspaceId();
  if (!supabase || !workspace) return null;
  const normalized = normalizeIds({ ...project, workspaceId: workspace });
  const { data: existingProject } = await supabase
    .from("projects")
    .select("settings")
    .eq("id", normalized.id)
    .maybeSingle();
  const existingSettings = existingProject?.settings && typeof existingProject.settings === "object"
    ? existingProject.settings as Record<string, unknown>
    : {};
  const settings = {
    ...existingSettings,
    subtitle: normalized.subtitle,
    primaryDestination: normalized.primaryDestination,
    audience: normalized.audience,
    phone: normalized.phone,
    visualDirection: normalized.visualDirection,
    version: normalized.version,
    projectPayload: normalized,
  };
  const { error: projectError } = await supabase.from("projects").upsert({
    id: normalized.id,
    workspace_id: workspace,
    name: normalized.name,
    slug: normalized.slug,
    description: normalized.description,
    status: normalized.status,
    primary_goal: normalized.primaryGoal,
    category: normalized.category || null,
    theme: normalized.designSystem,
    settings,
    published_at: normalized.publishedAt || null,
  });
  if (projectError) throw new Error(projectError.message);

  const { error: brandError } = await supabase.from("brand_profiles").upsert({
    project_id: normalized.id,
    primary_logo_asset_id: normalized.brand.primaryLogoAssetId || null,
    light_logo_asset_id: normalized.brand.lightLogoAssetId || null,
    dark_logo_asset_id: normalized.brand.darkLogoAssetId || null,
    favicon_asset_id: normalized.brand.faviconAssetId || null,
    extracted_colors: normalized.brand.extractedColors,
    active_palette: normalized.brand.activePalette,
    palette_variations: normalized.brand.paletteVariations,
    design_system: normalized.designSystem,
    brand_personality: normalized.brand.brandPersonality,
    analysis_metadata: normalized.brand.analysisMetadata || {},
    analyzed_at: new Date().toISOString(),
  }, { onConflict: "project_id" });
  if (brandError) throw new Error(brandError.message);

  const { error: deleteError } = await supabase.from("journey_steps").delete().eq("project_id", normalized.id);
  if (deleteError) throw new Error(deleteError.message);
  const { error: stepsError } = await supabase.from("journey_steps").insert(normalized.steps.map((step) => ({
    id: step.id,
    project_id: normalized.id,
    type: step.type,
    title: step.title,
    description: step.description || null,
    step_order: step.order,
    is_active: step.isActive,
    settings: { visualVariant: step.visualVariant, blocks: step.blocks || [], recommendation: step.recommendation, stepSettings: step.settings || {} },
  })));
  if (stepsError) throw new Error(stepsError.message);

  const optionRows = normalized.steps.flatMap((step) => (step.options || []).map((option, optionOrder) => ({
    id: option.id, step_id: step.id, label: option.label, description: option.description || null, icon: option.icon || null, value: option.value, option_order: optionOrder,
    action_type: option.actionType, target_step_id: option.targetStepId || null, action_payload: option.actionPayload || {},
  })));
  if (optionRows.length) {
    const { error } = await supabase.from("step_options").insert(optionRows);
    if (error) throw new Error(error.message);
  }

  for (const step of normalized.steps.filter((candidate) => candidate.formFields?.length)) {
    const formId = uuid();
    const { error: formError } = await supabase.from("form_definitions").insert({ id: formId, project_id: normalized.id, step_id: step.id, name: step.title, submit_label: step.options?.[0]?.label || "Continuar" });
    if (formError) throw new Error(formError.message);
    const { error: fieldsError } = await supabase.from("form_fields").insert((step.formFields || []).map((field, fieldOrder) => ({
      id: field.id, form_id: formId, label: field.label, field_key: field.key, field_type: field.type, placeholder: field.placeholder || null, required: field.required, field_order: fieldOrder, options: field.options || [],
    })));
    if (fieldsError) throw new Error(fieldsError.message);
  }

  if (normalized.businessProfile) {
    const profile = normalized.businessProfile;
    const { error } = await supabase.from("business_profiles").upsert({
      project_id: normalized.id, business_name: normalized.name, description: normalized.description,
      website_url: null, category: normalized.category || null, audience: normalized.audience || null,
      offer_kinds: profile.offerKinds, primary_intents: profile.primaryIntents,
      confirmation_mode: profile.confirmationMode, capacity_kinds: profile.capacityKinds,
      completion_channel: profile.completionChannel, completion_destination: normalized.primaryDestination,
      whatsapp_phone: normalized.phone || null, signals: profile,
      source: profile.analysisMetadata?.source || "user",
    }, { onConflict: "project_id" });
    if (error) throw new Error(error.message);
  }

  if (normalized.capabilities?.length) {
    const { error } = await supabase.from("project_capabilities").upsert(normalized.capabilities.map((capability) => ({
      project_id: normalized.id, capability_key: capability.key, enabled: capability.enabled,
      source: capability.source, settings: { ...capability.configuration, version: capability.version },
    })), { onConflict: "project_id,capability_key" });
    if (error) throw new Error(error.message);
  }

  if (normalized.dataRequirements?.length) {
    const { error } = await supabase.from("project_data_requirements").upsert(normalized.dataRequirements.map((requirement) => ({
      project_id: normalized.id,
      requirement_key: requirement.key,
      label: requirement.label,
      capability_key: requirement.capability,
      status: requirement.status,
      severity: requirement.severity,
      value: requirement.value ?? null,
      origin: requirement.origin || null,
      source_id: requirement.sourceId || null,
      field_metadata: requirement.fieldMetadata || {},
      reason: requirement.reason,
    })), { onConflict: "project_id,requirement_key" });
    if (error) throw new Error(error.message);
  }

  const blockRows = normalized.steps.flatMap((step) => (step.blocks || []).map((block, blockOrder) => ({
    id: block.id, project_id: normalized.id, step_id: step.id, block_type: block.type,
    block_order: blockOrder, content: block.content || {}, settings: { variant: block.variant, style: block.style || {} },
  })));
  if (blockRows.length) {
    const { error } = await supabase.from("content_blocks").insert(blockRows);
    if (error) throw new Error(error.message);
  }

  const config = normalized.commercialConfig;
  if (config?.serviceOfferings?.length) {
    const { error } = await supabase.from("service_offerings").upsert(config.serviceOfferings.map((service) => ({
      id: service.id, project_id: normalized.id, name: service.name, slug: service.slug,
      description: service.description || null, short_description: service.shortDescription || null,
      service_mode: service.serviceMode, price_mode: service.priceMode, price: service.price ?? null,
      min_price: service.minPrice ?? null, max_price: service.maxPrice ?? null, currency: service.currency,
      image_asset_id: service.imageAssetId || null, destination_id: service.destinationId || null,
      external_url: service.externalUrl || null, is_featured: service.isFeatured, is_active: service.isActive,
      service_order: service.order, settings: service.settings,
    })));
    if (error) throw new Error(error.message);
  }
  if (config?.quoteDefinition) {
    const definition = config.quoteDefinition;
    const { error } = await supabase.from("quote_definitions").upsert({
      id: definition.id, project_id: normalized.id, name: definition.title, currency: definition.currency,
      base_price: definition.baseAmount || null, is_active: definition.isActive,
      settings: { estimationMode: definition.estimationMode, questions: definition.questions, completionChannel: definition.completionChannel },
    }, { onConflict: "project_id" });
    if (error) throw new Error(error.message);
    await supabase.from("quote_rules").delete().eq("quote_definition_id", definition.id);
    if (definition.rules.length) {
      const { error: rulesError } = await supabase.from("quote_rules").insert(definition.rules.map((rule, ruleOrder) => ({
        id: rule.id, quote_definition_id: definition.id, field_key: rule.condition.field,
        operator: rule.condition.operator, expected_value: rule.condition.value,
        operation: rule.operation, price_delta: rule.amount || 0, min_delta: rule.minAmount || null,
        max_delta: rule.maxAmount || null, rule_order: ruleOrder,
      })));
      if (rulesError) throw new Error(rulesError.message);
    }
  }

  if (config?.schedulableServices?.length) {
    const { error } = await supabase.from("schedulable_services").upsert(config.schedulableServices.map((service) => ({
      id: service.id, project_id: normalized.id, service_offering_id: service.serviceOfferingId || null, name: service.name, duration_minutes: service.durationMinutes,
      buffer_before_minutes: service.bufferBeforeMinutes, buffer_after_minutes: service.bufferAfterMinutes,
      confirmation_mode: service.confirmationMode, is_active: service.isActive, settings: { capacity: service.capacity },
    })));
    if (error) throw new Error(error.message);
  }
  if (config?.resources?.length) {
    const { error } = await supabase.from("resources").upsert(config.resources.map((resource) => ({
      id: resource.id, project_id: normalized.id, name: resource.name, resource_type: resource.kind, is_active: resource.isActive,
    })));
    if (error) throw new Error(error.message);
  }
  if (config?.availabilityRules?.length) {
    const { error } = await supabase.from("availability_rules").upsert(config.availabilityRules.map((rule) => ({
      id: rule.id, project_id: normalized.id, resource_id: rule.resourceId || null, weekday: rule.weekday,
      starts_at: rule.startTime, ends_at: rule.endTime, timezone: rule.timezone, is_active: true,
    })));
    if (error) throw new Error(error.message);
  }
  if (config?.availabilityExceptions?.length) {
    const { error } = await supabase.from("availability_exceptions").upsert(config.availabilityExceptions.map((exception) => ({
      id: exception.id, project_id: normalized.id, resource_id: exception.resourceId || null,
      starts_at: exception.startsAt, ends_at: exception.endsAt, is_available: exception.isAvailable, reason: exception.reason || null,
    })));
    if (error) throw new Error(error.message);
  }
  if (config?.catalogCategories?.length) {
    const { error } = await supabase.from("catalog_categories").upsert(config.catalogCategories.map((category) => ({
      id: category.id, project_id: normalized.id, name: category.name, category_order: category.order, is_active: category.isActive,
    })));
    if (error) throw new Error(error.message);
  }
  if (config?.catalogItems?.length) {
    const { error } = await supabase.from("catalog_items").upsert(config.catalogItems.map((item) => ({
      id: item.id, project_id: normalized.id, category_id: item.categoryId || null, name: item.name,
      description: item.description || null, image_asset_id: item.imageAssetId || null, price: item.price || null,
      currency: item.currency, is_available: item.isAvailable, variants: item.variants, metadata: item.metadata,
    })));
    if (error) throw new Error(error.message);
  }
  if (config?.reservableUnits?.length) {
    const { error } = await supabase.from("reservable_units").upsert(config.reservableUnits.map((unit) => ({
      id: unit.id, project_id: normalized.id, name: unit.name, description: unit.description || null,
      capacity_adults: unit.capacityAdults, capacity_children: unit.capacityChildren, quantity: unit.quantity,
      base_price: unit.basePrice || null, currency: unit.currency, is_active: unit.isActive,
      media_asset_ids: unit.mediaAssetIds, amenities: unit.amenities,
      settings: { depositAmount: unit.depositAmount, confirmationMode: unit.confirmationMode, rules: unit.rules },
    })));
    if (error) throw new Error(error.message);
  }
  if (config?.reservationBlocks?.length) {
    const { error } = await supabase.from("reservation_blocks").upsert(config.reservationBlocks.map((block) => ({
      id: block.id, project_id: normalized.id, unit_id: block.unitId || null, starts_on: block.startsOn,
      ends_on: block.endsOn, quantity: block.quantity, reason: block.reason || null,
    })));
    if (error) throw new Error(error.message);
  }
  // Destinos precisam existir antes das unidades por causa da chave estrangeira.
  if (config?.locations?.length && config.routingDestinations?.length) {
    const { error } = await supabase.from("routing_destinations").upsert(config.routingDestinations.map((destination) => ({
      id: destination.id, project_id: normalized.id, label: destination.label,
      channel: destination.type === "whatsapp" ? "whatsapp" : destination.type === "email" ? "email" : destination.type === "phone" ? "phone" : ["url", "checkout", "schedule", "form"].includes(destination.type) ? "url" : "internal",
      value: destination.value || destination.key, is_active: true, settings: { message: destination.message },
    })));
    if (error) throw new Error(error.message);
  }
  if (config?.locations?.length) {
    const { error } = await supabase.from("business_locations").upsert(config.locations.map((location) => ({
      id: location.id, project_id: normalized.id, name: location.name,
      address_line: location.addressLine || location.address || null, address_number: location.addressNumber || null,
      address_extra: location.addressExtra || null, neighborhood: location.neighborhood || null,
      city: location.city || null, state: location.state || null, postal_code: location.postalCode || null,
      country_code: location.countryCode, latitude: location.latitude ?? null, longitude: location.longitude ?? null,
      geocoding_status: location.geocodingStatus, geocoding_provider: location.geocodingProvider || null,
      geocoded_at: location.geocodedAt || null, phone: location.phone || null, whatsapp: location.whatsapp || null,
      external_url: location.externalUrl || null, timezone: location.timezone, opening_hours: location.openingHours,
      service_radius_km: location.serviceRadiusKm ?? null, delivery_radius_km: location.deliveryRadiusKm ?? null,
      supports_delivery: location.supportsDelivery, supports_pickup: location.supportsPickup,
      supports_in_person: location.supportsInPerson, priority: location.priority, is_active: location.isActive,
      routing_destination_id: location.routingDestinationId || null, settings: location.settings || {},
    })));
    if (error) throw new Error(error.message);
  }
  if (config?.routingDestinations?.length) {
    const { error } = await supabase.from("routing_destinations").upsert(config.routingDestinations.map((destination) => ({
      id: destination.id, project_id: normalized.id, label: destination.label,
      channel: destination.type === "whatsapp" ? "whatsapp" : destination.type === "email" ? "email" : destination.type === "phone" ? "phone" : ["url", "checkout", "schedule", "form"].includes(destination.type) ? "url" : "internal",
      value: destination.value || destination.key, is_active: true, settings: { message: destination.message },
    })));
    if (error) throw new Error(error.message);
  }
  if (config?.routingRules?.length) {
    const { error } = await supabase.from("routing_rules").upsert(config.routingRules.map((rule) => ({
      id: rule.id, project_id: normalized.id, destination_id: rule.destinationId,
      conditions: [rule.condition], priority: rule.priority, is_active: rule.isActive,
    })));
    if (error) throw new Error(error.message);
  }
  if (config?.policies?.length) {
    const { error } = await supabase.from("project_policies").upsert(config.policies.map((policy) => ({
      id: policy.id, project_id: normalized.id, policy_type: policy.type, title: policy.title,
      content: policy.content, is_active: policy.isActive, settings: policy.settings,
    })), { onConflict: "project_id,policy_type" });
    if (error) throw new Error(error.message);
  }
  return normalized;
}

export const projectRepository = {
  async getProjects(): Promise<Project[]> {
    if (!isSupabaseConfigured()) return canUseLocalStore() ? localStore.getProjects() : [];
    const supabase = createClient();
    if (!supabase) return canUseLocalStore() ? localStore.getProjects() : [];
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return canUseLocalStore() ? localStore.getProjects() : [];
    const { data, error } = await supabase.from("projects").select("settings").order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(projectPayload).filter((project): project is Project => Boolean(project));
  },
  async getProject(value: string): Promise<Project | undefined> {
    if (!isSupabaseConfigured()) return canUseLocalStore() ? localStore.getProject(value) : undefined;
    const supabase = createClient();
    if (!supabase) return canUseLocalStore() ? localStore.getProject(value) : undefined;
    const column = isUuid(value) ? "id" : "slug";
    const { data, error } = await supabase.from("projects").select("settings").eq(column, value).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? projectPayload(data) || undefined : undefined;
  },
  async saveProject(project: Project): Promise<Project> {
    if (!isSupabaseConfigured() && !canUseLocalStore()) throw new Error("Persistência indisponível. Configure o Supabase.");
    const local = canUseLocalStore() ? localStore.saveProject(project) : project;
    if (!isSupabaseConfigured()) return local;
    const remote = await saveNormalized(local);
    if (!remote) throw new Error("Faça login para salvar o projeto.");
    if (canUseLocalStore() && remote.id !== local.id) localStore.deleteProject(local.id);
    return localStore.saveProject(remote);
  },
  async deleteProject(id: string) {
    if (canUseLocalStore()) localStore.deleteProject(id);
    if (!isSupabaseConfigured() || !isUuid(id)) {
      if (!canUseLocalStore()) throw new Error("Persistência indisponível. Configure o Supabase.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
