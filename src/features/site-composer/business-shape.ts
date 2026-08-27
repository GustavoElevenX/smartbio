import type { Project } from "@/types";
import type { BusinessShape } from "./site-composer.types";

export function inferBusinessShape(project: Project): BusinessShape {
  const products = project.commercialConfig?.catalogItems?.filter((item) => item.isAvailable) || [];
  const services = project.commercialConfig?.serviceOfferings?.filter((item) => item.isActive) || [];
  const locations = project.commercialConfig?.locations?.filter((item) => item.isActive) || [];
  const offerKinds = new Set(project.businessProfile?.offerKinds || []);
  const goals = project.conversionGoals?.filter((goal) => goal.isActive) || [];
  const goalKinds = new Set(goals.map((goal) => goal.kind));
  const hospitality = offerKinds.has("hospitality") || offerKinds.has("rental") || Boolean(project.commercialConfig?.reservableUnits?.length);
  const professional = offerKinds.has("professional_service");
  const b2b = Boolean(project.businessProfile?.requiresQualification && (goalKinds.has("request_quote") || project.businessProfile.primaryIntents.includes("request_proposal")));
  const local = locations.length > 0;
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
