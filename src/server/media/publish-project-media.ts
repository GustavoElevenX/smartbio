import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import type { Project } from "@/types";

function referencedAssetIds(project: Project) {
  const presenceAssetIds: string[] = [];
  const scan = (value: unknown, key = "") => {
    if (typeof value === "string" && /assetid$/i.test(key)) presenceAssetIds.push(value);
    else if (Array.isArray(value)) value.forEach((item) => scan(item, key));
    else if (value && typeof value === "object") Object.entries(value).forEach(([childKey, child]) => {
      if (/assetids$/i.test(childKey) && Array.isArray(child)) child.filter((item): item is string => typeof item === "string").forEach((item) => presenceAssetIds.push(item));
      else scan(child, childKey);
    });
  };
  scan(project.presence);
  return [...new Set([
    project.brand.primaryLogoAssetId,
    project.brand.lightLogoAssetId,
    project.brand.darkLogoAssetId,
    project.brand.faviconAssetId,
    ...(project.commercialConfig?.serviceOfferings || []).map((item) => item.imageAssetId),
    ...(project.commercialConfig?.catalogItems || []).map((item) => item.imageAssetId),
    ...(project.commercialConfig?.reservableUnits || []).flatMap((item) => item.mediaAssetIds),
    ...presenceAssetIds,
  ].filter((value): value is string => Boolean(value)) )];
}

export async function validateProjectMediaReferences(
  actor: AuthenticatedActor,
  project: Project,
) {
  const ids = referencedAssetIds(project);
  if (!ids.length || actor.persistence === "memory") return { ids, missing: [] as string[] };
  const supabase = createServiceClient();
  if (!supabase) return { ids, missing: ids };
  const { data } = await supabase
    .from("media_assets")
    .select("id,status")
    .eq("workspace_id", actor.workspaceId)
    .eq("project_id", project.id)
    .in("id", ids);
  const valid = new Set(
    (data || [])
      .filter((item) => ["ready", "published"].includes(item.status))
      .map((item) => item.id),
  );
  return { ids, missing: ids.filter((id) => !valid.has(id)) };
}

export async function publishProjectMedia(
  actor: AuthenticatedActor,
  project: Project,
) {
  const validation = await validateProjectMediaReferences(actor, project);
  if (validation.missing.length) {
    throw new Error("O projeto referencia mídia removida ou ainda não processada.");
  }
  if (!validation.ids.length || actor.persistence === "memory") return project;
  const supabase = createServiceClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data: assets, error } = await supabase
    .from("media_assets")
    .select("*")
    .eq("workspace_id", actor.workspaceId)
    .eq("project_id", project.id)
    .in("id", validation.ids);
  if (error) throw new Error("Não foi possível preparar a mídia pública.");

  const publicUrls = new Map<string, string>();
  for (const asset of assets || []) {
    const metadata = (asset.metadata || {}) as Record<string, unknown>;
    const sourcePath = typeof metadata.optimizedPath === "string"
      ? metadata.optimizedPath
      : String(asset.storage_path);
    const extension = sourcePath.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
    const publicPath = `${actor.workspaceId}/${project.id}/${asset.id}/asset.${extension}`;
    const { data: downloaded, error: downloadError } = await supabase.storage
      .from("media-private")
      .download(sourcePath);
    if (downloadError || !downloaded) throw new Error("Não foi possível copiar uma mídia para publicação.");
    const { error: uploadError } = await supabase.storage
      .from("media-public")
      .upload(publicPath, await downloaded.arrayBuffer(), {
        contentType: typeof metadata.optimizedPath === "string" ? "image/webp" : asset.mime_type,
        upsert: true,
      });
    if (uploadError) throw new Error("Não foi possível publicar uma mídia.");
    const publicUrl = supabase.storage.from("media-public").getPublicUrl(publicPath).data.publicUrl;
    publicUrls.set(asset.id, publicUrl);
    const { error: updateError } = await supabase
      .from("media_assets")
      .update({
        status: "published",
        metadata: { ...metadata, publicPath, publicUrl, publishedAt: new Date().toISOString() },
      })
      .eq("id", asset.id)
      .eq("workspace_id", actor.workspaceId);
    if (updateError) throw new Error("Não foi possível registrar a mídia publicada.");
  }

  const published = structuredClone(project);
  if (published.brand.primaryLogoAssetId) {
    published.brand.logoDataUrl = publicUrls.get(published.brand.primaryLogoAssetId);
  }
  if (published.brand.lightLogoAssetId) {
    published.brand.lightLogoDataUrl = publicUrls.get(published.brand.lightLogoAssetId);
  }
  if (published.brand.darkLogoAssetId) {
    published.brand.darkLogoDataUrl = publicUrls.get(published.brand.darkLogoAssetId);
  }
  if (published.brand.faviconAssetId) {
    published.brand.faviconDataUrl = publicUrls.get(published.brand.faviconAssetId);
  }
  for (const service of published.commercialConfig?.serviceOfferings || []) {
    if (service.imageAssetId) {
      service.settings = { ...service.settings, publicImageUrl: publicUrls.get(service.imageAssetId) };
    }
  }
  for (const item of published.commercialConfig?.catalogItems || []) {
    if (item.imageAssetId) {
      item.metadata = { ...item.metadata, publicImageUrl: publicUrls.get(item.imageAssetId) };
    }
  }
  published.mediaAssets = (published.mediaAssets || []).map((asset) => publicUrls.has(asset.id) ? { ...asset, status: "published", metadata: { ...asset.metadata, publicUrl: publicUrls.get(asset.id) } } : asset);
  return published;
}
