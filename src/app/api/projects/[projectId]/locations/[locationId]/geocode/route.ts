import { z } from "zod";

import { assertProjectAccess } from "@/server/auth/project-access";
import { apiError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { configuredMapsProvider } from "@/server/maps/maps-client";
import {
  AddressNotFoundError,
  MapsConfigurationError,
} from "@/server/maps/maps-errors";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  rateLimitRules,
} from "@/server/rate-limit/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

const pathSchema = z.object({
  projectId: z.uuid(),
  locationId: z.uuid(),
});

function buildAddress(location: Record<string, unknown>) {
  return [
    location.address_line,
    location.address_number,
    location.address_extra,
    location.neighborhood,
    location.city,
    location.state,
    location.postal_code,
    location.country_code,
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .join(", ");
}

export const POST = withAuthenticatedActor(
  async (
    _request,
    context: RouteContext<"/api/projects/[projectId]/locations/[locationId]/geocode">,
    actor,
  ) => {
    const parsed = pathSchema.safeParse(await context.params);
    if (!parsed.success) return apiError("Unidade inválida.", 400, "invalid_location");
    const { projectId, locationId } = parsed.data;
    await assertProjectAccess(actor, projectId, "write");

    const rate = await consumeRateLimit(
      "location-geocode",
      actor.workspaceId,
      rateLimitRules.publicRead,
      { failClosed: true },
    );
    if (!rate.allowed) {
      return applyRateLimitHeaders(
        apiError("Muitas tentativas de geocodificação.", 429, "rate_limited"),
        rate,
      );
    }

    const supabase = createServiceClient();
    if (!supabase) {
      return applyRateLimitHeaders(
        apiError("Configure o Supabase para geocodificar unidades.", 503, "database_unavailable"),
        rate,
      );
    }
    const { data: location } = await supabase
      .from("business_locations")
      .select("*")
      .eq("id", locationId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!location) {
      return applyRateLimitHeaders(
        apiError("Salve a unidade antes de geocodificar.", 404, "location_not_found"),
        rate,
      );
    }

    const address = buildAddress(location);
    if (!address) {
      return applyRateLimitHeaders(
        apiError("Informe o endereço ou CEP da unidade.", 400, "address_required"),
        rate,
      );
    }

    try {
      const result = await configuredMapsProvider().geocodeAddress({
        address,
        countryCode: String(location.country_code || "BR"),
      });
      const { error } = await supabase
        .from("business_locations")
        .update({
          latitude: result.latitude,
          longitude: result.longitude,
          address_line: result.addressLine || location.address_line,
          address_number: result.addressNumber || location.address_number,
          neighborhood: result.neighborhood || location.neighborhood,
          city: result.city || location.city,
          state: result.state || location.state,
          postal_code: result.postalCode || location.postal_code,
          country_code: result.countryCode,
          geocoding_status: "resolved",
          geocoding_provider: result.provider,
          geocoded_at: new Date().toISOString(),
          settings: {
            ...(location.settings || {}),
            formattedAddress: result.formattedAddress,
            providerPlaceId: result.providerPlaceId,
          },
        })
        .eq("id", locationId)
        .eq("project_id", projectId);
      if (error) throw new Error("Não foi possível salvar a geocodificação.");

      return applyRateLimitHeaders(Response.json(result), rate);
    } catch (error) {
      if (error instanceof AddressNotFoundError) {
        await supabase
          .from("business_locations")
          .update({ geocoding_status: "failed" })
          .eq("id", locationId)
          .eq("project_id", projectId);
      }
      const status = error instanceof MapsConfigurationError ? 503 : 422;
      return applyRateLimitHeaders(
        apiError(
          error instanceof Error ? error.message : "Falha ao geocodificar.",
          status,
          "geocoding_failed",
        ),
        rate,
      );
    }
  },
);
