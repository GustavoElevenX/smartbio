import { z } from "zod";

import {
  resolveNearestLocation,
  type GeoRouteCandidate,
} from "@/features/routing/geo-routing-engine";
import { isLocationOpen } from "@/features/routing/opening-hours";
import { features } from "@/lib/constants";
import { findDemoProject } from "@/data/demo-projects";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess, requestIp, validationError } from "@/server/http/api-response";
import { configuredMapsProvider } from "@/server/maps/maps-client";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  rateLimitRules,
} from "@/server/rate-limit/rate-limit";
import type { BusinessLocation, RoutingDestination } from "@/types";

const nearestSchema = z
  .object({
    // Published demo experiences use stable human-readable IDs while persisted
    // projects use UUIDs. Both are valid public routing targets.
    projectId: z.string().trim().min(1).max(80),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    postalCode: z.string().trim().regex(/^\d{5}-?\d{3}$/).optional(),
    neighborhood: z.string().trim().min(2).max(120).optional(),
    city: z.string().trim().min(2).max(120).optional(),
    fulfillment: z.enum(["delivery", "pickup", "in_person"]).optional(),
  })
  .refine((data) => (data.latitude == null) === (data.longitude == null), {
    message: "Latitude e longitude devem ser informadas juntas.",
    path: ["latitude"],
  })
  .refine(
    (data) =>
      data.latitude != null ||
      Boolean(data.postalCode || data.neighborhood || data.city),
    { message: "Informe localização, CEP, bairro ou cidade." },
  );

function destinationFromRow(row: Record<string, unknown>): RoutingDestination | undefined {
  const relation = Array.isArray(row.routing_destinations)
    ? row.routing_destinations[0]
    : row.routing_destinations;
  if (!relation || typeof relation !== "object") return undefined;
  const value = relation as Record<string, unknown>;
  if (!value.is_active) return undefined;
  const channel = String(value.channel || "internal");
  if (!["whatsapp", "url", "phone", "email"].includes(channel)) return undefined;
  return {
    id: String(value.id),
    key: String(value.id),
    type: channel as RoutingDestination["type"],
    label: String(value.label),
    value: String(value.value || ""),
    message: value.settings && typeof value.settings === "object"
      ? String((value.settings as Record<string, unknown>).message || "") || undefined
      : undefined,
  };
}

function locationFromRow(row: Record<string, unknown>): BusinessLocation {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name),
    addressLine: row.address_line ? String(row.address_line) : undefined,
    addressNumber: row.address_number ? String(row.address_number) : undefined,
    addressExtra: row.address_extra ? String(row.address_extra) : undefined,
    neighborhood: row.neighborhood ? String(row.neighborhood) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    postalCode: row.postal_code ? String(row.postal_code) : undefined,
    countryCode: String(row.country_code || "BR"),
    latitude: row.latitude == null ? undefined : Number(row.latitude),
    longitude: row.longitude == null ? undefined : Number(row.longitude),
    geocodingStatus: row.geocoding_status as BusinessLocation["geocodingStatus"],
    geocodingProvider: row.geocoding_provider ? String(row.geocoding_provider) : undefined,
    geocodedAt: row.geocoded_at ? String(row.geocoded_at) : undefined,
    timezone: String(row.timezone || "America/Sao_Paulo"),
    openingHours: Array.isArray(row.opening_hours) ? row.opening_hours as BusinessLocation["openingHours"] : [],
    serviceRadiusKm: row.service_radius_km == null ? undefined : Number(row.service_radius_km),
    deliveryRadiusKm: row.delivery_radius_km == null ? undefined : Number(row.delivery_radius_km),
    supportsDelivery: Boolean(row.supports_delivery),
    supportsPickup: Boolean(row.supports_pickup),
    supportsInPerson: Boolean(row.supports_in_person),
    priority: Number(row.priority || 0),
    isActive: Boolean(row.is_active),
    routingDestinationId: row.routing_destination_id ? String(row.routing_destination_id) : undefined,
  };
}

function publicLocation(
  location: BusinessLocation,
  candidate: GeoRouteCandidate | undefined,
  destination: RoutingDestination | undefined,
) {
  return {
    id: location.id,
    name: location.name,
    address: [
      location.addressLine,
      location.addressNumber,
      location.neighborhood,
      location.city,
      location.state,
    ].filter(Boolean).join(", "),
    neighborhood: location.neighborhood,
    city: location.city,
    state: location.state,
    distanceKm: candidate?.distanceKm,
    isOpen: candidate?.isOpen,
    destination,
  };
}

function normalize(value?: string) {
  return value?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export async function POST(request: Request) {
  if (!features.geoRouting) {
    return apiError("Roteamento geográfico desativado.", 404, "feature_disabled");
  }
  const parsed = nearestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const rate = await consumeRateLimit(
    "public-route-resolve",
    `${requestIp(request)}:${input.projectId}`,
    rateLimitRules.publicRouteResolve,
    { failClosed: true },
  );
  if (!rate.allowed) {
    return applyRateLimitHeaders(
      apiError("Muitas consultas de unidade.", 429, "rate_limited"),
      rate,
    );
  }

  const supabase = createServiceClient();
  if (!supabase) {
    const demo = findDemoProject(input.projectId);
    const demoLocations = demo?.commercialConfig?.locations?.filter((item) => item.isActive) || [];
    if (!demo || demo.status !== "published" || !demoLocations.length) {
      return applyRateLimitHeaders(
        apiError("Experiência indisponível.", 503, "database_unavailable"),
        rate,
      );
    }
    const postal = input.postalCode?.replace(/\D/g, "");
    const approximate = demoLocations.find((location) =>
      postal && location.postalCodePrefixes?.some((prefix) => postal.startsWith(prefix.replace(/\D/g, ""))),
    ) || demoLocations.find((location) =>
      (!input.city || normalize(location.city) === normalize(input.city)) &&
      (!input.neighborhood || normalize(location.neighborhood) === normalize(input.neighborhood)),
    ) || demoLocations[0];
    const origin = input.latitude != null && input.longitude != null
      ? { latitude: input.latitude, longitude: input.longitude }
      : { latitude: approximate.latitude!, longitude: approximate.longitude! };
    const resolved = resolveNearestLocation(
      { ...origin, fulfillment: input.fulfillment, requestedAt: new Date().toISOString() },
      demoLocations,
    );
    const byId = new Map(demoLocations.map((location) => [location.id, location]));
    const destinationFor = (locationId: string) => {
      const location = byId.get(locationId);
      return demo.commercialConfig?.routingDestinations?.find((item) => item.id === location?.routingDestinationId);
    };
    return applyRateLimitHeaders(apiSuccess({
      recommended: resolved.recommended
        ? publicLocation(byId.get(resolved.recommended.locationId)!, resolved.recommended, destinationFor(resolved.recommended.locationId))
        : undefined,
      alternatives: resolved.alternatives.map((candidate) => publicLocation(byId.get(candidate.locationId)!, candidate, destinationFor(candidate.locationId))),
      fallbackReason: resolved.fallbackReason,
      method: input.latitude != null ? "geolocation" : input.postalCode ? "postal_code" : "city",
    }), rate);
  }
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("status", "published")
    .maybeSingle();
  if (!project) {
    return applyRateLimitHeaders(
      apiError("Experiência não encontrada.", 404, "project_not_found"),
      rate,
    );
  }

  const { data: rows, error } = await supabase
    .from("business_locations")
    .select("*,routing_destinations(id,label,channel,value,is_active,settings)")
    .eq("project_id", input.projectId)
    .eq("is_active", true);
  if (error) {
    return applyRateLimitHeaders(
      apiError("Não foi possível consultar as unidades.", 503, "locations_unavailable"),
      rate,
    );
  }
  const locations = (rows || []).map((row) => locationFromRow(row));
  const destinations = new Map(
    (rows || []).map((row) => [String(row.id), destinationFromRow(row)]),
  );

  let latitude = input.latitude;
  let longitude = input.longitude;
  let method: "geolocation" | "postal_code" | "city" = "geolocation";
  if (latitude == null || longitude == null) {
    method = input.postalCode ? "postal_code" : "city";
    try {
      const provider = configuredMapsProvider();
      const resolved = input.postalCode && provider.geocodePostalCode
        ? await provider.geocodePostalCode({ postalCode: input.postalCode, countryCode: "BR" })
        : await provider.geocodeAddress({
            address: [input.neighborhood, input.city, "Brasil"].filter(Boolean).join(", "),
            countryCode: "BR",
          });
      latitude = resolved.latitude;
      longitude = resolved.longitude;
    } catch {
      const city = normalize(input.city);
      const neighborhood = normalize(input.neighborhood);
      const manual = locations
        .filter((location) =>
          (!city || normalize(location.city) === city) &&
          (!neighborhood || normalize(location.neighborhood) === neighborhood),
        )
        .toSorted((a, b) =>
          Number(isLocationOpen(b, new Date())) - Number(isLocationOpen(a, new Date())) ||
          b.priority - a.priority,
        );
      const alternatives = manual.length ? manual : locations;
      return applyRateLimitHeaders(
        apiSuccess({
          recommended: manual[0]
            ? publicLocation(manual[0], undefined, destinations.get(manual[0].id))
            : undefined,
          alternatives: alternatives.map((location) =>
            publicLocation(location, undefined, destinations.get(location.id)),
          ),
          fallbackReason: manual.length ? "approximate_area_match" : "manual_selection_required",
          method,
        }),
        rate,
      );
    }
  }

  const result = resolveNearestLocation(
    {
      latitude,
      longitude,
      fulfillment: input.fulfillment,
      requestedAt: new Date().toISOString(),
    },
    locations,
  );
  const byId = new Map(locations.map((location) => [location.id, location]));
  const recommended = result.recommended
    ? publicLocation(
        byId.get(result.recommended.locationId)!,
        result.recommended,
        destinations.get(result.recommended.locationId),
      )
    : undefined;
  const alternatives = result.alternatives
    .map((candidate) => {
      const location = byId.get(candidate.locationId);
      return location
        ? publicLocation(location, candidate, destinations.get(candidate.locationId))
        : undefined;
    })
    .filter(Boolean);

  await supabase.from("analytics_events").insert({
    project_id: input.projectId,
    event_name: "route_resolved",
    metadata: {
      locationId: result.recommended?.locationId,
      approximateDistanceKm: result.recommended
        ? Math.round(result.recommended.distanceKm)
        : undefined,
      method,
      fallbackReason: result.fallbackReason,
    },
  });

  return applyRateLimitHeaders(
    apiSuccess({
      recommended,
      alternatives,
      fallbackReason: result.fallbackReason,
      method,
    }),
    rate,
  );
}
