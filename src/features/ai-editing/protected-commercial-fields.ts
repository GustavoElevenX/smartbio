export const protectedCommercialFieldNames = [
  "price", "minPrice", "maxPrice", "phone", "whatsapp", "address", "addressLine",
  "latitude", "longitude", "openingHours", "availability", "availabilityRules",
  "availabilityExceptions", "capacity", "capacityAdults", "capacityChildren", "stock",
  "paymentUrl", "policy", "policies", "cancellationRule",
] as const;

export const protectedCommercialFieldSet = new Set<string>(protectedCommercialFieldNames);

export function isProtectedCommercialField(path: string) {
  return path.replace(/\[(\d+)\]/g, ".$1").split(".").some((segment) => protectedCommercialFieldSet.has(segment));
}

export function verifiedCommercialPaths(requirements: Array<{ key: string; status: string }> = []) {
  return new Set(requirements.filter((item) => item.status === "verified" && isProtectedCommercialField(item.key)).map((item) => item.key));
}
