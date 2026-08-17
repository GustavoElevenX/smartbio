import type { Project } from "@/types";
import { inferBusinessShape } from "./business-shape";
import { chooseCatalogStrategy } from "./catalog-strategy";
import { recommendContentDensity } from "./content-density";
import { recommendConversionStrategy } from "./conversion-strategy";
import { recommendSections } from "./section-recommendation";
import type { SiteComposerIntent, SiteOperation, SiteStructureProposal, SuggestedPage, SuggestedSection, SuggestedSiteStructure } from "./site-composer.types";
import { recommendVisualDirection } from "./visual-strategy";

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "pagina";
}

function instructionFlags(instruction: string) {
  const value = instruction.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return {
    b2b: /b2b|revenda|revendedor|atacado|corporativ|empresa/.test(value),
    delivery: /delivery|entrega|pedido/.test(value),
    catalog: /catalog|produto|categoria/.test(value),
    minimal: /minimal|simples|enxut|limp/.test(value),
    noFaq: /sem faq|remov.*faq|nao.*faq/.test(value),
    landing: /landing|campanha/.test(value),
    qualification: /qualific|lead.*ruim|reduzir.*lead/.test(value),
  };
}

function bindInstructionToSections(project: Project, sections: SuggestedSection[], instruction: string) {
  const flags = instructionFlags(instruction);
  const normalized = instruction.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return sections
    .filter((section) => !(flags.noFaq && section.sectionType === "faq"))
    .map((section) => {
      if (section.sectionType === "hero") return { ...section, suggestedContent: { ...section.suggestedContent, variant: flags.minimal ? "minimal" : flags.delivery ? "offer_focus" : flags.b2b ? "editorial" : (section.suggestedContent.variant || "split") } };
      if (section.sectionType !== "products") return section;
      const categories = project.commercialConfig?.catalogCategories?.filter((category) => normalized.includes(category.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())) || [];
      const items = project.commercialConfig?.catalogItems?.filter((item) => normalized.includes(item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())) || [];
      return { ...section, suggestedContent: { ...section.suggestedContent, ...(categories.length ? { categoryIds: categories.map((item) => item.id) } : {}), ...(items.length ? { itemIds: items.map((item) => item.id) } : {}) }, sourceBindings: [...section.sourceBindings, ...categories.map((item) => `commercialConfig.catalogCategories:${item.id}`), ...items.map((item) => `commercialConfig.catalogItems:${item.id}`)] };
    });
}

function proposedPages(project: Project, instruction = ""): SuggestedPage[] {
  const shape = inferBusinessShape(project);
  const flags = instructionFlags(instruction);
  const goals = project.conversionGoals?.filter((goal) => goal.isActive) || [];
  const primary = goals.find((goal) => goal.isPrimary) || goals[0];
  const home: SuggestedPage = {
    type: "home",
    name: "Início",
    purpose: "Apresentar a marca, orientar a escolha e conduzir ao objetivo principal.",
    pathSuggestion: "/",
    conversionGoalId: primary?.id,
    sections: bindInstructionToSections(project, recommendSections({ ...shape, model: flags.b2b ? "b2b" : shape.model, hasQualification: flags.qualification || shape.hasQualification }), instruction).map((section) => ({ ...section, conversionGoalId: section.priority === "essential" ? primary?.id : undefined })),
  };
  const pages = [home];
  if (shape.productCount > 8) pages.push({ type: "page", name: "Catálogo", purpose: "Permitir busca, filtro e seleção em um catálogo completo.", pathSuggestion: "/catalogo", conversionGoalId: primary?.id, sections: [recommendSections(shape).find((section) => section.sectionType === "products")!, recommendSections(shape).find((section) => section.sectionType === "conversion_cta")!] });
  if (shape.model === "b2b" || shape.hasQualification || flags.b2b || flags.qualification) pages.push({ type: "landing", name: flags.b2b ? "Revenda" : "Fale com a equipe", purpose: "Coletar o contexto mínimo para um handoff comercial útil.", pathSuggestion: flags.b2b ? "/revenda" : "/fale-com-a-equipe", conversionGoalId: primary?.id, sections: bindInstructionToSections(project, recommendSections({ ...shape, model: "b2b", hasCatalog: false, hasQualification: true }).filter((section) => ["hero", "benefits", "testimonials", "faq", "conversion_cta"].includes(section.sectionType)), instruction) });
  if (flags.landing && !pages.some((page) => page.type === "landing")) pages.push({ type: "landing", name: "Campanha", purpose: "Concentrar uma oferta e uma única próxima ação.", pathSuggestion: "/campanha", conversionGoalId: primary?.id, sections: bindInstructionToSections(project, recommendSections({ ...shape, hasCatalog: flags.catalog || shape.hasCatalog }), instruction).filter((section) => ["hero", "products", "services", "benefits", "testimonials", "conversion_cta"].includes(section.sectionType)) });
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
    pages: proposedPages(project, instruction),
    primaryConversionGoals: recommendConversionStrategy(shape),
    catalogStrategy: chooseCatalogStrategy(shape.productCount),
    contentStrategy: [`densidade_${density}`, "fontes comerciais vinculadas", "conteúdo verificável antes de prova social"],
    visualDirection: recommendVisualDirection(shape),
    warnings,
  };
}

function findExistingPage(project: Project, page: SuggestedPage, targetPageId?: string) {
  if (targetPageId) return project.presence?.pages.find((candidate) => candidate.id === targetPageId);
  return project.presence?.pages.find((candidate) => page.type === "home" ? candidate.isHome : candidate.path === page.pathSuggestion || candidate.name.toLocaleLowerCase("pt-BR") === page.name.toLocaleLowerCase("pt-BR"));
}

function semanticOperations(project: Project, pages: SuggestedPage[], intent: SiteComposerIntent, targetPageId?: string): SiteOperation[] {
  const operations: SiteOperation[] = [];
  pages.forEach((page, pageIndex) => {
    const existing = findExistingPage(project, page, targetPageId);
    if (!existing) { operations.push({ id: `add-page-${pageIndex}-${slug(page.name)}`, type: "add_page", page }); return; }
    const availableByType = new Map<string, typeof existing.sections>();
    existing.sections.toSorted((a, b) => a.order - b.order).forEach((section) => availableByType.set(section.type, [...(availableByType.get(section.type) || []), section]));
    const retained = new Set<string>();
    page.sections.forEach((section, index) => {
      const current = availableByType.get(section.sectionType)?.shift();
      if (!current) { operations.push({ id: `add-section-${existing.id}-${section.sectionType}-${index}`, type: "add_section", pageId: existing.id, section, at: index }); return; }
      retained.add(current.id);
      const patch = { title: section.purpose, content: { ...current.content, ...section.suggestedContent }, settings: { ...current.settings, sourceBindings: section.sourceBindings } };
      if (JSON.stringify(current.content) !== JSON.stringify(patch.content) || current.title !== patch.title || JSON.stringify((current.settings as { sourceBindings?: string[] }).sourceBindings || []) !== JSON.stringify(section.sourceBindings)) operations.push({ id: `update-section-${current.id}`, type: "update_section", pageId: existing.id, sectionId: current.id, patch });
      if (current.order !== index) operations.push({ id: `move-section-${current.id}-${index}`, type: "move_section", pageId: existing.id, sectionId: current.id, to: index });
      if (section.conversionGoalId && section.priority === "essential" && existing.defaultConversionGoalId !== section.conversionGoalId) operations.push({ id: `connect-goal-${existing.id}-${section.conversionGoalId}`, type: "connect_goal", pageId: existing.id, sectionId: current.id, conversionGoalId: section.conversionGoalId });
    });
    const shouldRemove = intent === "reorganize";
    existing.sections.forEach((section) => {
      const duplicate = existing.sections.filter((candidate) => candidate.type === section.type).length > 1 && !retained.has(section.id);
      if (duplicate || (shouldRemove && !retained.has(section.id))) operations.push({ id: `remove-section-${section.id}`, type: "remove_section", pageId: existing.id, sectionId: section.id });
    });
  });
  return operations;
}

export function createSiteStructureProposal(project: Project, target: "site" | "page", instruction = "", pageId?: string, aiSuggestion?: SuggestedSiteStructure, intent: SiteComposerIntent = "suggest_structure"): SiteStructureProposal {
  const suggestion = aiSuggestion || suggestSiteStructure(project, instruction);
  const pages = target === "page" ? suggestion.pages.filter((page) => project.presence?.pages.find((candidate) => candidate.id === pageId)?.isHome === (page.type === "home")) : suggestion.pages;
  const operations = semanticOperations(project, pages, intent, pageId);
  return {
    proposalId: crypto.randomUUID(), projectId: project.id, expectedVersion: project.version, target, pageId,
    suggestion: { ...suggestion, pages }, operations, createdAt: new Date().toISOString(), status: "pending", instruction,
  };
}
