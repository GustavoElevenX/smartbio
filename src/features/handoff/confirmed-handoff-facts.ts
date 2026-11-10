import type { Project } from "@/types";
import type { CommercialHandoffContext } from "./commercial-handoff-context";

/** Só entidades operacionais do projeto podem entrar como fatos da empresa. */
export function confirmedHandoffFacts(project: Project, intent: CommercialHandoffContext["intent"]): CommercialHandoffContext["qualification"] {
  const facts: CommercialHandoffContext["qualification"] = [];
  const products = project.commercialConfig?.catalogItems?.filter((item) => intent.productIds?.includes(item.id)).map((item) => item.name).filter(Boolean);
  const services = project.commercialConfig?.serviceOfferings?.filter((item) => intent.serviceIds?.includes(item.id)).map((item) => item.name).filter(Boolean);
  const location = project.commercialConfig?.locations?.find((item) => item.id === intent.locationId && item.isActive);
  if (products?.length) facts.push({ label: "Produtos selecionados", value: products.join(", "), include: true, source: "business_confirmed" });
  if (services?.length) facts.push({ label: "Serviços selecionados", value: services.join(", "), include: true, source: "business_confirmed" });
  if (location) facts.push({ label: "Unidade", value: location.name, include: true, source: "business_confirmed" });
  return facts;
}
