import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { BrandProfile, ProjectDesignSystem } from "@/types";

const brandSaveSchema = z.object({
  id: z.string().uuid(),
  brand: z.custom<BrandProfile>((value) => Boolean(value && typeof value === "object")),
  designSystem: z.custom<ProjectDesignSystem>((value) => Boolean(value && typeof value === "object")),
  visualDirection: z.string().min(1),
});

export const PUT = withAuthenticatedActor(
  async (
    request,
    context: RouteContext<"/api/projects/[projectId]/brand">,
    actor,
  ) => {
    const parsed = brandSaveSchema.safeParse(
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
    if (actor.persistence === "memory") return apiSuccess({ saved: true });

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
    const nextSettings = {
      ...currentSettings,
      visualDirection: parsed.data.visualDirection,
      projectPayload: {
        ...currentPayload,
        brand: parsed.data.brand,
        designSystem: parsed.data.designSystem,
        visualDirection: parsed.data.visualDirection,
        updatedAt: now,
      },
    };

    const { error: brandError } = await database.from("brand_profiles").upsert(
      {
        project_id: projectId,
        primary_logo_asset_id: parsed.data.brand.primaryLogoAssetId || null,
        light_logo_asset_id: parsed.data.brand.lightLogoAssetId || null,
        dark_logo_asset_id: parsed.data.brand.darkLogoAssetId || null,
        favicon_asset_id: parsed.data.brand.faviconAssetId || null,
        extracted_colors: parsed.data.brand.extractedColors,
        active_palette: parsed.data.brand.activePalette,
        palette_variations: parsed.data.brand.paletteVariations,
        design_system: parsed.data.designSystem,
        brand_personality: parsed.data.brand.brandPersonality,
        analysis_metadata: parsed.data.brand.analysisMetadata || {},
        analyzed_at: now,
      },
      { onConflict: "project_id" },
    );
    if (brandError) {
      console.error("brand_save_failed", {
        code: brandError.code,
        message: brandError.message,
        projectId,
        workspaceId: actor.workspaceId,
      });
      return apiError(
        "Não foi possível salvar a identidade.",
        500,
        "brand_save_failed",
      );
    }

    const { error: projectError } = await database
      .from("projects")
      .update({
        theme: parsed.data.designSystem,
        settings: nextSettings,
      })
      .eq("id", projectId)
      .eq("workspace_id", actor.workspaceId);
    if (projectError) {
      console.error("brand_project_save_failed", {
        code: projectError.code,
        message: projectError.message,
        projectId,
        workspaceId: actor.workspaceId,
      });
      return apiError(
        "A identidade foi atualizada, mas o tema não pôde ser sincronizado.",
        500,
        "brand_project_save_failed",
      );
    }

    return apiSuccess({ saved: true, updatedAt: now });
  },
);
