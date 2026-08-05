import type { Project } from "@/types";

export const protectedFieldPatterns = [
  "commercialConfig.*.price", "commercialConfig.*.phone", "commercialConfig.*.whatsapp", "commercialConfig.*.address",
  "commercialConfig.*.latitude", "commercialConfig.*.longitude", "commercialConfig.*.openingHours", "commercialConfig.*.availability",
  "commercialConfig.*.capacity", "commercialConfig.*.policy", "commercialConfig.*.paymentUrl",
] as const;

const protectedSegments = new Set(["price", "basePrice", "minPrice", "maxPrice", "phone", "whatsapp", "address", "addressLine", "latitude", "longitude", "openingHours", "availabilityRules", "availabilityExceptions", "capacity", "capacityAdults", "capacityChildren", "policies", "policy", "paymentUrl"]);

export function isProtectedFieldPath(path: string) { const segments = path.replace(/\[(\d+)\]/g, ".$1").split("."); return segments[0] === "commercialConfig" && segments.some((segment) => protectedSegments.has(segment)); }

export function verifiedFieldPaths(project: Project) { return (project.dataRequirements || []).filter((item) => item.status === "verified").map((item) => item.key); }

export function preserveProtectedProjectFields(before: Project, candidate: Project): Project { return { ...candidate, commercialConfig: structuredClone(before.commercialConfig), dataRequirements: structuredClone(before.dataRequirements), phone: before.phone, primaryDestination: before.primaryDestination }; }

export function preserveStepOperationalFields(before: Project["steps"][number], candidate: Project["steps"][number]) { return { ...candidate, id: before.id, order: before.order, options: structuredClone(before.options), formFields: structuredClone(before.formFields), settings: { ...candidate.settings, ...before.settings }, isActive: before.isActive }; }
