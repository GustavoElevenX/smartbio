import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/server";
import { assertProjectAccess } from "@/server/auth/project-access";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import type { Project } from "@/types";

const experienceSaveSchema = z.object({
  id: z.string().uuid(),
  steps: z.custom<Project["steps"]>((value) => Array.isArray(value)),
  conversionGoals: z
    .custom<Project["conversionGoals"]>((value) => Array.isArray(value))
    .optional(),
  entryPoints: z
    .custom<Project["entryPoints"]>((value) => Array.isArray(value))
    .optional(),
});

export const PUT = withAuthenticatedActor(
  async (
    request,
    context: RouteContext<"/api/projects/[projectId]/experience">,
    actor,
  ) => {
    const parsed = experienceSaveSchema.safeParse(
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
    if (actor.persistence === "memory")
      return apiSuccess({
        version: 1,
        updatedAt: new Date().toISOString(),
      });

    await assertProjectAccess(actor, projectId, "write");
    const database = createServiceClient()!;
    const { data: existing, error: lookupError } = await database
      .from("projects")
      .select("settings")
      .eq("id", projectId)
      .eq("workspace_id", actor.workspaceId)
      .maybeSingle();
    if (lookupError || !existing)
      return apiError(
        "Não foi possível localizar o projeto.",
        lookupError ? 500 : 404,
        lookupError ? "project_lookup_failed" : "project_not_found",
      );

    const now = new Date().toISOString();
    const currentSettings =
      existing.settings && typeof existing.settings === "object"
        ? (existing.settings as Record<string, unknown>)
        : {};
    const currentPayload =
      currentSettings.projectPayload &&
      typeof currentSettings.projectPayload === "object"
        ? (currentSettings.projectPayload as Record<string, unknown>)
        : {};
    const version = Number(currentSettings.version || 1);
    const projectPayload = {
      ...currentPayload,
      steps: parsed.data.steps,
      conversionGoals:
        parsed.data.conversionGoals ?? currentPayload.conversionGoals,
      entryPoints: parsed.data.entryPoints ?? currentPayload.entryPoints,
      version,
      updatedAt: now,
    };
    const { error: saveError } = await database
      .from("projects")
      .update({
        settings: {
          ...currentSettings,
          projectPayload,
        },
      })
      .eq("id", projectId)
      .eq("workspace_id", actor.workspaceId);
    if (saveError) {
      console.error("experience_save_failed", {
        code: saveError.code,
        message: saveError.message,
        projectId,
        workspaceId: actor.workspaceId,
      });
      return apiError(
        "Não foi possível salvar o rascunho.",
        500,
        "experience_save_failed",
      );
    }

    return apiSuccess({ version, updatedAt: now });
  },
);
