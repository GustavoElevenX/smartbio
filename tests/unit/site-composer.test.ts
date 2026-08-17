import { describe, expect, it } from "vitest";
import { casaDeSucos } from "@/data/demo-projects";
import { inferBusinessShape } from "@/features/site-composer/business-shape";
import { chooseCatalogStrategy } from "@/features/site-composer/catalog-strategy";
import { createSiteStructureProposal, suggestSiteStructure } from "@/features/site-composer/site-structure-suggester";
import { fortyProductCatalog } from "../fixtures/large-catalog";
import type { Project } from "@/types";
import { createPresencePage } from "@/features/presence/presence-page-service";

function vertical(category: string, config: Partial<NonNullable<Project["commercialConfig"]>> = {}): Project {
  return { ...structuredClone(casaDeSucos), id: `vertical-${category}`, category, commercialConfig: { ...structuredClone(casaDeSucos.commercialConfig), catalogItems: [], serviceOfferings: [], locations: [], ...config } };
}

describe("adaptive site composer", () => {
  it.each([
    ["varejo", vertical("varejo", { catalogItems: fortyProductCatalog })],
    ["serviços", vertical("serviços", { serviceOfferings: casaDeSucos.commercialConfig?.serviceOfferings })],
    ["misto", vertical("misto", { catalogItems: fortyProductCatalog.slice(0, 4), serviceOfferings: casaDeSucos.commercialConfig?.serviceOfferings })],
    ["hotel", vertical("hotel e pousada")],
    ["profissional", vertical("consultoria profissional")],
    ["b2b", vertical("indústria b2b")],
    ["local", vertical("loja local", { locations: casaDeSucos.commercialConfig?.locations })],
    ["desconhecido", vertical("")],
  ])("keeps structural invariants for %s", (_label, project) => {
    const suggestion = suggestSiteStructure(project);
    expect(suggestion.pages[0].type).toBe("home");
    expect(suggestion.pages[0].sections[0].sectionType).toBe("hero");
    expect(suggestion.pages[0].sections.at(-1)?.sectionType).toBe("conversion_cta");
    expect(suggestion.pages.every((page) => page.pathSuggestion.startsWith("/"))).toBe(true);
    expect(inferBusinessShape(project).productCount).toBeGreaterThanOrEqual(0);
  });

  it("produces perceptibly different compositions across representative verticals", () => {
    const projects = [
      vertical("varejo", { catalogItems: fortyProductCatalog }),
      vertical("serviços", { serviceOfferings: casaDeSucos.commercialConfig?.serviceOfferings }),
      vertical("misto", { catalogItems: fortyProductCatalog.slice(0, 4), serviceOfferings: casaDeSucos.commercialConfig?.serviceOfferings }),
      vertical("hotel e pousada"),
      vertical("consultoria profissional"),
      vertical("indústria b2b"),
      vertical("loja local", { locations: casaDeSucos.commercialConfig?.locations }),
      vertical(""),
    ];
    const signatures = projects.map((project) => {
      const home = suggestSiteStructure(project).pages[0];
      const hero = home.sections.find((section) => section.sectionType === "hero");
      return `${hero?.suggestedContent.variant}:${home.sections.map((section) => section.sectionType).join(",")}`;
    });
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(4);
  });

  it("uses configurable catalog thresholds", () => {
    expect(chooseCatalogStrategy(8)).toBe("inline_all");
    expect(chooseCatalogStrategy(9)).toBe("featured_then_catalog");
    expect(chooseCatalogStrategy(31)).toBe("categories_then_catalog");
    expect(chooseCatalogStrategy(101)).toBe("search_first");
    expect(chooseCatalogStrategy(3, { inlineMax: 2, featuredMax: 4, categoriesMax: 6 })).toBe("featured_then_catalog");
  });

  it("creates a proposal without mutating or applying the project", () => {
    const project = vertical("varejo", { catalogItems: fortyProductCatalog });
    const before = structuredClone(project);
    const proposal = createSiteStructureProposal(project, "site");
    expect(proposal.status).toBe("pending");
    expect(proposal.operations.length).toBeGreaterThan(0);
    expect(project).toEqual(before);
  });

  it("turns a B2B instruction into a materially different proposal", () => {
    const project = vertical("varejo", { catalogItems: fortyProductCatalog });
    const baseline = suggestSiteStructure(project, "Quero foco em delivery");
    const b2b = suggestSiteStructure(project, "Quero uma landing para revendedores e sem FAQ");
    expect(b2b.pages.some((page) => page.pathSuggestion === "/revenda")).toBe(true);
    expect(b2b.pages.flatMap((page) => page.sections).some((section) => section.sectionType === "benefits")).toBe(true);
    expect(b2b.pages.flatMap((page) => page.sections).some((section) => section.sectionType === "faq")).toBe(false);
    expect(b2b).not.toEqual(baseline);
  });

  it("creates source bindings and a semantic diff without appending a duplicate hero", () => {
    const project = structuredClone(casaDeSucos);
    project.presence = { pages: [createPresencePage(project.id, "Início", "home")] };
    const proposal = createSiteStructureProposal(project, "site", "Destaque os produtos e reorganize", undefined, undefined, "reorganize");
    const home = project.presence?.pages.find((page) => page.isHome);
    expect(proposal.suggestion.pages.flatMap((page) => page.sections).find((section) => section.sectionType === "products")?.sourceBindings).toContain("commercialConfig.catalogItems");
    expect(proposal.operations.some((operation) => operation.type === "add_section" && operation.pageId === home?.id && operation.section.sectionType === "hero")).toBe(false);
    expect(proposal.operations.some((operation) => operation.type === "update_section" || operation.type === "move_section")).toBe(true);
  });
});
