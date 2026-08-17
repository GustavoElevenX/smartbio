import type { DataRequirement, Project } from "@/types";
import { presencePageSchema } from "./presence-page.schema";
import { getSectionActions } from "./presence-page-utils";

export function getPresenceReadinessIssues(project: Project): DataRequirement[] {
  const pages = project.presence?.pages || [];
  if (!pages.length) return [];
  const issues: DataRequirement[] = [];
  const path = `/app/projects/${project.id}/site`;
  const pageIds = new Set(pages.map((page) => page.id));
  const goalIds = new Set((project.conversionGoals || []).filter((goal) => goal.isActive).map((goal) => goal.id));
  if (pages.filter((page) => page.isHome).length !== 1) issues.push({ id: `${project.id}:presence.home`, key: "presence.home", label: "Página inicial inválida", capability: "project", status: "invalid", severity: "blocking", reason: "Defina exatamente uma página inicial.", actionLabel: "Corrigir", actionPath: path });
  for (const page of pages.filter((item) => item.isActive)) {
    const parsed = presencePageSchema.safeParse(page);
    if (!parsed.success) issues.push({ id: `${project.id}:presence.page.${page.id}`, key: `presence.page.${page.id}`, label: `Página “${page.name}” incompleta`, capability: "project", status: "invalid", severity: "blocking", reason: parsed.error.issues[0]?.message || "Revise a estrutura da página.", actionLabel: "Corrigir", actionPath: path });
    for (const section of page.sections.filter((item) => item.isActive)) {
      for (const action of getSectionActions(section)) {
        if (action.type === "start_conversion_goal" && (!action.conversionGoalId || !goalIds.has(action.conversionGoalId))) issues.push({ id: `${project.id}:presence.action.${section.id}`, key: `presence.action.${section.id}`, label: "CTA sem meta válida", capability: "project", status: "invalid", severity: "blocking", reason: `A seção “${section.title || section.key}” aponta para uma meta inexistente.`, actionLabel: "Corrigir", actionPath: path });
        if (action.type === "go_to_presence_page" && (!action.pageId || !pageIds.has(action.pageId))) issues.push({ id: `${project.id}:presence.action.${section.id}`, key: `presence.action.${section.id}`, label: "CTA sem página válida", capability: "project", status: "invalid", severity: "blocking", reason: `A seção “${section.title || section.key}” aponta para uma página inexistente.`, actionLabel: "Corrigir", actionPath: path });
        if (action.type === "open_url" && (!action.url || !/^https?:\/\//i.test(action.url))) issues.push({ id: `${project.id}:presence.url.${section.id}`, key: `presence.url.${section.id}`, label: "CTA com URL inválida", capability: "project", status: "invalid", severity: "blocking", reason: `Use uma URL completa em “${section.title || section.key}”.`, actionLabel: "Corrigir", actionPath: path });
        if (action.type === "open_whatsapp" && !/^\+?[1-9]\d{7,14}$/.test((action.whatsappPhone || "").replace(/[\s().-]/g, ""))) issues.push({ id: `${project.id}:presence.phone.${section.id}`, key: `presence.phone.${section.id}`, label: "CTA com telefone inválido", capability: "project", status: "invalid", severity: "blocking", reason: `Revise o WhatsApp em “${section.title || section.key}”.`, actionLabel: "Corrigir", actionPath: path });
        if (action.type === "start_activation" && !action.activationId) issues.push({ id: `${project.id}:presence.activation.${section.id}`, key: `presence.activation.${section.id}`, label: "CTA sem ativação", capability: "project", status: "invalid", severity: "blocking", reason: `Selecione uma ativação ativa ou agendada em “${section.title || section.key}”.`, actionLabel: "Corrigir", actionPath: path });
      }
    }
  }
  return issues;
}
