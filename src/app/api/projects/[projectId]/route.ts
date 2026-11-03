import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  validationError,
} from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { assertProjectAccess } from "@/server/auth/project-access";
import { requireResourceCapacity } from "@/server/entitlements/require-entitlement";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import type { Project } from "@/types";
import { recordPlatformGrowthEvent } from "@/server/platform-acquisition/platform-acquisition";
import { saveLocalProject } from "@/server/projects/local-project-store";
import { findDemoProject } from "@/data/demo-projects";

const projectSchema = z.custom<Project>(
  (value) =>
    Boolean(
      value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "slug" in value &&
      "steps" in value,
    ),
  "Projeto inválido.",
);

type ProjectSaveError = { code?: string; message?: string; details?: string; hint?: string } | null;

function isSlugConflict(error: ProjectSaveError) {
  const description = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return error?.code === "23505" && description.includes("slug");
}

function collisionSafeSlug(slug: string, projectId: string) {
  return `${slug.replace(/-[0-9a-f]{8}$/i, "")}-${projectId.slice(0, 8).toLowerCase()}`;
}

export const GET = withAuthenticatedActor(
  async (
    _request,
    context: RouteContext<"/api/projects/[projectId]">,
    actor,
  ) => {
    const { projectId } = await context.params;
    return apiSuccess(await loadProjectForActor(actor, projectId));
  },
);

export const PUT = withAuthenticatedActor(
  async (
    request,
    context: RouteContext<"/api/projects/[projectId]">,
    actor,
  ) => {
    const parsed = projectSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return validationError(parsed.error);
    const { projectId } = await context.params;
    if (parsed.data.id !== projectId)
      return apiError(
        "O projeto informado não corresponde à rota.",
        400,
        "project_id_mismatch",
      );

    if (actor.persistence === "memory") {
      if (parsed.data.workspaceId === "demo-workspace" && findDemoProject(parsed.data.slug)?.id === projectId) return apiSuccess(saveLocalProject({ ...parsed.data, workspaceId: actor.workspaceId }));
      if (parsed.data.workspaceId !== actor.workspaceId) return apiError("Workspace inválido.", 403, "workspace_access_denied");
      return apiSuccess(saveLocalProject(parsed.data));
    }

    const db = createServiceClient()!;
    const { data: existing, error: lookupError } = await db
      .from("projects")
      .select("id,workspace_id,settings,status")
      .eq("id", projectId)
      .maybeSingle();
    if (lookupError)
      return apiError(
        "Não foi possível verificar o projeto.",
        500,
        "project_lookup_failed",
      );

    if (existing) {
      await assertProjectAccess(actor, projectId, "write");
    } else {
      if (
        parsed.data.workspaceId &&
        parsed.data.workspaceId !== actor.workspaceId
      )
        return apiError("Workspace inválido.", 403, "workspace_access_denied");
      await requireResourceCapacity({
        database: db,
        workspaceId: actor.workspaceId,
        feature: "projects",
      });
    }

    const now = new Date().toISOString();
    let project: Project = {
      ...parsed.data,
      workspaceId: actor.workspaceId,
      updatedAt: now,
    };
    const previousSettings =
      existing?.settings && typeof existing.settings === "object"
        ? (existing.settings as Record<string, unknown>)
        : {};
    const previousPayload = previousSettings.projectPayload as Project | undefined;
    const configurationChanged = ["commercialConfig", "capabilities", "dataRequirements"].some((key) =>
      JSON.stringify(project[key as keyof Project]) !== JSON.stringify(previousPayload?.[key as keyof Project]),
    );
    // Existing projects use the transactional commercial writer so the sidebar
    // edits reach the same rows that operations and the next GET read.
    if (existing && configurationChanged) {
      const { data: commercialSaved, error: commercialError } = await db.rpc("save_project_commercial_data", {
        p_workspace_id: actor.workspaceId,
        p_project_id: project.id,
        p_actor_id: actor.userId,
        p_payload: {
          expectedProjectVersion: Number(previousSettings.version || 1),
          data: project.commercialConfig || {},
          capabilities: project.capabilities || [],
          dataRequirements: project.dataRequirements || [],
          deleted: {},
        },
      });
      if (commercialError) {
        console.error("commercial_save_failed", {
          code: commercialError.code,
          message: commercialError.message,
          projectId: project.id,
          workspaceId: actor.workspaceId,
        });
        return apiError("Não foi possível salvar a configuração comercial. Suas alterações continuam no editor; tente novamente.", 500, "commercial_save_failed");
      }
      project.version = Number(commercialSaved.version);
    } else if (existing) {
      project.version = Number(previousSettings.version || project.version || 1);
    }
    let settings = {
      ...previousSettings,
      subtitle: project.subtitle,
      primaryDestination: project.primaryDestination,
      audience: project.audience,
      phone: project.phone,
      visualDirection: project.visualDirection,
      version: project.version,
      projectPayload: project,
    };
    const projectRow = () => ({
      id: project.id,
      workspace_id: actor.workspaceId,
      name: project.name,
      slug: project.slug,
      description: project.description,
      status: project.status,
      primary_goal: project.primaryGoal,
      category: project.category || null,
      theme: project.designSystem,
      settings,
      published_at: project.publishedAt || null,
    });
    let { error: saveError } = await db.from("projects").upsert(projectRow());
    if (!existing && isSlugConflict(saveError)) {
      project = { ...project, slug: collisionSafeSlug(project.slug, project.id) };
      settings = { ...settings, projectPayload: project };
      ({ error: saveError } = await db.from("projects").upsert(projectRow()));
    }
    if (saveError)
      console.error("project_save_failed", { code: saveError.code, projectId: project.id, workspaceId: actor.workspaceId });
    if (saveError)
      return apiError(
        "Não foi possível salvar o projeto.",
        500,
        "project_save_failed",
      );

    const { error: brandError } = await db.from("brand_profiles").upsert(
      {
        project_id: project.id,
        primary_logo_asset_id: project.brand.primaryLogoAssetId || null,
        light_logo_asset_id: project.brand.lightLogoAssetId || null,
        dark_logo_asset_id: project.brand.darkLogoAssetId || null,
        favicon_asset_id: project.brand.faviconAssetId || null,
        extracted_colors: project.brand.extractedColors,
        active_palette: project.brand.activePalette,
        palette_variations: project.brand.paletteVariations,
        design_system: project.designSystem,
        brand_personality: project.brand.brandPersonality,
        analysis_metadata: project.brand.analysisMetadata || {},
        analyzed_at: now,
      },
      { onConflict: "project_id" },
    );
    if (brandError) {
      console.error("brand_save_failed", {
        code: brandError.code,
        message: brandError.message,
        projectId: project.id,
        workspaceId: actor.workspaceId,
      });
      return apiError(
        "O projeto foi salvo, mas a marca não pôde ser atualizada.",
        500,
        "brand_save_failed",
      );
    }

    if (!existing) {
      await recordPlatformGrowthEvent(db, {
        eventName: "project_created",
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        metadata: { projectId: project.id, projectName: project.name },
        idempotencyKey: `project_created:${project.id}`,
      }).catch(() => undefined);
      await recordPlatformGrowthEvent(db, {
        eventName: "onboarding_completed",
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        metadata: { projectId: project.id },
        idempotencyKey: `onboarding_completed:${actor.userId}`,
      }).catch(() => undefined);
    }
    await Promise.all(
      (project.presence?.pages || []).map((page) =>
        recordPlatformGrowthEvent(db, {
          eventName: "presence_page_created",
          userId: actor.userId,
          workspaceId: actor.workspaceId,
          metadata: { projectId: project.id, pageId: page.id, pageName: page.name },
          idempotencyKey: `presence_page_created:${page.id}`,
        }).catch(() => undefined),
      ),
    );

    if (actor.mode === "platform_support") {
      const beforePayload = previousSettings.projectPayload as
        Record<string, unknown> | undefined;
      const afterPayload = project as unknown as Record<string, unknown>;
      const changedFields = Object.keys(afterPayload).filter(
        (key) =>
          JSON.stringify(beforePayload?.[key]) !==
          JSON.stringify(afterPayload[key]),
      );
      await db.from("platform_admin_audit_log").insert({
        admin_user_id: actor.platform!.realUserId,
        admin_role: actor.platform!.role,
        support_session_id: actor.platform!.supportSessionId,
        workspace_id: actor.workspaceId,
        project_id: project.id,
        action: "project.updated_by_support",
        object_type: "project",
        object_id: project.id,
        before_state: {
          status: existing?.status,
          version: beforePayload?.version,
        },
        after_state: {
          status: project.status,
          version: project.version,
          changedFields,
        },
        request_id: request.headers.get("x-request-id") || crypto.randomUUID(),
      });
    }
    return apiSuccess(project);
  },
);

export const DELETE = withAuthenticatedActor(
  async (
    _request,
    context: RouteContext<"/api/projects/[projectId]">,
    actor,
  ) => {
    const { projectId } = await context.params;
    await assertProjectAccess(actor, projectId, "delete");
    const { error } = await createServiceClient()!
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("workspace_id", actor.workspaceId);
    if (error)
      return apiError(
        "Não foi possível excluir o projeto.",
        500,
        "project_delete_failed",
      );
    return apiSuccess({ id: projectId, deleted: true });
  },
);
