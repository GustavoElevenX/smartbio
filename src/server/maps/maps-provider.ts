import "server-only";

export interface GeocodedAddress {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  addressLine?: string;
  addressNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode: string;
  provider: string;
  providerPlaceId?: string;
}

export interface MapsProvider {
  geocodeAddress(input: {
    address: string;
    countryCode: string;
  }): Promise<GeocodedAddress>;

  geocodePostalCode?(input: {
    postalCode: string;
    countryCode: string;
  }): Promise<GeocodedAddress>;
}
