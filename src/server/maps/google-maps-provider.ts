import "server-only";

import {
  AddressNotFoundError,
  MapsConfigurationError,
  MapsProviderError,
} from "@/server/maps/maps-errors";
import type {
  GeocodedAddress,
  MapsProvider,
} from "@/server/maps/maps-provider";

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeocodingResponse {
  status: string;
  error_message?: string;
  results?: Array<{
    formatted_address: string;
    place_id?: string;
    address_components: GoogleAddressComponent[];
    geometry: { location: { lat: number; lng: number } };
  }>;
}

function component(
  components: GoogleAddressComponent[],
  type: string,
  short = false,
) {
  const found = components.find((item) => item.types.includes(type));
  return found ? (short ? found.short_name : found.long_name) : undefined;
}

export class GoogleMapsProvider implements MapsProvider {
  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new MapsConfigurationError();
  }

  private async geocode(params: URLSearchParams): Promise<GeocodedAddress> {
    params.set("key", this.apiKey);
    params.set("language", "pt-BR");
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
      { signal: AbortSignal.timeout(8_000), cache: "no-store" },
    ).catch(() => null);
    if (!response?.ok) throw new MapsProviderError();

    const payload = (await response.json()) as GoogleGeocodingResponse;
    if (payload.status === "ZERO_RESULTS") throw new AddressNotFoundError();
    if (payload.status !== "OK" || !payload.results?.[0]) {
      console.error("google_geocoding_failed", { status: payload.status });
      throw new MapsProviderError();
    }

    const result = payload.results[0];
    const parts = result.address_components;
    const city =
      component(parts, "locality") ||
      component(parts, "administrative_area_level_2");
    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      addressLine: component(parts, "route"),
      addressNumber: component(parts, "street_number"),
      neighborhood:
        component(parts, "sublocality_level_1") ||
        component(parts, "neighborhood"),
      city,
      state: component(parts, "administrative_area_level_1", true),
      postalCode: component(parts, "postal_code"),
      countryCode: component(parts, "country", true) || "BR",
      provider: "google",
      providerPlaceId: result.place_id,
    };
  }

  geocodeAddress(input: { address: string; countryCode: string }) {
    return this.geocode(
      new URLSearchParams({ address: input.address, region: input.countryCode }),
    );
  }

  geocodePostalCode(input: { postalCode: string; countryCode: string }) {
    return this.geocode(
      new URLSearchParams({
        components: `postal_code:${input.postalCode}|country:${input.countryCode}`,
        region: input.countryCode,
      }),
    );
  }
}
