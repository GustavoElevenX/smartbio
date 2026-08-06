import "server-only";

import { getProjectReadiness, type ProjectReadinessResult } from "@/features/publishing/project-readiness";
import { createServiceClient } from "@/lib/supabase/server";
import { createProjectSnapshot } from "@/server/ai-editing/project-snapshots";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { publishProjectMedia, validateProjectMediaReferences } from "@/server/media/publish-project-media";
import { createCommercialNotification } from "@/server/notifications/notification-service";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import type { DataRequirement, Project } from "@/types";
import { revalidatePath } from "next/cache";

function addBlocking(
  readiness: ProjectReadinessResult,
  requirement: DataRequirement,
): ProjectReadinessResult {
  if (readiness.blocking.some((item) => item.key === requirement.key)) return readiness;
  return {
    ...readiness,
    publishable: false,
    blocking: [...readiness.blocking, requirement],
  };
}

async function serverReadiness(
  actor: AuthenticatedActor,
  project: Project,
) {
  let readiness = getProjectReadiness(project);
  if (actor.persistence === "memory") return readiness;
  const supabase = createServiceClient();
  if (!supabase) return readiness;

  const media = await validateProjectMediaReferences(actor, project);
  if (media.missing.length) {
    readiness = addBlocking(readiness, {
      id: `${project.id}:media.references`,
      key: "media.references",
      label: "Mídia removida ou incompleta",
      capability: "project",
      status: "invalid",
      severity: "blocking",
      reason: "Substitua as imagens referenciadas que não existem ou ainda não foram processadas.",
      actionLabel: "Abrir biblioteca",
      actionPath: `/app/projects/${project.id}/media`,
    });
  }

  const sourceIds = [...new Set((project.dataRequirements || [])
    .map((item) => item.fieldMetadata?.sourceId || item.sourceId)
    .filter((value): value is string => Boolean(value)))];
  if (sourceIds.length) {
    const { data: sources } = await supabase
      .from("business_sources")
      .select("id,status")
      .eq("workspace_id", actor.workspaceId)
      .in("id", sourceIds);
    const processed = new Set(
      (sources || []).filter((item) => item.status === "processed").map((item) => item.id),
    );
    const pendingUsed = sourceIds.filter((id) => !processed.has(id));
    if (pendingUsed.length) {
      readiness = addBlocking(readiness, {
        id: `${project.id}:sources.pending-used`,
        key: "sources.pending-used",
        label: "Fonte pendente usada como fato",
        capability: "project",
        status: "invalid",
        severity: "blocking",
        reason: "Aguarde o processamento e revise as evidências antes de publicar.",
        actionLabel: "Revisar fontes",
        actionPath: `/app/projects/${project.id}/data?tab=integrity`,
      });
    }
  }
  return readiness;
}

async function notify(
  actor: AuthenticatedActor,
  project: Project,
  eventKey: "project.publish_blocked" | "project.published",
  data: Record<string, unknown>,
) {
  if (actor.persistence === "memory") return;
  try {
    await createCommercialNotification({
      workspaceId: actor.workspaceId,
      projectId: project.id,
      eventKey,
      objectType: "project",
      objectId: project.id,
      recipientUserIds: [actor.userId],
      data,
    });
  } catch (error) {
    console.error("project_notification_failed", {
      projectId: project.id,
      eventKey,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function prepareProjectPublication(
  actor: AuthenticatedActor,
  projectId: string,
  localSnapshot?: Project,
) {
  const project = actor.persistence === "memory"
    ? localSnapshot
    : await loadProjectForActor(actor, projectId);
  if (!project || project.id !== projectId || project.workspaceId !== actor.workspaceId) {
    throw new Error("Projeto não encontrado.");
  }
  const readiness = await serverReadiness(actor, project);
  if (!readiness.publishable) {
    await notify(actor, project, "project.publish_blocked", {
      blockerCount: readiness.blocking.length,
    });
    return { published: false as const, readiness, project };
  }
  return { published: false as const, readiness, project };
}

export async function publishProject(
  actor: AuthenticatedActor,
  projectId: string,
  localSnapshot?: Project,
) {
  const prepared = await prepareProjectPublication(actor, projectId, localSnapshot);
  if (!prepared.readiness.publishable) return prepared;

  await createProjectSnapshot(actor, projectId, prepared.project, "project.published");
  const withPublicMedia = await publishProjectMedia(actor, prepared.project);
  const now = new Date().toISOString();
  const published: Project = {
    ...withPublicMedia,
    status: "published",
    publishedAt: now,
    updatedAt: now,
    version: Math.max(1, withPublicMedia.version + 1),
  };

  if (actor.persistence === "database") {
    const supabase = createServiceClient();
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data: row } = await supabase
      .from("projects")
      .select("settings")
      .eq("id", projectId)
      .eq("workspace_id", actor.workspaceId)
      .maybeSingle();
    const settings = row?.settings && typeof row.settings === "object"
      ? row.settings as Record<string, unknown>
      : {};
    const { error } = await supabase
      .from("projects")
      .update({
        status: "published",
        published_at: now,
        settings: {
          ...settings,
          version: published.version,
          publishedPayload: published,
        },
      })
      .eq("id", projectId)
      .eq("workspace_id", actor.workspaceId);
    if (error) throw new Error("Não foi possível publicar o projeto.");
    revalidatePath(`/${published.slug}`);
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  await notify(actor, published, "project.published", {
    name: published.name,
    url: `${appUrl}/${published.slug}`,
  });
  return { published: true as const, readiness: prepared.readiness, project: published };
}
