import type { Project } from "@/types";
import type { BusinessShape } from "./site-composer.types";

const text = (project: Project) => `${project.category || ""} ${project.primaryGoal || ""} ${project.description || ""}`.toLowerCase();

export function inferBusinessShape(project: Project): BusinessShape {
  const products = project.commercialConfig?.catalogItems?.filter((item) => item.isAvailable) || [];
  const services = project.commercialConfig?.serviceOfferings?.filter((item) => item.isActive) || [];
  const locations = project.commercialConfig?.locations?.filter((item) => item.isActive) || [];
  const corpus = text(project);
  const hospitality = /hotel|pousada|hosped|reserva/.test(corpus);
  const b2b = /b2b|empresa|corporativ|indústria|industria|atacado/.test(corpus);
  const professional = /advoc|consult|contab|clínic|clinica|profission/.test(corpus);
  const local = locations.length > 0 || /local|loja|restaurante|salão|salao/.test(corpus);
  const model: BusinessShape["model"] = hospitality
    ? "hospitality"
    : b2b
      ? "b2b"
      : professional
        ? "professional"
        : products.length && services.length
          ? "mixed"
          : products.length
            ? "product"
            : services.length
              ? "service"
              : local
                ? "local"
                : "unknown";
  const goals = project.conversionGoals?.filter((goal) => goal.isActive) || [];
  const sectionTypes = new Set(project.presence?.pages.flatMap((page) => page.sections.map((section) => section.type)) || []);
  return {
    model,
    productCount: products.length,
    serviceCount: services.length,
    locationCount: locations.length,
    hasPortfolio: sectionTypes.has("portfolio") || sectionTypes.has("gallery"),
    hasTestimonials: sectionTypes.has("testimonials"),
    hasPricing: sectionTypes.has("pricing") || products.some((item) => item.price != null),
    hasCatalog: products.length > 0,
    hasScheduling: Boolean(project.commercialConfig?.schedulableServices?.length),
    hasReservation: Boolean(project.commercialConfig?.reservableUnits?.length),
    hasQualification: Boolean(project.commercialConfig?.qualificationRules?.length),
    hasMultipleGoals: goals.length > 1,
    primaryGoalTypes: goals.filter((goal) => goal.isPrimary).map((goal) => goal.kind),
  };
}
