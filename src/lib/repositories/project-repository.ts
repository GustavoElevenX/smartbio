"use client";

import { localStore } from "@/lib/local-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { canUseLocalStore } from "@/lib/runtime-mode";
import type { FormField, JourneyStep, Project, StepOption } from "@/types";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function uuid() {
  return crypto.randomUUID();
}

function normalizeIds(project: Project): Project {
  if (isUuid(project.id) && project.steps.every((step) => isUuid(step.id)))
    return project;
  const projectId = isUuid(project.id) ? project.id : uuid();
  const stepIds = new Map(
    project.steps.map((step) => [step.id, isUuid(step.id) ? step.id : uuid()]),
  );
  const steps = project.steps.map((step): JourneyStep => ({
    ...step,
    id: stepIds.get(step.id)!,
    options: step.options?.map((option): StepOption => ({
      ...option,
      id: isUuid(option.id) ? option.id : uuid(),
      targetStepId: option.targetStepId
        ? stepIds.get(option.targetStepId) || option.targetStepId
        : undefined,
    })),
    formFields: step.formFields?.map((field): FormField => ({
      ...field,
      id: isUuid(field.id) ? field.id : uuid(),
    })),
    blocks: step.blocks?.map((block) => ({
      ...block,
      id: isUuid(block.id) ? block.id : uuid(),
    })),
  }));
  const goalIds = new Map(
    (project.conversionGoals || []).map((goal) => [
      goal.id,
      isUuid(goal.id) ? goal.id : uuid(),
    ]),
  );
  const conversionGoals = project.conversionGoals?.map((goal) => ({
    ...goal,
    id: goalIds.get(goal.id)!,
    projectId,
    targetStepId: stepIds.get(goal.targetStepId) || goal.targetStepId,
  }));
  const pageIds = new Map(
    (project.presence?.pages || []).map((page) => [
      page.id,
      isUuid(page.id) ? page.id : uuid(),
    ]),
  );
  const rewritePresenceRefs = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(rewritePresenceRefs)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([key, child]) => [
              key,
              key === "conversionGoalId" && typeof child === "string"
                ? goalIds.get(child) || child
                : key === "pageId" && typeof child === "string"
                  ? pageIds.get(child) || child
                  : rewritePresenceRefs(child),
            ]),
          )
        : value;
  const presence = project.presence
    ? {
        pages: project.presence.pages.map((page) => {
          const pageId = pageIds.get(page.id)!;
          return {
            ...page,
            id: pageId,
            projectId,
            defaultConversionGoalId: page.defaultConversionGoalId
              ? goalIds.get(page.defaultConversionGoalId) ||
                page.defaultConversionGoalId
              : undefined,
            settings: rewritePresenceRefs(
              page.settings,
            ) as typeof page.settings,
            sections: page.sections.map((section) => ({
              ...section,
              id: isUuid(section.id) ? section.id : uuid(),
              pageId,
              content: rewritePresenceRefs(section.content) as Record<
                string,
                unknown
              >,
              settings: rewritePresenceRefs(section.settings) as Record<
                string,
                unknown
              >,
            })),
          };
        }),
      }
    : undefined;
  const entryPoints = project.entryPoints?.map((entry) => ({
    ...entry,
    id: isUuid(entry.id) ? entry.id : uuid(),
    projectId,
    conversionGoalId: entry.conversionGoalId
      ? goalIds.get(entry.conversionGoalId) || entry.conversionGoalId
      : undefined,
    targetStepId: entry.targetStepId
      ? stepIds.get(entry.targetStepId) || entry.targetStepId
      : undefined,
    presencePageId: entry.presencePageId
      ? pageIds.get(entry.presencePageId) || entry.presencePageId
      : undefined,
  }));
  for (const step of steps)
    for (const option of step.options || [])
      if (option.conversionGoalId)
        option.conversionGoalId =
          goalIds.get(option.conversionGoalId) || option.conversionGoalId;
  const commercialConfig = project.commercialConfig
    ? structuredClone(project.commercialConfig)
    : undefined;
  if (commercialConfig) {
    for (const rule of commercialConfig.qualificationRules || []) {
      rule.id = isUuid(rule.id) ? rule.id : uuid();
      rule.projectId = projectId;
    }
    if (commercialConfig.quoteDefinition) {
      commercialConfig.quoteDefinition.id = isUuid(
        commercialConfig.quoteDefinition.id,
      )
        ? commercialConfig.quoteDefinition.id
        : uuid();
      commercialConfig.quoteDefinition.projectId = projectId;
      for (const rule of commercialConfig.quoteDefinition.rules || [])
        rule.id = isUuid(rule.id) ? rule.id : uuid();
    }
    const collections = [
      commercialConfig.serviceOfferings,
      commercialConfig.schedulableServices,
      commercialConfig.resources,
      commercialConfig.availabilityRules,
      commercialConfig.availabilityExceptions,
      commercialConfig.catalogCategories,
      commercialConfig.catalogItems,
      commercialConfig.reservableUnits,
      commercialConfig.reservationBlocks,
      commercialConfig.routingRules,
      commercialConfig.policies,
    ];
    for (const collection of collections)
      for (const item of collection || []) {
        item.id = isUuid(item.id) ? item.id : uuid();
        item.projectId = projectId;
      }
    const locationIds = new Map<string, string>();
    for (const location of commercialConfig.locations || []) {
      const previousId = location.id;
      location.id = isUuid(location.id) ? location.id : uuid();
      location.projectId = projectId;
      locationIds.set(previousId, location.id);
    }
    const destinationIds = new Map<string, string>();
    for (const destination of commercialConfig.routingDestinations || []) {
      const previousId = destination.id;
      destination.id = isUuid(destination.id) ? destination.id : uuid();
      if (destination.locationId) destination.locationId = locationIds.get(destination.locationId) || destination.locationId;
      destinationIds.set(previousId, destination.id);
    }
    for (const location of commercialConfig.locations || []) {
      if (location.routingDestinationId) location.routingDestinationId = destinationIds.get(location.routingDestinationId) || location.routingDestinationId;
    }
    for (const rule of commercialConfig.routingRules || []) {
      rule.destinationId = destinationIds.get(rule.destinationId) || rule.destinationId;
      if (typeof rule.condition.value !== "string") continue;
      if (rule.condition.field === "location_id") rule.condition.value = locationIds.get(rule.condition.value) || rule.condition.value;
      if (rule.condition.field === "journey_route") {
        const separator = rule.condition.value.lastIndexOf(":");
        if (separator > 0) {
          const blueprintId = rule.condition.value.slice(0, separator);
          const locationId = rule.condition.value.slice(separator + 1);
          rule.condition.value = `${blueprintId}:${locationIds.get(locationId) || locationId}`;
        }
      }
    }
    for (const step of steps) for (const option of step.options || []) {
      const destinationId = typeof option.actionPayload?.destinationId === "string" ? option.actionPayload.destinationId : undefined;
      if (destinationId && destinationIds.has(destinationId)) option.actionPayload = { ...option.actionPayload, destinationId: destinationIds.get(destinationId)! };
    }
  }
  return {
    ...project,
    id: projectId,
    steps,
    conversionGoals,
    entryPoints,
    presence,
    commercialConfig,
  };
}

export const projectRepository = {
  async getProjects(): Promise<Project[]> {
    if (canUseLocalStore()) return localStore.getProjects();
    if (!isSupabaseConfigured()) return [];
    const response = await fetch("/api/projects", { cache: "no-store" });
    const payload = (await response.json()) as {
      data?: Project[];
      error?: { message?: string };
    };
    if (!response.ok)
      throw new Error(
        payload.error?.message || "Não foi possível carregar os projetos.",
      );
    return payload.data || [];
  },
  async getProject(value: string): Promise<Project | undefined> {
    if (canUseLocalStore()) return localStore.getProject(value);
    if (!isSupabaseConfigured()) return undefined;
    if (!isUuid(value))
      return (await this.getProjects()).find(
        (project) => project.slug === value,
      );
    const response = await fetch(`/api/projects/${encodeURIComponent(value)}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      data?: Project | null;
      error?: { message?: string };
    };
    if (!response.ok)
      throw new Error(
        payload.error?.message || "Não foi possível carregar o projeto.",
      );
    return payload.data || undefined;
  },
  async saveProject(project: Project): Promise<Project> {
    if (canUseLocalStore()) return localStore.saveProject(project);
    if (!isSupabaseConfigured())
      throw new Error("Persistência indisponível. Configure o Supabase.");
    const normalized = normalizeIds(project);
    const response = await fetch(
      `/api/projects/${encodeURIComponent(normalized.id)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(normalized),
      },
    );
    const payload = (await response.json()) as {
      data?: Project;
      error?: { message?: string };
    };
    if (!response.ok || !payload.data)
      throw new Error(
        payload.error?.message || "Não foi possível salvar o projeto.",
      );
    return payload.data;
  },
  async deleteProject(id: string) {
    if (canUseLocalStore()) {
      localStore.deleteProject(id);
      return;
    }
    if (!isSupabaseConfigured())
      throw new Error("Persistência indisponível. Configure o Supabase.");
    if (!isUuid(id)) return;
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      throw new Error(
        payload.error?.message || "Não foi possível excluir o projeto.",
      );
    }
  },
};
