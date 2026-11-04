import "server-only";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/server";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { projectContext, parseCloudflareImage } from "@/server/content-studio/studio";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import { savePresencePageForActor } from "@/server/presence/presence-page-service";
import { designKitEditSchema, designKitSchema, visualBriefSchema, visualEditSchema, visualSpecSchema, type DesignKit, type VisualSpec } from "@/features/visual-engine/schema";
import { buildVisualPrompt, deriveDesignKit, makeDirection, planVisualVariants } from "@/features/visual-engine/visual-planner";
import { assessVisual, renderVisualPng } from "./render-art";
import { directArt, verifyArtworkQuality } from "./art-director";

const bucket = "media-private";
const memory = globalThis as typeof globalThis & { __sobeVisualKits?: Map<string, DesignKit>; __sobeVisualArt?: Map<string, Record<string, unknown>> };
const demoKits = memory.__sobeVisualKits ||= new Map<string, DesignKit>();
const demoArt = memory.__sobeVisualArt ||= new Map<string, Record<string, unknown>>();
const key = (actor: AuthenticatedActor, projectId: string) => `${actor.workspaceId}:${projectId}`;
function db() { const client = createServiceClient(); if (!client) throw new Error("Configure o Supabase para salvar artes."); return client; }

export async function getDesignKit(actor: AuthenticatedActor, projectId: string): Promise<DesignKit> {
  await assertProjectAccess(actor, projectId, "read");
  if (actor.persistence === "memory" && demoKits.has(key(actor, projectId))) return demoKits.get(key(actor, projectId))!;
  if (actor.persistence === "database") {
    const { data, error } = await db().from("visual_design_kits").select("kit_json").eq("project_id", projectId).eq("workspace_id", actor.workspaceId).maybeSingle();
    if (error) throw new Error("Aplique a migração do Motor Visual no Supabase.");
    if (data) return designKitSchema.parse(data.kit_json);
  }
  const business = await projectContext(actor, projectId);
  let logoAssetId: string | null = null;
  let category: string | null = null;
  if (actor.persistence === "database") {
    const [brand, project] = await Promise.all([
      db().from("brand_profiles").select("primary_logo_asset_id").eq("project_id", projectId).maybeSingle(),
      db().from("projects").select("category").eq("id", projectId).eq("workspace_id", actor.workspaceId).single(),
    ]);
    logoAssetId = brand.data?.primary_logo_asset_id || null;
    category = project.data?.category || null;
  }
  const kit = deriveDesignKit({ name: business.name, palette: business.palette, logoAssetId, category });
  if (actor.persistence === "memory") demoKits.set(key(actor, projectId), kit);
  else {
    const { error } = await db().from("visual_design_kits").upsert({ project_id: projectId, workspace_id: actor.workspaceId, kit_json: kit, version: 1 }, { onConflict: "project_id", ignoreDuplicates: true });
    if (error) throw new Error("Não foi possível salvar o Design Kit.");
    const { data } = await db().from("visual_design_kits").select("kit_json").eq("project_id", projectId).single();
    if (data) return designKitSchema.parse(data.kit_json);
  }
  return kit;
}

export async function updateDesignKit(actor: AuthenticatedActor, projectId: string, raw: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const patch = designKitEditSchema.parse(raw);
  const current = await getDesignKit(actor, projectId);
  const next = designKitSchema.parse({ ...current, ...patch, version: current.version + 1 });
  if (actor.persistence === "memory") demoKits.set(key(actor, projectId), next);
  else {
    const { data, error } = await db().from("visual_design_kits").update({ kit_json: next, version: next.version, updated_at: new Date().toISOString() }).eq("project_id", projectId).eq("workspace_id", actor.workspaceId).eq("version", current.version).select("project_id").maybeSingle();
    if (error || !data) throw new Error("O Design Kit mudou. Recarregue antes de salvar.");
  }
  return next;
}

export async function listArtworks(actor: AuthenticatedActor, projectId: string) {
  await assertProjectAccess(actor, projectId, "read");
  if (actor.persistence === "memory") return [...demoArt.values()].filter(row => row.workspace_id === actor.workspaceId && row.project_id === projectId).sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
  const { data, error } = await db().from("visual_artworks").select("*").eq("workspace_id", actor.workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(60);
  if (error) throw new Error("Não foi possível carregar as artes.");
  return data || [];
}

export async function getArtwork(actor: AuthenticatedActor, projectId: string, artworkId: string) {
  await assertProjectAccess(actor, projectId, "read");
  if (actor.persistence === "memory") {
    const row = demoArt.get(artworkId);
    if (row?.workspace_id === actor.workspaceId && row.project_id === projectId) return row;
    throw new Error("Arte não encontrada neste negócio.");
  }
  const { data } = await db().from("visual_artworks").select("*").eq("id", artworkId).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).maybeSingle();
  if (!data) throw new Error("Arte não encontrada neste negócio.");
  return data;
}

async function assertImageAsset(actor: AuthenticatedActor, projectId: string, assetId: string | null) {
  if (!assetId || actor.persistence === "memory") return;
  const { data } = await db().from("media_assets").select("id").eq("id", assetId).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).in("mime_type", ["image/png", "image/jpeg", "image/webp"]).maybeSingle();
  if (!data) throw new Error("Imagem não pertence a este negócio.");
}

export async function createArtworks(actor: AuthenticatedActor, projectId: string, raw: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const brief = visualBriefSchema.parse(raw);
  await assertImageAsset(actor, projectId, brief.imageAssetId || null);
  const kit = await getDesignKit(actor, projectId);
  const business = await projectContext(actor, projectId);
  const offering = business.context?.offeringContexts.find(item => item.id === brief.offeringId && item.status === "confirmed")?.label;
  const referenceRow = kit.referenceArtworkId ? await getArtwork(actor, projectId, kit.referenceArtworkId).catch(() => null) : null;
  const reference = referenceRow?.status === "approved" ? visualSpecSchema.parse(referenceRow.spec_json) : undefined;
  const confirmedFacts = business.context?.offeringContexts.filter(item => item.status === "confirmed").map(item => item.label).slice(0, 8) || [];
  const input = { name: business.name, description: business.description, offering, confirmedFacts };
  const specs = actor.persistence === "memory" ? planVisualVariants(brief, kit, input, reference) : await directArt(brief, kit, input, reference);
  const groupId = crypto.randomUUID();
  const now = new Date().toISOString();
  const rows = specs.map(spec => ({ id: crypto.randomUUID(), workspace_id: actor.workspaceId, project_id: projectId, group_id: groupId, spec_json: spec, kit_json: kit, version: 1, status: "draft", output_asset_id: null, created_by: actor.userId, created_at: now, updated_at: now }));
  if (actor.persistence === "memory") { rows.forEach(row => demoArt.set(row.id, row)); return rows; }
  const { data, error } = await db().from("visual_artworks").insert(rows).select("*");
  if (error || !data) throw new Error("Não foi possível salvar as alternativas.");
  return data;
}

export async function editArtwork(actor: AuthenticatedActor, projectId: string, artworkId: string, raw: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const edit = visualEditSchema.parse(raw);
  const row = await getArtwork(actor, projectId, artworkId);
  if (row.version !== edit.currentVersion) throw new Error("Esta arte mudou. Recarregue antes de salvar.");
  await assertImageAsset(actor, projectId, edit.patch.imageAssetId ?? null);
  const draft = visualSpecSchema.parse({ ...row.spec_json as VisualSpec, ...edit.patch });
  const kit = designKitSchema.parse(row.kit_json);
  const business = await projectContext(actor, projectId);
  const directed = edit.patch.layout && edit.patch.layout !== (row.spec_json as VisualSpec).layout ? { ...draft, direction: { ...makeDirection(draft.layout, draft.subject || business.name, kit), revisionNote: draft.direction?.revisionNote } } : draft;
  const spec = { ...directed, imagePrompt: buildVisualPrompt({ kit, spec: directed, businessName: business.name, businessDescription: business.description, offering: directed.subject }) };
  const patch = { spec_json: spec, version: edit.currentVersion + 1, status: "draft", output_asset_id: null, updated_at: new Date().toISOString() };
  if (actor.persistence === "memory") { const updated = { ...row, ...patch }; demoArt.set(artworkId, updated); return updated; }
  const { data, error } = await db().from("visual_artworks").update(patch).eq("id", artworkId).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).eq("version", edit.currentVersion).select("*").maybeSingle();
  if (error || !data) throw new Error("Não foi possível salvar a edição. Recarregue a arte.");
  return data;
}

async function assetBytes(actor: AuthenticatedActor, projectId: string, assetId: string | null, allowSvg = false) {
  if (!assetId || actor.persistence === "memory") return undefined;
  const client = db();
  const { data: asset } = await client.from("media_assets").select("storage_path").eq("id", assetId).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).in("mime_type", allowSvg ? ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] : ["image/png", "image/jpeg", "image/webp"]).maybeSingle();
  if (!asset) throw new Error("Imagem não pertence a este negócio.");
  const { data, error } = await client.storage.from(bucket).download(asset.storage_path);
  if (error || !data) throw new Error("Não foi possível carregar a imagem.");
  return Buffer.from(await data.arrayBuffer());
}

export async function renderArtwork(actor: AuthenticatedActor, projectId: string, artworkId: string) {
  const row = await getArtwork(actor, projectId, artworkId);
  const spec = visualSpecSchema.parse(row.spec_json);
  const kit = designKitSchema.parse(row.kit_json);
  const [photo, logo] = await Promise.all([assetBytes(actor, projectId, spec.imageAssetId), assetBytes(actor, projectId, kit.logoAssetId, true)]);
  return renderVisualPng(spec, kit, photo, logo);
}

async function saveMedia(actor: AuthenticatedActor, projectId: string, artworkId: string, bytes: Buffer, kind: "art" | "ai") {
  const client = db();
  const assetId = crypto.randomUUID();
  const path = `${actor.workspaceId}/${projectId}/visual/${artworkId}/${assetId}.png`;
  const { error: uploadError } = await client.storage.from(bucket).upload(path, bytes, { contentType: "image/png" });
  if (uploadError) throw new Error("Não foi possível salvar a imagem no Storage.");
  const { width, height } = await sharp(bytes).metadata();
  const { error } = await client.from("media_assets").insert({ id: assetId, workspace_id: actor.workspaceId, project_id: projectId, uploaded_by: actor.userId, asset_type: "image", storage_path: path, original_filename: `sobe-${kind}-${artworkId}.png`, mime_type: "image/png", width, height, file_size: bytes.length, status: "ready", metadata: { source: "visual_engine", artworkId, kind } });
  if (error) { await client.storage.from(bucket).remove([path]); throw new Error("Não foi possível registrar a imagem na biblioteca."); }
  return assetId;
}

export async function approveArtwork(actor: AuthenticatedActor, projectId: string, artworkId: string) {
  await assertProjectAccess(actor, projectId, "write");
  const row = await getArtwork(actor, projectId, artworkId);
  const kit = await getDesignKit(actor, projectId);
  const spec = visualSpecSchema.parse(row.spec_json);
  const issues = assessVisual(spec, designKitSchema.parse(row.kit_json), Boolean(spec.imageAssetId), Boolean(kit.logoAssetId));
  if (issues.length) throw new Error(`Revise a arte antes de aprovar: ${issues.join(" ")}`);
  const bytes = await renderArtwork(actor, projectId, artworkId);
  if (actor.persistence === "database") await verifyArtworkQuality(spec.subject, designKitSchema.parse(row.kit_json), bytes);
  const assetId = actor.persistence === "memory" ? null : await saveMedia(actor, projectId, artworkId, bytes, "art");
  const patch = { status: "approved", output_asset_id: assetId, updated_at: new Date().toISOString() };
  if (actor.persistence === "memory") demoArt.set(artworkId, { ...row, ...patch });
  else {
    const { data, error } = await db().from("visual_artworks").update(patch).eq("id", artworkId).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).eq("version", row.version).select("id").maybeSingle();
    if (error || !data) throw new Error("A arte mudou. Recarregue antes de aprovar.");
  }
  const nextKit = { ...kit, referenceArtworkId: artworkId, version: kit.version + 1 };
  if (actor.persistence === "memory") demoKits.set(key(actor, projectId), nextKit);
  else await db().from("visual_design_kits").update({ kit_json: nextKit, version: nextKit.version, updated_at: new Date().toISOString() }).eq("project_id", projectId).eq("workspace_id", actor.workspaceId).eq("version", kit.version);
  return { assetId, referenceArtworkId: artworkId };
}

export async function generateArtworkImage(actor: AuthenticatedActor, projectId: string, artworkId: string) {
  await assertProjectAccess(actor, projectId, "write");
  if (actor.persistence === "memory") throw new Error("Imagens por IA exigem um negócio salvo no Supabase.");
  if (process.env.CONTENT_IMAGE_PROVIDER !== "cloudflare" || !process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) throw new Error("Geração de imagem aguardando configuração da Cloudflare na SOBE.");
  const row = await getArtwork(actor, projectId, artworkId);
  const spec = visualSpecSchema.parse(row.spec_json);
  const prompt = spec.imagePrompt;
  const client = db();
  const { data: reservation, error } = await client.rpc("reserve_visual_image", { p_workspace_id: actor.workspaceId, p_project_id: projectId, p_artwork_id: artworkId, p_user_id: actor.userId, p_workspace_cap: Number(process.env.CONTENT_IMAGE_MAX_PER_WORKSPACE_PER_DAY || 3), p_global_cap: Number(process.env.CONTENT_IMAGE_GLOBAL_DAILY_CAP || 20), p_artwork_cap: Number(process.env.CONTENT_IMAGE_MAX_PER_POST || 3) });
  if (error || !reservation) throw new Error("Cota de imagens por IA alcançada. Você pode continuar criando artes com templates e fotos salvas.");
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/ai/run/@cf/black-forest-labs/flux-1-schnell`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ prompt, steps: 4 }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(response.status === 429 ? "A cota da Cloudflare acabou. Tente novamente amanhã." : `Cloudflare retornou ${response.status}.`);
    const source = parseCloudflareImage(await response.json());
    const png = await sharp(source, { limitInputPixels: 40_000_000 }).rotate().png().toBuffer();
    const assetId = await saveMedia(actor, projectId, artworkId, png, "ai");
    const updated = await editArtwork(actor, projectId, artworkId, { currentVersion: row.version, patch: { imageAssetId: assetId } });
    await client.from("visual_ai_usage").update({ status: "completed" }).eq("id", reservation);
    return updated;
  } catch (failure) {
    await client.from("visual_ai_usage").update({ status: "failed" }).eq("id", reservation);
    throw failure;
  }
}

export async function applyArtworkToPage(actor: AuthenticatedActor, projectId: string, artworkId: string, pageId: string) {
  await assertProjectAccess(actor, projectId, "write");
  const row = await getArtwork(actor, projectId, artworkId);
  if (row.status !== "approved" || !row.output_asset_id) throw new Error("Aprove a arte antes de aplicá-la à página.");
  await assertImageAsset(actor, projectId, row.output_asset_id);
  const project = await loadProjectForActor(actor, projectId);
  const page = project?.presence?.pages.find(item => item.id === pageId);
  if (!page) throw new Error("Página não encontrada neste negócio.");
  const hero = page.sections.find(section => section.type === "hero");
  if (!hero) throw new Error("Esta página não tem uma seção de destaque.");
  const next = structuredClone(page);
  const section = next.sections.find(item => item.id === hero.id)!;
  section.content = { ...section.content, media: { assetId: row.output_asset_id, position: "right" } };
  const saved = await savePresencePageForActor(actor, projectId, { page: next, expectedVersion: page.version || 0, deletedSectionIds: [] });
  return { pageId: saved.id, assetId: row.output_asset_id };
}
