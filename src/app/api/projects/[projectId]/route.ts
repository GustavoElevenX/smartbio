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
    if (actor.persistence === "memory")
      return apiError(
        "Persistência indisponível.",
        503,
        "persistence_unavailable",
      );
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
    const project: Project = {
      ...parsed.data,
      workspaceId: actor.workspaceId,
      updatedAt: now,
    };
    const previousSettings =
      existing?.settings && typeof existing.settings === "object"
        ? (existing.settings as Record<string, unknown>)
        : {};
    const settings = {
      ...previousSettings,
      subtitle: project.subtitle,
      primaryDestination: project.primaryDestination,
      audience: project.audience,
      phone: project.phone,
      visualDirection: project.visualDirection,
      version: project.version,
      projectPayload: project,
    };
    const { error: saveError } = await db.from("projects").upsert({
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
    if (brandError)
      return apiError(
        "O projeto foi salvo, mas a marca não pôde ser atualizada.",
        500,
        "brand_save_failed",
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
