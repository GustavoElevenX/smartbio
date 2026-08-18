import "server-only";

import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import type { Project } from "@/types";
import { loadProjectAggregate } from "@/server/projects/load-project-aggregate";
import { createServiceClient } from "@/lib/supabase/server";

export async function loadProjectForActor(actor: AuthenticatedActor, projectId: string): Promise<Project | null> {
  await assertProjectAccess(actor, projectId, "read");
  if (actor.persistence === "memory") return null;
  const project = await loadProjectAggregate(actor, projectId);
  if (!project) return null;
  const logoIds = [project.brand.primaryLogoAssetId, project.brand.lightLogoAssetId, project.brand.darkLogoAssetId, project.brand.faviconAssetId].filter((value): value is string => Boolean(value));
  if (!logoIds.length) return project;
  const database = createServiceClient();
  if (!database) return project;
  const assets = (project.mediaAssets || []).filter((asset) => logoIds.includes(asset.id));
  const signed = await Promise.all(assets.map(async (asset) => ({
    id: asset.id,
    url: (await database.storage.from("media-private").createSignedUrl(asset.storagePath, 3600)).data?.signedUrl,
  })));
  const urls = new Map(signed.map((item) => [item.id, item.url]));
  return {
    ...project,
    brand: {
      ...project.brand,
      logoDataUrl: project.brand.primaryLogoAssetId ? urls.get(project.brand.primaryLogoAssetId) : undefined,
      lightLogoDataUrl: project.brand.lightLogoAssetId ? urls.get(project.brand.lightLogoAssetId) : undefined,
      darkLogoDataUrl: project.brand.darkLogoAssetId ? urls.get(project.brand.darkLogoAssetId) : undefined,
      faviconDataUrl: project.brand.faviconAssetId ? urls.get(project.brand.faviconAssetId) : undefined,
    },
  };
}
