import type { Project } from "@/types";
import { inferBusinessShape } from "./business-shape";
import { chooseCatalogStrategy } from "./catalog-strategy";
import { recommendContentDensity } from "./content-density";
import { recommendConversionStrategy } from "./conversion-strategy";
import { recommendSections } from "./section-recommendation";
import type { SiteOperation, SiteStructureProposal, SuggestedPage, SuggestedSiteStructure } from "./site-composer.types";
import { recommendVisualDirection } from "./visual-strategy";

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "pagina";
}

function proposedPages(project: Project): SuggestedPage[] {
  const shape = inferBusinessShape(project);
  const goals = project.conversionGoals?.filter((goal) => goal.isActive) || [];
  const primary = goals.find((goal) => goal.isPrimary) || goals[0];
  const home: SuggestedPage = {
    type: "home",
    name: "Início",
    purpose: "Apresentar a marca, orientar a escolha e conduzir ao objetivo principal.",
    pathSuggestion: "/",
    conversionGoalId: primary?.id,
    sections: recommendSections(shape).map((section) => ({ ...section, conversionGoalId: section.priority === "essential" ? primary?.id : undefined })),
  };
  const pages = [home];
  if (shape.productCount > 8) pages.push({ type: "page", name: "Catálogo", purpose: "Permitir busca, filtro e seleção em um catálogo completo.", pathSuggestion: "/catalogo", conversionGoalId: primary?.id, sections: [recommendSections(shape).find((section) => section.sectionType === "products")!, recommendSections(shape).find((section) => section.sectionType === "conversion_cta")!] });
  if (shape.model === "b2b" || shape.hasQualification) pages.push({ type: "landing", name: "Fale com a equipe", purpose: "Coletar o contexto mínimo para um handoff comercial útil.", pathSuggestion: "/fale-com-a-equipe", conversionGoalId: primary?.id, sections: recommendSections({ ...shape, hasCatalog: false }).filter((section) => ["hero", "benefits", "testimonials", "faq", "conversion_cta"].includes(section.sectionType)) });
  return pages;
}

export function suggestSiteStructure(project: Project, instruction = ""): SuggestedSiteStructure {
  const shape = inferBusinessShape(project);
  const density = recommendContentDensity(shape);
  const warnings: string[] = [];
  if (!project.conversionGoals?.some((goal) => goal.isActive)) warnings.push("Defina um objetivo de conversão antes de publicar.");
  if (shape.locationCount && !project.commercialConfig?.locations?.some((location) => location.latitude != null && location.longitude != null)) warnings.push("A Sobe não indicará a unidade mais próxima até existirem coordenadas confirmadas.");
  return {
    reasoning: `A estrutura considera um negócio ${shape.model}, com ${shape.productCount} produtos e ${shape.serviceCount} serviços. ${instruction ? `Pedido considerado: ${instruction}` : ""}`.trim(),
    pages: proposedPages(project),
    primaryConversionGoals: recommendConversionStrategy(shape),
    catalogStrategy: chooseCatalogStrategy(shape.productCount),
    contentStrategy: [`densidade_${density}`, "fontes comerciais vinculadas", "conteúdo verificável antes de prova social"],
    visualDirection: recommendVisualDirection(shape),
    warnings,
  };
}

export function createSiteStructureProposal(project: Project, target: "site" | "page", instruction = "", pageId?: string): SiteStructureProposal {
  const suggestion = suggestSiteStructure(project, instruction);
  const pages = target === "page" ? suggestion.pages.filter((page) => project.presence?.pages.find((candidate) => candidate.id === pageId)?.isHome === (page.type === "home")) : suggestion.pages;
  const operations: SiteOperation[] = [];
  pages.forEach((page, pageIndex) => {
    const existing = page.type === "home" ? project.presence?.pages.find((candidate) => candidate.isHome) : undefined;
    if (!existing) operations.push({ id: `add-page-${pageIndex}-${slug(page.name)}`, type: "add_page", page });
    else page.sections.forEach((section, index) => operations.push({ id: `add-section-${existing.id}-${index}`, type: "add_section", pageId: existing.id, section, at: index }));
  });
  return {
    proposalId: crypto.randomUUID(), projectId: project.id, expectedVersion: project.version, target, pageId,
    suggestion: { ...suggestion, pages }, operations, createdAt: new Date().toISOString(), status: "pending",
  };
}
