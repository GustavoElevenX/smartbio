import { isLocationOpen } from "@/features/routing/opening-hours";
import type { BusinessLocation } from "@/types";

export interface GeoRoutingInput { latitude: number; longitude: number; fulfillment?: "delivery" | "pickup" | "in_person"; requestedAt: string; }
export interface GeoRouteCandidate { locationId: string; distanceKm: number; isOpen: boolean; withinRadius: boolean; eligibleForFulfillment: boolean; priority: number; }
export interface GeoRouteResult { recommended?: GeoRouteCandidate; alternatives: GeoRouteCandidate[]; fallbackReason?: string; }

const radians = (degrees: number) => degrees * Math.PI / 180;
export function haversineDistanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) { const earthRadiusKm = 6371.0088; const deltaLatitude = radians(to.latitude - from.latitude); const deltaLongitude = radians(to.longitude - from.longitude); const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLongitude / 2) ** 2; return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }

function supports(location: BusinessLocation, fulfillment?: GeoRoutingInput["fulfillment"]) { if (!fulfillment) return true; if (fulfillment === "delivery") return location.supportsDelivery; if (fulfillment === "pickup") return location.supportsPickup; return location.supportsInPerson; }

export function resolveNearestLocation(input: GeoRoutingInput, locations: BusinessLocation[]): GeoRouteResult {
  const candidates = locations.filter((location) => location.isActive && location.latitude != null && location.longitude != null).map((location): GeoRouteCandidate => {
    const distanceKm = haversineDistanceKm(input, { latitude: location.latitude!, longitude: location.longitude! });
    const radius = input.fulfillment === "delivery" ? location.deliveryRadiusKm : location.serviceRadiusKm;
    return { locationId: location.id, distanceKm: Math.round(distanceKm * 100) / 100, isOpen: isLocationOpen(location, input.requestedAt), withinRadius: radius == null || distanceKm <= radius, eligibleForFulfillment: supports(location, input.fulfillment), priority: location.priority };
  }).sort((a, b) => Number(b.eligibleForFulfillment) - Number(a.eligibleForFulfillment) || Number(b.withinRadius) - Number(a.withinRadius) || Number(b.isOpen) - Number(a.isOpen) || b.priority - a.priority || a.distanceKm - b.distanceKm);
  const recommended = candidates.find((candidate) => candidate.isOpen && candidate.withinRadius && candidate.eligibleForFulfillment);
  if (recommended) return { recommended, alternatives: candidates.filter((candidate) => candidate.locationId !== recommended.locationId) };
  const fallbackReason = !candidates.length ? "no_geocoded_locations" : !candidates.some((item) => item.eligibleForFulfillment) ? "fulfillment_unavailable" : !candidates.some((item) => item.withinRadius) ? "outside_service_radius" : "all_locations_closed";
  return { alternatives: candidates, fallbackReason };
}
