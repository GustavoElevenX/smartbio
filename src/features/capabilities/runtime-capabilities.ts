import type { Project } from "@/types";

export interface RuntimeCapabilities {
  geolocation: { available: boolean; reason?: string };
  catalogSearch: boolean;
  scheduling: boolean;
  reservations: boolean;
}

export function resolveRuntimeCapabilities(project: Project): RuntimeCapabilities {
  const hasCoordinates = project.commercialConfig?.locations?.some((location) => location.latitude != null && location.longitude != null) ?? false;
  return {
    geolocation: { available: hasCoordinates, reason: hasCoordinates ? undefined : "Nenhuma unidade possui coordenadas confirmadas." },
    catalogSearch: (project.commercialConfig?.catalogItems?.length || 0) > 8,
    scheduling: Boolean(project.commercialConfig?.schedulableServices?.length),
    reservations: Boolean(project.commercialConfig?.reservableUnits?.length),
  };
}
