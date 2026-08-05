import "server-only";

import { GoogleMapsProvider } from "@/server/maps/google-maps-provider";
import { MapsConfigurationError } from "@/server/maps/maps-errors";
import type { MapsProvider } from "@/server/maps/maps-provider";

export function configuredMapsProvider(): MapsProvider {
  const provider = process.env.MAPS_PROVIDER || "google";
  if (provider !== "google") {
    throw new MapsConfigurationError(`Provedor de mapas desconhecido: ${provider}.`);
  }
  return new GoogleMapsProvider(process.env.GOOGLE_MAPS_SERVER_API_KEY || "");
}
