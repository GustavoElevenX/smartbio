import type { SupabaseClient } from "@supabase/supabase-js";
import { isWorkspacePublicAccessActive } from "@/server/entitlements/trial-service";
import { buildPalette } from "@/features/brand-intelligence/colors";
import type {
  BrandProfile,
  JourneyStep,
  Project,
  ProjectDesignSystem,
} from "@/types";
import type { PresencePage } from "@/features/presence/presence.types";

export const projectAggregateSelect = `
  id,workspace_id,name,slug,description,status,primary_goal,category,theme,settings,published_version_id,published_at,created_at,updated_at,
  brand_profiles(primary_logo_asset_id,light_logo_asset_id,dark_logo_asset_id,favicon_asset_id,extracted_colors,active_palette,palette_variations,design_system,brand_personality,analysis_metadata),
  business_profiles(signals),project_capabilities(capability_key,enabled,source,settings),
  project_data_requirements(id,requirement_key,label,capability_key,status,severity,value,origin,source_id,field_metadata,reason),
  conversion_goals(id,name,description,goal_kind,target_step_id,destination_label,is_primary,is_active,goal_order,created_at,updated_at),
  entry_points(id,entry_key,name,conversion_goal_id,target_step_id,surface_mode,presence_page_id,channel,utm_source,utm_medium,utm_campaign,utm_content,utm_term,is_active,created_at,updated_at),
  presence_pages(id,page_key,name,page_type,path,title,description,seo_title,seo_description,og_image_asset_id,default_conversion_goal_id,is_home,is_active,is_indexable,version,settings,created_at,updated_at,
    presence_sections(id,section_key,section_type,anchor,title,eyebrow,description,content,style,settings,section_order,is_active,created_at,updated_at)
  ),
  media_assets(id,workspace_id,project_id,storage_path,original_filename,mime_type,file_size,width,height,duration_seconds,asset_type,status,alt_text,tags,metadata,created_at,updated_at),
  service_offerings(id,name,slug,description,short_description,service_mode,price_mode,price,min_price,max_price,currency,image_asset_id,destination_id,external_url,is_featured,is_active,service_order,settings),
  quote_definitions(id,name,currency,base_price,is_active,settings,quote_questions(id,field_key,label,field_type,required,options,question_order,settings),quote_rules(id,field_key,operator,expected_value,operation,price_delta,min_delta,max_delta,rule_order)),
  schedulable_services(id,service_offering_id,name,duration_minutes,buffer_before_minutes,buffer_after_minutes,confirmation_mode,is_active,settings),
  resources(id,name,resource_type,is_active),availability_rules(id,resource_id,weekday,starts_at,ends_at,timezone),availability_exceptions(id,resource_id,starts_at,ends_at,is_available,reason),
  catalog_categories(id,name,category_order,is_active),catalog_items(id,category_id,name,description,image_asset_id,price,currency,is_available,variants,metadata),
  reservable_units(id,name,description,capacity_adults,capacity_children,quantity,base_price,currency,is_active,media_asset_ids,amenities),reservation_blocks(id,unit_id,starts_on,ends_on,quantity,reason),
  routing_destinations(id,label,channel,value,is_active,settings),routing_rules(id,destination_id,conditions,priority,is_active),
  business_locations(id,name,address_line,address_number,address_extra,neighborhood,city,state,postal_code,country_code,latitude,longitude,geocoding_status,geocoding_provider,geocoded_at,phone,whatsapp,external_url,timezone,opening_hours,service_radius_km,delivery_radius_km,supports_delivery,supports_pickup,supports_in_person,priority,is_active,routing_destination_id,settings),
  project_policies(id,policy_type,title,content,is_active,settings),
  journey_steps(id,type,title,description,step_order,is_active,settings,
    content_blocks(id,block_type,block_order,content,settings),
    step_options!step_options_step_id_fkey(id,label,description,icon,value,option_order,action_type,target_step_id,conversion_goal_id,action_payload),
    form_definitions(form_fields(id,label,field_key,field_type,placeholder,required,field_order,options))
  )`;

function first<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value || undefined;
}

function fallbackDesign(
  colors: ReturnType<typeof buildPalette>,
): ProjectDesignSystem {
  return {
    mode: "light",
    colors,
    typography: {
      headingFont: "Manrope",
      bodyFont: "Inter",
      headingWeight: 800,
      bodyWeight: 450,
      scale: "expressive",
    },
    shape: {
      cardRadius: 22,
      buttonRadius: 16,
      inputRadius: 14,
      borderWidth: 1,
    },
    elevation: {
      cardShadow: "0 18px 44px rgba(28,25,50,.1)",
      floatingShadow: "0 30px 80px rgba(20,18,40,.18)",
      glowColor: colors.primary,
      glowIntensity: 0.1,
    },
    spacing: { density: "balanced", sectionGap: 28, cardGap: 12 },
    imagery: { decorativeStyle: "soft-orbs", overlayOpacity: 0.12 },
    motion: { transition: "slide", duration: 280, cardHover: true },
    buttons: { style: "solid", height: "large", iconPosition: "right" },
    cards: { style: "elevated", borderColor: colors.border, surfaceOpacity: 1 },
  };
}

export function projectFromNormalizedRow(
  row: Record<string, unknown>,
): Project | null {
  const settings =
    row.settings && typeof row.settings === "object"
      ? (row.settings as Record<string, unknown>)
      : {};
  const draftPayload =
    settings.projectPayload && typeof settings.projectPayload === "object"
      ? (settings.projectPayload as Project)
      : null;
  const brandRow = first(
    row.brand_profiles as
      Record<string, unknown> | Record<string, unknown>[] | undefined,
  );
  const extracted = Array.isArray(brandRow?.extracted_colors)
    ? brandRow.extracted_colors.map(String)
    : ["#0054FC", "#0186FC", "#01D2DF", "#02E5CD"];
  const colors = {
    ...buildPalette(extracted),
    ...((brandRow?.active_palette as object) || {}),
  };
  const brand: BrandProfile = {
    primaryLogoAssetId: brandRow?.primary_logo_asset_id ? String(brandRow.primary_logo_asset_id) : undefined,
    lightLogoAssetId: brandRow?.light_logo_asset_id ? String(brandRow.light_logo_asset_id) : undefined,
    darkLogoAssetId: brandRow?.dark_logo_asset_id ? String(brandRow.dark_logo_asset_id) : undefined,
    faviconAssetId: brandRow?.favicon_asset_id ? String(brandRow.favicon_asset_id) : undefined,
    extractedColors: extracted,
    activePalette: colors,
    paletteVariations: Array.isArray(brandRow?.palette_variations)
      ? (brandRow.palette_variations as BrandProfile["paletteVariations"])
      : [],
    brandPersonality: Array.isArray(brandRow?.brand_personality)
      ? brandRow.brand_personality.map(String)
      : ["Equilibrada"],
    analysisMetadata:
      brandRow?.analysis_metadata as BrandProfile["analysisMetadata"],
  };
  const theme =
    row.theme && typeof row.theme === "object"
      ? (row.theme as Partial<ProjectDesignSystem>)
      : {};
  const designSystem: ProjectDesignSystem = {
    ...fallbackDesign(colors),
    ...theme,
    colors: { ...colors, ...(theme.colors || {}) },
  };
  const stepRows = Array.isArray(row.journey_steps)
    ? (row.journey_steps as Array<Record<string, unknown>>)
    : [];
  const steps: JourneyStep[] = stepRows
    .map((step) => {
      const stepSettings =
        step.settings && typeof step.settings === "object"
          ? (step.settings as Record<string, unknown>)
          : {};
      const options = Array.isArray(step.step_options)
        ? (step.step_options as Array<Record<string, unknown>>)
            .sort((a, b) => Number(a.option_order) - Number(b.option_order))
            .map((option) => ({
              id: String(option.id),
              label: String(option.label),
              description: option.description
                ? String(option.description)
                : undefined,
              icon: option.icon ? String(option.icon) : undefined,
              value: String(option.value),
              actionType:
                option.action_type as JourneyStep["options"] extends Array<
                  infer T
                >
                  ? T extends { actionType: infer A }
                    ? A
                    : never
                  : never,
              targetStepId: option.target_step_id
                ? String(option.target_step_id)
                : undefined,
              conversionGoalId: option.conversion_goal_id
                ? String(option.conversion_goal_id)
                : undefined,
              actionPayload: option.action_payload as Record<
                string,
                string | number | boolean
              >,
            }))
        : [];
      const definitions = Array.isArray(step.form_definitions)
        ? (step.form_definitions as Array<Record<string, unknown>>)
        : [];
      const fields = definitions
        .flatMap((definition) =>
          Array.isArray(definition.form_fields)
            ? (definition.form_fields as Array<Record<string, unknown>>)
            : [],
        )
        .sort((a, b) => Number(a.field_order) - Number(b.field_order))
        .map((field) => ({
          id: String(field.id),
          label: String(field.label),
          key: String(field.field_key),
          type: field.field_type as NonNullable<
            JourneyStep["formFields"]
          >[number]["type"],
          placeholder: field.placeholder
            ? String(field.placeholder)
            : undefined,
          required: Boolean(field.required),
          options: Array.isArray(field.options)
            ? field.options.map(String)
            : undefined,
        }));
      const normalizedBlocks = Array.isArray(step.content_blocks)
        ? (step.content_blocks as Array<Record<string, unknown>>)
            .sort((a, b) => Number(a.block_order) - Number(b.block_order))
            .map((block) => ({
              id: String(block.id),
              type: block.block_type as NonNullable<
                JourneyStep["blocks"]
              >[number]["type"],
              content: block.content as Record<string, unknown>,
              ...(block.settings && typeof block.settings === "object"
                ? {
                    variant:
                      String(
                        (block.settings as Record<string, unknown>).variant ||
                          "",
                      ) || undefined,
                    style: (block.settings as Record<string, unknown>)
                      .style as Record<string, string | number | boolean>,
                  }
                : {}),
            }))
        : [];
      return {
        id: String(step.id),
        type: step.type as JourneyStep["type"],
        title: String(step.title),
        description: step.description ? String(step.description) : undefined,
        order: Number(step.step_order),
        isActive: Boolean(step.is_active),
        visualVariant: stepSettings.visualVariant
          ? String(stepSettings.visualVariant)
          : undefined,
        blocks: normalizedBlocks.length
          ? normalizedBlocks
          : (stepSettings.blocks as JourneyStep["blocks"]),
        recommendation:
          stepSettings.recommendation as JourneyStep["recommendation"],
        settings: stepSettings.stepSettings as Record<string, unknown>,
        options,
        formFields: fields,
      };
    })
    .sort((a, b) => a.order - b.order);
  const profileRow = first(
    row.business_profiles as
      Record<string, unknown> | Record<string, unknown>[] | undefined,
  );
  const capabilities = Array.isArray(row.project_capabilities)
    ? ((row.project_capabilities as Array<Record<string, unknown>>).map(
        (item) => ({
          key: item.capability_key,
          enabled: item.enabled,
          source: item.source,
          version: Number(
            (item.settings as Record<string, unknown>)?.version || 1,
          ),
          configuration: item.settings || {},
        }),
      ) as Project["capabilities"])
    : undefined;
  const records = (key: string) =>
    Array.isArray(row[key]) ? (row[key] as Array<Record<string, unknown>>) : [];
  const quoteRow = first(
    row.quote_definitions as
      Record<string, unknown> | Record<string, unknown>[] | undefined,
  );
  const quoteSettings =
    quoteRow?.settings && typeof quoteRow.settings === "object"
      ? (quoteRow.settings as Record<string, unknown>)
      : {};
  const commercialConfig: NonNullable<Project["commercialConfig"]> = {
    serviceOfferings: records("service_offerings").map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      name: String(item.name),
      slug: String(item.slug),
      description: item.description ? String(item.description) : undefined,
      shortDescription: item.short_description
        ? String(item.short_description)
        : undefined,
      serviceMode: item.service_mode as
        "contact" | "quote" | "schedule" | "external_checkout" | "external_url",
      priceMode: item.price_mode as
        "fixed" | "starting_at" | "range" | "on_request" | "free",
      price: item.price == null ? undefined : Number(item.price),
      minPrice: item.min_price == null ? undefined : Number(item.min_price),
      maxPrice: item.max_price == null ? undefined : Number(item.max_price),
      currency: String(item.currency),
      imageAssetId: item.image_asset_id
        ? String(item.image_asset_id)
        : undefined,
      destinationId: item.destination_id
        ? String(item.destination_id)
        : undefined,
      externalUrl: item.external_url ? String(item.external_url) : undefined,
      isFeatured: Boolean(item.is_featured),
      isActive: Boolean(item.is_active),
      order: Number(item.service_order),
      settings: (item.settings as Record<string, unknown>) || {},
    })),
    quoteDefinition: quoteRow
      ? {
          id: String(quoteRow.id),
          projectId: String(row.id),
          title: String(quoteRow.name),
          currency: String(quoteRow.currency),
          baseAmount:
            quoteRow.base_price == null
              ? undefined
              : Number(quoteRow.base_price),
          estimationMode: (quoteSettings.estimationMode || "range") as
            "exact" | "range" | "starting_at" | "manual",
          questions: (Array.isArray(quoteRow.quote_questions)
            ? (quoteRow.quote_questions as Array<Record<string, unknown>>)
            : []
          )
            .sort((a, b) => Number(a.question_order) - Number(b.question_order))
            .map((question) => ({
              id: String(question.id),
              key: String(question.field_key),
              label: String(question.label),
              type: question.field_type as never,
              required: Boolean(question.required),
              placeholder:
                question.settings && typeof question.settings === "object"
                  ? String(
                      (question.settings as Record<string, unknown>)
                        .placeholder || "",
                    ) || undefined
                  : undefined,
              options: Array.isArray(question.options)
                ? question.options.map(String)
                : undefined,
            })),
          completionChannel: (quoteSettings.completionChannel ||
            "native") as "native",
          isActive: Boolean(quoteRow.is_active),
          rules: (Array.isArray(quoteRow.quote_rules)
            ? (quoteRow.quote_rules as Array<Record<string, unknown>>)
            : []
          )
            .sort((a, b) => Number(a.rule_order) - Number(b.rule_order))
            .map((rule) => ({
              id: String(rule.id),
              condition: {
                field: String(rule.field_key),
                operator: rule.operator as
                  "equals" | "contains" | "greater_than" | "less_than",
                value: rule.expected_value as string | number | boolean,
              },
              operation: rule.operation as "add" | "multiply" | "set" | "range",
              amount:
                rule.price_delta == null ? undefined : Number(rule.price_delta),
              minAmount:
                rule.min_delta == null ? undefined : Number(rule.min_delta),
              maxAmount:
                rule.max_delta == null ? undefined : Number(rule.max_delta),
            })),
        }
      : undefined,
    schedulableServices: records("schedulable_services").map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      serviceOfferingId: item.service_offering_id
        ? String(item.service_offering_id)
        : undefined,
      name: String(item.name),
      durationMinutes: Number(item.duration_minutes),
      bufferBeforeMinutes: Number(item.buffer_before_minutes),
      bufferAfterMinutes: Number(item.buffer_after_minutes),
      capacity: Number(
        (item.settings as Record<string, unknown>)?.capacity || 1,
      ),
      confirmationMode: item.confirmation_mode as
        "instant" | "manual_approval" | "external_system",
      isActive: Boolean(item.is_active),
    })),
    resources: records("resources").map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      name: String(item.name),
      kind: item.resource_type as "professional" | "room" | "asset",
      isActive: Boolean(item.is_active),
    })),
    availabilityRules: records("availability_rules").map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      resourceId: item.resource_id ? String(item.resource_id) : undefined,
      weekday: Number(item.weekday),
      startTime: String(item.starts_at),
      endTime: String(item.ends_at),
      timezone: String(item.timezone),
    })),
    availabilityExceptions: records("availability_exceptions").map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      resourceId: item.resource_id ? String(item.resource_id) : undefined,
      startsAt: String(item.starts_at),
      endsAt: String(item.ends_at),
      isAvailable: Boolean(item.is_available),
      reason: item.reason ? String(item.reason) : undefined,
    })),
    catalogCategories: records("catalog_categories").map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      name: String(item.name),
      order: Number(item.category_order),
      isActive: Boolean(item.is_active),
    })),
    catalogItems: records("catalog_items").map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      categoryId: item.category_id ? String(item.category_id) : undefined,
      name: String(item.name),
      description: item.description ? String(item.description) : undefined,
      imageAssetId: item.image_asset_id
        ? String(item.image_asset_id)
        : undefined,
      price: item.price == null ? undefined : Number(item.price),
      currency: String(item.currency),
      isAvailable: Boolean(item.is_available),
      variants: Array.isArray(item.variants) ? (item.variants as never[]) : [],
      metadata: (item.metadata as Record<string, unknown>) || {},
    })),
    reservableUnits: records("reservable_units").map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      name: String(item.name),
      description: item.description ? String(item.description) : undefined,
      capacityAdults: Number(item.capacity_adults),
      capacityChildren: Number(item.capacity_children),
      quantity: Number(item.quantity),
      basePrice: item.base_price == null ? undefined : Number(item.base_price),
      currency: String(item.currency),
      isActive: Boolean(item.is_active),
      mediaAssetIds: Array.isArray(item.media_asset_ids)
        ? item.media_asset_ids.map(String)
        : [],
      amenities: Array.isArray(item.amenities)
        ? item.amenities.map(String)
        : [],
    })),
    reservationBlocks: records("reservation_blocks").map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      unitId: item.unit_id ? String(item.unit_id) : undefined,
      startsOn: String(item.starts_on),
      endsOn: String(item.ends_on),
      quantity: Number(item.quantity),
      reason: item.reason ? String(item.reason) : undefined,
    })),
    routingDestinations: records("routing_destinations").map((item) => ({
      id: String(item.id),
      key: String(item.id),
      type:
        item.channel === "whatsapp"
          ? "whatsapp"
          : item.channel === "url"
            ? "url"
            : item.channel === "email"
              ? "email"
              : item.channel === "phone"
                ? "phone"
                : "location",
      label: String(item.label),
      value: String(item.value),
      locationId: item.settings && typeof item.settings === "object" && (item.settings as Record<string, unknown>).locationId
        ? String((item.settings as Record<string, unknown>).locationId)
        : undefined,
      message:
        item.settings && typeof item.settings === "object"
          ? String((item.settings as Record<string, unknown>).message || "") ||
            undefined
          : undefined,
      isDefault: item.settings && typeof item.settings === "object" ? (item.settings as Record<string, unknown>).isDefault === true : false,
      role: item.settings && typeof item.settings === "object" && ["general_contact", "intent_contact", "location_contact"].includes(String((item.settings as Record<string, unknown>).role || ""))
        ? String((item.settings as Record<string, unknown>).role) as "general_contact" | "intent_contact" | "location_contact"
        : undefined,
    })),
    routingRules: records("routing_rules").map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      destinationId: String(item.destination_id),
      priority: Number(item.priority),
      condition: (Array.isArray(item.conditions)
        ? item.conditions[0]
        : {}) as NonNullable<
        NonNullable<Project["commercialConfig"]>["routingRules"]
      >[number]["condition"],
      isActive: Boolean(item.is_active),
    })),
    locations: records("business_locations").map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      name: String(item.name),
      addressLine: item.address_line ? String(item.address_line) : undefined,
      addressNumber: item.address_number
        ? String(item.address_number)
        : undefined,
      addressExtra: item.address_extra ? String(item.address_extra) : undefined,
      neighborhood: item.neighborhood ? String(item.neighborhood) : undefined,
      city: item.city ? String(item.city) : undefined,
      state: item.state ? String(item.state) : undefined,
      postalCode: item.postal_code ? String(item.postal_code) : undefined,
      countryCode: String(item.country_code || "BR"),
      latitude: item.latitude == null ? undefined : Number(item.latitude),
      longitude: item.longitude == null ? undefined : Number(item.longitude),
      geocodingStatus: item.geocoding_status as
        "pending" | "resolved" | "manual" | "failed",
      geocodingProvider: item.geocoding_provider
        ? String(item.geocoding_provider)
        : undefined,
      geocodedAt: item.geocoded_at ? String(item.geocoded_at) : undefined,
      timezone: String(item.timezone || "America/Sao_Paulo"),
      openingHours: Array.isArray(item.opening_hours)
        ? (item.opening_hours as never[])
        : [],
      serviceRadiusKm:
        item.service_radius_km == null
          ? undefined
          : Number(item.service_radius_km),
      deliveryRadiusKm:
        item.delivery_radius_km == null
          ? undefined
          : Number(item.delivery_radius_km),
      supportsDelivery: Boolean(item.supports_delivery),
      supportsPickup: Boolean(item.supports_pickup),
      supportsInPerson: Boolean(item.supports_in_person),
      priority: Number(item.priority || 0),
      isActive: Boolean(item.is_active),
      routingDestinationId: item.routing_destination_id
        ? String(item.routing_destination_id)
        : undefined,
    })),
    policies: records("project_policies").map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      type: item.policy_type as NonNullable<
        NonNullable<Project["commercialConfig"]>["policies"]
      >[number]["type"],
      title: String(item.title),
      content: String(item.content),
      isActive: Boolean(item.is_active),
      settings: (item.settings as Record<string, unknown>) || {},
    })),
  };
  const dataRequirements = records("project_data_requirements").map((item) => ({
    id: String(item.id),
    key: String(item.requirement_key),
    label: String(item.label),
    capability: String(item.capability_key),
    status: item.status,
    severity: item.severity,
    value: item.value,
    origin: item.origin,
    sourceId: item.source_id ? String(item.source_id) : undefined,
    fieldMetadata: (item.field_metadata as Record<string, unknown>) || {},
    reason: String(item.reason),
  })) as unknown as Project["dataRequirements"];
  const conversionGoals = records("conversion_goals")
    .sort((a, b) => Number(a.goal_order) - Number(b.goal_order))
    .map((item) => ({
      id: String(item.id),
      projectId: String(row.id),
      name: String(item.name),
      description: item.description ? String(item.description) : undefined,
      kind: item.goal_kind as NonNullable<
        Project["conversionGoals"]
      >[number]["kind"],
      targetStepId: String(item.target_step_id),
      destinationLabel: item.destination_label
        ? String(item.destination_label)
        : undefined,
      isPrimary: Boolean(item.is_primary),
      isActive: Boolean(item.is_active),
      order: Number(item.goal_order),
      createdAt: String(item.created_at),
      updatedAt: String(item.updated_at),
    }));
  const entryPoints = records("entry_points").map((item) => ({
    id: String(item.id),
    projectId: String(row.id),
    key: String(item.entry_key),
    name: String(item.name),
    conversionGoalId: item.conversion_goal_id
      ? String(item.conversion_goal_id)
      : undefined,
    targetStepId: item.target_step_id ? String(item.target_step_id) : undefined,
    surfaceMode: item.surface_mode
      ? (item.surface_mode as NonNullable<
          Project["entryPoints"]
        >[number]["surfaceMode"])
      : undefined,
    presencePageId: item.presence_page_id
      ? String(item.presence_page_id)
      : undefined,
    channel: item.channel as NonNullable<
      Project["entryPoints"]
    >[number]["channel"],
    utmSource: item.utm_source ? String(item.utm_source) : undefined,
    utmMedium: item.utm_medium ? String(item.utm_medium) : undefined,
    utmCampaign: item.utm_campaign ? String(item.utm_campaign) : undefined,
    utmContent: item.utm_content ? String(item.utm_content) : undefined,
    utmTerm: item.utm_term ? String(item.utm_term) : undefined,
    isActive: Boolean(item.is_active),
    createdAt: String(item.created_at),
    updatedAt: String(item.updated_at),
  }));
  const presencePages: PresencePage[] = records("presence_pages").map(
    (item) => ({
      id: String(item.id),
      projectId: String(row.id),
      key: String(item.page_key),
      name: String(item.name),
      type: item.page_type as PresencePage["type"],
      path: String(item.path),
      title: item.title ? String(item.title) : undefined,
      description: item.description ? String(item.description) : undefined,
      seoTitle: item.seo_title ? String(item.seo_title) : undefined,
      seoDescription: item.seo_description
        ? String(item.seo_description)
        : undefined,
      ogImageAssetId: item.og_image_asset_id
        ? String(item.og_image_asset_id)
        : undefined,
      defaultConversionGoalId: item.default_conversion_goal_id
        ? String(item.default_conversion_goal_id)
        : undefined,
      isHome: Boolean(item.is_home),
      isActive: Boolean(item.is_active),
      isIndexable: Boolean(item.is_indexable),
      version: Number(item.version || 1),
      settings: item.settings as PresencePage["settings"],
      createdAt: String(item.created_at),
      updatedAt: String(item.updated_at),
      sections: (Array.isArray(item.presence_sections)
        ? (item.presence_sections as Array<Record<string, unknown>>)
        : []
      )
        .map((section) => ({
          id: String(section.id),
          pageId: String(item.id),
          key: String(section.section_key),
          type: section.section_type as PresencePage["sections"][number]["type"],
          anchor: section.anchor ? String(section.anchor) : undefined,
          title: section.title ? String(section.title) : undefined,
          eyebrow: section.eyebrow ? String(section.eyebrow) : undefined,
          description: section.description
            ? String(section.description)
            : undefined,
          content: (section.content as Record<string, unknown>) || {},
          style:
            (section.style as PresencePage["sections"][number]["style"]) || {},
          settings: (section.settings as Record<string, unknown>) || {},
          order: Number(section.section_order),
          isActive: Boolean(section.is_active),
        }))
        .sort((a, b) => a.order - b.order),
    }),
  );
  const mediaAssets = records("media_assets").map((item) => ({
    id: String(item.id),
    workspaceId: String(item.workspace_id),
    projectId: item.project_id ? String(item.project_id) : undefined,
    storagePath: String(item.storage_path),
    originalName: String(item.original_filename || "mídia"),
    mimeType: String(item.mime_type),
    byteSize: Number(item.file_size || 0),
    width: item.width == null ? undefined : Number(item.width),
    height: item.height == null ? undefined : Number(item.height),
    durationSeconds:
      item.duration_seconds == null ? undefined : Number(item.duration_seconds),
    assetType: item.asset_type as NonNullable<
      Project["mediaAssets"]
    >[number]["assetType"],
    status: item.status as NonNullable<
      Project["mediaAssets"]
    >[number]["status"],
    altText: item.alt_text ? String(item.alt_text) : undefined,
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    metadata: (item.metadata as Record<string, unknown>) || {},
    createdAt: String(item.created_at),
    updatedAt: item.updated_at ? String(item.updated_at) : undefined,
  }));
  const normalized: Project = {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description || ""),
    subtitle: String(settings.subtitle || ""),
    status: row.status as Project["status"],
    primaryGoal: String(row.primary_goal || ""),
    primaryDestination: String(settings.primaryDestination || "WhatsApp"),
    category: row.category ? String(row.category) : undefined,
    audience: settings.audience ? String(settings.audience) : undefined,
    phone: settings.phone ? String(settings.phone) : undefined,
    visualDirection: String(settings.visualDirection || "Equilibrada"),
    designSystem,
    brand,
    steps,
    conversionGoals,
    entryPoints,
    presence: presencePages.length ? { pages: presencePages } : undefined,
    mediaAssets,
    businessProfile: profileRow?.signals as Project["businessProfile"],
    capabilities,
    commercialConfig,
    dataRequirements,
    version: Number(settings.version || 1),
    publishedVersionId: row.published_version_id ? String(row.published_version_id) : settings.publishedVersionId ? String(settings.publishedVersionId) : undefined,
    publishedVersionNumber: settings.publishedVersionNumber ? Number(settings.publishedVersionNumber) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    publishedAt: row.published_at ? String(row.published_at) : undefined,
  };
  if (!draftPayload) return normalized;
  const hasCommercialRows =
    [
      "service_offerings",
      "schedulable_services",
      "resources",
      "availability_rules",
      "availability_exceptions",
      "catalog_categories",
      "catalog_items",
      "reservable_units",
      "reservation_blocks",
      "routing_destinations",
      "routing_rules",
      "business_locations",
      "project_policies",
    ].some((key) => records(key).length > 0) || Boolean(quoteRow);
  return {
    ...draftPayload,
    ...normalized,
    // Journey is persisted as the auditable draft aggregate by the main editor.
    steps: draftPayload.steps,
    conversionGoals: draftPayload.conversionGoals || normalized.conversionGoals,
    entryPoints: draftPayload.entryPoints || normalized.entryPoints,
    // Dedicated Site and Commercial Data APIs remain authoritative when rows exist.
    presence: normalized.presence || draftPayload.presence,
    commercialConfig: hasCommercialRows
      ? normalized.commercialConfig
      : draftPayload.commercialConfig,
    capabilities: normalized.capabilities?.length
      ? normalized.capabilities
      : draftPayload.capabilities,
    dataRequirements: normalized.dataRequirements?.length
      ? normalized.dataRequirements
      : draftPayload.dataRequirements,
  };
}

export async function getPublishedProject(
  supabase: SupabaseClient,
  column: "id" | "slug",
  value: string,
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("settings")
    .eq(column, value)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const settings =
    data.settings && typeof data.settings === "object"
      ? (data.settings as Record<string, unknown>)
      : {};
  const project = settings.publishedPayload &&
    typeof settings.publishedPayload === "object"
    ? (settings.publishedPayload as Project)
    : null;
  if (!project) return null;
  return (await isWorkspacePublicAccessActive(supabase, project.workspaceId))
    ? project
    : null;
}

export async function getPublishedProjectBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<Project | null> {
  return getPublishedProject(supabase, "slug", slug);
}
