import { getProjectReadiness, type ProjectReadinessResult } from "@/features/publishing/project-readiness";
import type { PresenceAction } from "@/features/presence/presence.types";
import type { DataRequirement, Project } from "@/types";

export interface ReadinessPresentationItem {
  id: string;
  status: "complete" | "needs_action" | "warning";
  title: string;
  description: string;
  actionLabel?: string;
  actionPath?: string;
}

export interface ReadinessPresentation {
  ready: number;
  total: number;
  publishable: boolean;
  items: ReadinessPresentationItem[];
}

function actions(project: Project) {
  return (project.presence?.pages || []).flatMap((page) => page.sections.flatMap((section) => {
    const content = section.content as Record<string, unknown>;
    return ["primaryAction", "secondaryAction", "action", "itemAction", "nearestAction"]
      .map((key) => content[key])
      .filter((value): value is PresenceAction => Boolean(value && typeof value === "object" && "type" in value));
  }));
}

function humanIssue(project: Project, item: DataRequirement): ReadinessPresentationItem {
  const key = item.key.toLocaleLowerCase("pt-BR");
  if (key.includes("phone") || key.includes("whatsapp")) return {
    id: item.id,
    status: "needs_action",
    title: "Confirme o WhatsApp de atendimento",
    description: "A Sobe precisa saber para onde enviar quem escolher falar com você.",
    actionLabel: "Informar WhatsApp",
    actionPath: `/app/projects/${project.id}/settings#contact`,
  };
  if (key.includes("journey") || key.includes("step") || key.includes("target") || key.includes("capability")) return {
    id: item.id,
    status: "needs_action",
    title: "Complete o caminho desta ação",
    description: "Um dos botões ainda não sabe qual pergunta ou próximo passo deve abrir.",
    actionLabel: "Ajustar ação",
    actionPath: `/app/projects/${project.id}/site`,
  };
  if (key.includes("presence") || key.includes("page") || key.includes("cta")) return {
    id: item.id,
    status: "needs_action",
    title: "Revise uma ação da página",
    description: item.reason.replaceAll("CTA", "botão").replaceAll("jornada", "caminho"),
    actionLabel: "Editar página",
    actionPath: `/app/projects/${project.id}/site`,
  };
  if (key.startsWith("catalog") || key.startsWith("quote") || key.startsWith("service")) return {
    id: item.id,
    status: item.severity === "blocking" ? "needs_action" : "warning",
    title: key.startsWith("catalog") ? "Complete as informações dos produtos" : "Complete as informações desta oferta",
    description: item.reason.replaceAll("CTA", "botão").replaceAll("capacidade", "ação"),
    actionLabel: "Completar informações",
    actionPath: item.actionPath || `/app/projects/${project.id}/settings`,
  };
  if (key.startsWith("routing") || key.startsWith("reservation") || key.startsWith("scheduling")) return {
    id: item.id,
    status: item.severity === "blocking" ? "needs_action" : "warning",
    title: key.startsWith("routing") ? "Complete as informações das unidades" : "Complete disponibilidade e atendimento",
    description: item.reason.replaceAll("geocodifique", "confirme a localização de").replaceAll("Geocodifique", "Confirme a localização de"),
    actionLabel: "Resolver agora",
    actionPath: item.actionPath || `/app/projects/${project.id}/settings`,
  };
  return {
    id: item.id,
    status: item.severity === "blocking" ? "needs_action" : "warning",
    title: item.label.replaceAll("Projeto", "Negócio").replaceAll("CTA", "Botão").replaceAll("Jornada", "Caminho"),
    description: item.reason.replaceAll("project", "negócio").replaceAll("journey", "caminho").replaceAll("step", "pergunta").replaceAll("CTA", "botão"),
    actionLabel: "Resolver agora",
    actionPath: item.actionPath || `/app/projects/${project.id}/settings`,
  };
}

export function presentProjectReadiness(project: Project, result: ProjectReadinessResult = getProjectReadiness(project)): ReadinessPresentation {
  const pages = project.presence?.pages || [];
  const goalIds = new Set((project.conversionGoals || []).filter((goal) => goal.isActive).map((goal) => goal.id));
  const pageActions = actions(project);
  const connected = pageActions.length > 0 && pageActions.every((action) => action.type !== "start_conversion_goal" || Boolean(action.conversionGoalId && goalIds.has(action.conversionGoalId)));
  const base: ReadinessPresentationItem[] = [
    { id: "page", status: pages.some((page) => page.isHome && page.isActive) ? "complete" : "needs_action", title: "Página criada", description: "A primeira página do negócio está pronta para teste.", actionLabel: "Criar página", actionPath: `/app/projects/${project.id}/site` },
    { id: "actions", status: connected ? "complete" : "needs_action", title: "Ações conectadas", description: connected ? "Os botões levam a caminhos reais do negócio." : "Existe um botão sem um caminho válido.", actionLabel: "Ajustar ações", actionPath: `/app/projects/${project.id}/site` },
    { id: "information", status: project.name.trim() && project.description.trim() ? "complete" : "needs_action", title: "Informações principais preenchidas", description: "Nome e apresentação do negócio foram conferidos.", actionLabel: "Completar informações", actionPath: `/app/projects/${project.id}/settings` },
  ];
  const issueItems = [...result.blocking, ...result.warnings].map((item) => humanIssue(project, item));
  const items = [...base, ...issueItems];
  return { ready: items.filter((item) => item.status === "complete").length, total: items.length, publishable: result.publishable, items };
}
