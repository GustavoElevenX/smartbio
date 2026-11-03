import { describe, expect, it } from "vitest";
import { presenceActionSchema } from "@/features/presence/presence-action.schema";
import { presencePageSchema } from "@/features/presence/presence-page.schema";
import { aiPresenceDraftSchema } from "@/features/presence/ai-presence.schema";
import { createPresencePage } from "@/features/presence/presence-page-service";
import { presenceSectionRegistry } from "@/features/presence/section-registry";
import { resolvePublicSurface } from "@/features/presence/resolve-public-surface";
import { getPresenceReadinessIssues } from "@/features/presence/presence-readiness";
import { getProjectReadiness } from "@/features/publishing/project-readiness";
import { buildConversionAnalytics } from "@/server/analytics/conversion-analytics";
import { createOpportunity } from "@/server/opportunities/factory";
import { findDemoProject } from "@/data/demo-projects";
import { normalizeExternalUrl, safeExternalUrl } from "@/lib/external-url";

function projectWithPresence() {
  const project = structuredClone(findDemoProject("casadesucosmix")!);
  const goal = project.conversionGoals?.[0];
  const page = createPresencePage(project.id, "Início", "home");
  page.defaultConversionGoalId = goal?.id;
  for (const section of page.sections)
    if (section.type === "conversion_cta")
      section.content = {
        primaryAction: {
          type: "start_conversion_goal",
          label: "Começar",
          conversionGoalId: goal!.id,
        },
      };
  project.presence = { pages: [page] };
  return project;
}

describe("Presence domain", () => {
  it("keeps every supported section in the registry", () =>
    expect(Object.keys(presenceSectionRegistry)).toHaveLength(19));
  it("requires the destination appropriate to an action", () => {
    expect(
      presenceActionSchema.safeParse({ type: "open_url", label: "Abrir" })
        .success,
    ).toBe(false);
    expect(
      presenceActionSchema.safeParse({
        type: "open_url",
        label: "Abrir",
        url: "https://virou.app",
      }).success,
    ).toBe(true);
  });
  it("normalizes external links and rejects unsafe protocols", () => {
    expect(normalizeExternalUrl(" exemplo.com/cardapio ")).toBe("https://exemplo.com/cardapio");
    expect(safeExternalUrl("exemplo.com/cardapio")).toBe("https://exemplo.com/cardapio");
    expect(safeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl("https://usuario:senha@exemplo.com")).toBeUndefined();
    expect(presenceActionSchema.safeParse({ type: "open_url", label: "Abrir", url: "javascript:alert(1)" }).success).toBe(false);
  });
  it("validates a complete generated page by section schema", () =>
    expect(
      presencePageSchema.safeParse(projectWithPresence().presence!.pages[0])
        .success,
    ).toBe(true));
  it("does not accept an unknown section type from AI", () =>
    expect(
      aiPresenceDraftSchema.safeParse({
        page: { name: "Home", type: "home" },
        sections: [
          { key: "hero", type: "raw_html", content: {} },
          { key: "cta", type: "divider", content: {} },
        ],
        rationale: [],
        missingRequirements: [],
      }).success,
    ).toBe(false));
  it("keeps legacy entry points on direct conversion", () => {
    const project = projectWithPresence();
    const legacy = {
      ...project.entryPoints![0],
      surfaceMode: undefined,
      presencePageId: undefined,
    };
    project.entryPoints = [legacy];
    expect(resolvePublicSurface(project, legacy.key).mode).toBe(
      "conversion_direct",
    );
  });
  it("resolves a landing entry to its selected page", () => {
    const project = projectWithPresence();
    const page = project.presence!.pages[0];
    project.entryPoints = [
      {
        ...project.entryPoints![0],
        surfaceMode: "landing",
        presencePageId: page.id,
      },
    ];
    expect(
      resolvePublicSurface(project, project.entryPoints[0].key),
    ).toMatchObject({ mode: "landing", page: { id: page.id } });
  });
  it("opens the link da bio at the main URL even when an old home page exists", () => {
    const project = projectWithPresence();
    expect(resolvePublicSurface(project)).toEqual({ mode: "conversion_direct" });
  });
  it("can publish the complete guided experience at the main URL", () => {
    const project = projectWithPresence();
    project.publication = { homeMode: "journey" };
    expect(resolvePublicSurface(project)).toEqual({ mode: "conversion_direct" });
  });
  it("can publish a specific conversion path at the main URL", () => {
    const project = projectWithPresence();
    const goal = project.conversionGoals![0];
    project.publication = { homeMode: "goal", conversionGoalId: goal.id };
    expect(resolvePublicSurface(project)).toMatchObject({
      mode: "conversion_direct",
      conversionGoalId: goal.id,
      targetStepId: goal.targetStepId,
    });
  });
  it("can publish one selected journey page at the main URL", () => {
    const project = projectWithPresence();
    const step = project.steps.find((item) => item.isActive)!;
    project.publication = { homeMode: "step", initialStepId: step.id };
    expect(resolvePublicSurface(project)).toEqual({
      mode: "conversion_direct",
      targetStepId: step.id,
    });
  });
  it("keeps explicit campaign entries above the main publication choice", () => {
    const project = projectWithPresence();
    const page = project.presence!.pages[0];
    project.publication = { homeMode: "journey" };
    project.entryPoints = [{
      ...project.entryPoints![0],
      surfaceMode: "presence",
      presencePageId: page.id,
    }];
    expect(resolvePublicSurface(project, project.entryPoints[0].key)).toMatchObject({
      mode: "presence",
      page: { id: page.id },
    });
  });
  it("blocks publication when a Presence CTA points to a missing goal", () => {
    const project = projectWithPresence();
    const cta = project.presence!.pages[0].sections.find(
      (section) => section.type === "conversion_cta",
    )!;
    cta.content = {
      primaryAction: {
        type: "start_conversion_goal",
        label: "Começar",
        conversionGoalId: "missing",
      },
    };
    expect(
      getPresenceReadinessIssues(project).some((issue) =>
        issue.key.includes("presence.action"),
      ),
    ).toBe(true);
  });
  it("does not block a guided publication because of an unused site CTA", () => {
    const project = projectWithPresence();
    const cta = project.presence!.pages[0].sections.find(
      (section) => section.type === "conversion_cta",
    )!;
    cta.content = {
      primaryAction: {
        type: "start_conversion_goal",
        label: "Começar",
        conversionGoalId: "missing",
      },
    };
    project.publication = { homeMode: "journey" };
    expect(
      getProjectReadiness(project).blocking.some((issue) =>
        issue.key.includes("presence.action"),
      ),
    ).toBe(false);
  });
});

describe("Presence attribution", () => {
  it("aggregates page views, CTA clicks and conversion starts", () => {
    const project = projectWithPresence();
    const page = project.presence!.pages[0];
    const base = {
      projectId: project.id,
      visitorId: "v",
      presencePageId: page.id,
      createdAt: new Date().toISOString(),
    };
    const analytics = buildConversionAnalytics({
      events: [
        { ...base, id: "1", sessionId: "s", eventName: "presence_page_viewed" },
        { ...base, id: "2", sessionId: "s", eventName: "presence_cta_clicked" },
        {
          ...base,
          id: "3",
          sessionId: "s",
          eventName: "presence_conversion_started",
        },
      ],
      opportunities: [],
      pages: [page],
    });
    expect(analytics.byPage[0]).toMatchObject({
      views: 1,
      intentions: 0,
      ctaClicks: 1,
      conversionStarts: 1,
      startRate: 100,
    });
  });
  it("propagates page and section from attribution into an opportunity", () =>
    expect(
      createOpportunity({
        workspaceId: "w",
        projectId: "p",
        sourceType: "lead",
        sourceId: "lead",
        title: "Lead",
        attribution: {
          source: "site",
          presencePageId: "page",
          presenceSectionId: "hero",
        },
      }),
    ).toMatchObject({ presencePageId: "page", presenceSectionId: "hero" }));
});
