import "server-only";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/server";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { projectCommercialContextService } from "@/server/commercial-context/project-commercial-context-service";
import { contentBriefSchema, contentPlanSchema, editContentSchema, slideSchema, type ContentBrief, type ContentSlide } from "@/features/content-studio/schema";
import { renderSlideScene } from "./render-scene";

const storage = "media-private";
const db = () => { const client = createServiceClient(); if (!client) throw new Error("Configure o Supabase para salvar conteúdos."); return client; };
const demoGlobal = globalThis as typeof globalThis & { __sobeContentDemoPosts?: Map<string, Record<string, unknown>> };
const demoPosts = demoGlobal.__sobeContentDemoPosts ||= new Map<string, Record<string, unknown>>();
const demoKey = (actor: AuthenticatedActor, projectId: string, postId: string) => `${actor.workspaceId}:${projectId}:${postId}`;

export async function projectContext(actor: AuthenticatedActor, projectId: string) {
  await assertProjectAccess(actor, projectId);
  if (actor.persistence === "memory") return { name: "Negócio de demonstração", description: "", context: null, palette: ["#07172F", "#0054FC"] };
  const client = db();
  const [project, brand, commercial] = await Promise.all([
    client.from("projects").select("name,description,slug").eq("id", projectId).eq("workspace_id", actor.workspaceId).single(),
    client.from("brand_profiles").select("active_palette").eq("project_id", projectId).maybeSingle(),
    projectCommercialContextService.get(actor, projectId),
  ]);
  if (!project.data) throw new Error("Negócio não encontrado.");
  const colors = Object.values(brand.data?.active_palette || {}).filter((v): v is string => typeof v === "string" && /^#[\da-f]{6}$/i.test(v));
  return { name: project.data.name, description: project.data.description || "", slug: project.data.slug, context: commercial, palette: colors.length ? colors.slice(0, 4) : ["#07172F", "#0054FC"] };
}

interface BusinessFacts { name: string; description: string; slug?: string; palette: string[]; context?: { summary: { whatItSells: string }; offeringContexts: Array<{ id: string; label: string; status: string }>; audienceContexts: Array<{ label: string; status: string }> } | null }
export function starterPlan(brief: ContentBrief, business: BusinessFacts) {
  const offering = business.context?.offeringContexts.find((item) => item.id === brief.offeringId && item.status === "confirmed");
  const fact = offering?.label || business.context?.summary.whatItSells || business.description || business.name;
  const audience = business.context?.audienceContexts.find((item) => item.status === "confirmed")?.label || "Pessoas interessadas no negócio";
  const cta = business.slug ? `Conheça ${business.name} no link da bio.` : `Conheça ${business.name}.`;
  const roles = ["hook", "value", "explanation", "proof", "offer", "explanation", "value", "cta"] as const;
  const slides: ContentSlide[] = Array.from({ length: brief.format === "single" ? 1 : brief.desiredSlides }, (_, index) => ({
    id: crypto.randomUUID(), role: index === brief.desiredSlides - 1 ? "cta" : roles[index],
    headline: index === 0 ? brief.theme.slice(0, 65) : index === brief.desiredSlides - 1 ? "Saiba mais" : fact.slice(0, 65),
    body: index === 0 ? fact.slice(0, 160) : index === brief.desiredSlides - 1 ? cta : "Edite este texto com uma informação confirmada do seu negócio.",
    visualPrompt: `Editorial photograph representing ${fact}. Natural light, uncluttered background, no text, no letters, no logo, no labels, no watermark.`,
    layoutId: (["editorial", "split", "photo", "statement", "closing"] as const)[index % 5], imageAssetId: null, imagePosition: "centre",
    backgroundColor: business.palette[0] || "#07172F", textColor: "#FFFFFF",
  }));
  return contentPlanSchema.parse({ title: brief.theme, audience, factualBasis: [{ fact, origin: offering ? "oferta confirmada" : "cadastro do negócio" }], unsupportedClaims: [], slides, caption: `${brief.theme}\n\n${fact}\n\n${cta}`, callToAction: cta });
}

async function withCopyBudget<T>(actor: AuthenticatedActor, projectId: string, work: () => Promise<T>) {
  const client = db();
  const { data: id, error } = await client.rpc("reserve_content_copy", { p_workspace_id: actor.workspaceId, p_project_id: projectId, p_user_id: actor.userId, p_workspace_month_cap: Number(process.env.CONTENT_COPY_MAX_PER_WORKSPACE_PER_MONTH || 10), p_global_month_cap: Number(process.env.CONTENT_COPY_GLOBAL_MONTHLY_CAP || 100) });
  if (error || !id) throw new Error("Limite de roteiros da fase de teste alcançado neste mês. Você pode continuar editando conteúdos salvos.");
  try { const result = await work(); await client.from("content_ai_usage").update({ status: "completed" }).eq("id", id); return result; }
  catch (failure) { await client.from("content_ai_usage").update({ status: "failed" }).eq("id", id); throw failure; }
}

async function aiPlan(actor: AuthenticatedActor, projectId: string, brief: ContentBrief, business: Awaited<ReturnType<typeof projectContext>>) {
  if (!process.env.OPENAI_API_KEY) return starterPlan(brief, business);
  const confirmed = business.context;
  const facts = { name: business.name, description: business.description, summary: confirmed?.summary,
    offerings: confirmed?.offeringContexts.filter(x => x.status === "confirmed").map(x => ({ id: x.id, label: x.label })),
    audiences: confirmed?.audienceContexts.filter(x => x.status === "confirmed").map(x => x.label),
    channels: confirmed?.channelContexts.filter(x => x.status === "confirmed").map(x => x.role) };
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45000, maxRetries: 0 });
  const response = await withCopyBudget(actor, projectId, () => client.responses.parse({ model: process.env.OPENAI_MODEL || "gpt-5.4-mini-2026-03-17", max_output_tokens: 5000,
    input: [{ role: "system", content: "Você cria roteiros de carrossel em português brasileiro. Use somente fatos fornecidos. Não invente preços, resultados, avaliações, localização ou promessas. Imagens devem ser descritas sem letras. Cada slide tem id string, role, headline, body, visualPrompt, layoutId, imageAssetId null, backgroundColor e textColor. Inclua fatos e origem. Conteúdo de saúde não promete resultado. Respeite o número de slides." },
      { role: "user", content: JSON.stringify({ brief, facts, palette: business.palette }) }],
    text: { format: zodTextFormat(contentPlanSchema, "content_plan") } }));
  if (!response.output_parsed) throw new Error("A IA não retornou um roteiro válido.");
  return contentPlanSchema.parse({ ...response.output_parsed, slides: response.output_parsed.slides.map(slide => ({ ...slide, id: crypto.randomUUID() })) });
}

export async function listPosts(actor: AuthenticatedActor, projectId: string) {
  await assertProjectAccess(actor, projectId);
  if (actor.persistence === "memory") return [...demoPosts.values()].filter(row => row.workspace_id === actor.workspaceId && row.project_id === projectId);
  const { data, error } = await db().from("content_posts").select("id,status,objective,format,caption,current_version,approved_version,updated_at,plan_json").eq("workspace_id", actor.workspaceId).eq("project_id", projectId).order("updated_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar conteúdos. Execute a migração do módulo.");
  return data || [];
}

export async function listContentAssets(actor: AuthenticatedActor, projectId: string) {
  await assertProjectAccess(actor, projectId);
  if (actor.persistence === "memory") return [];
  const client = db();
  const { data } = await client.from("content_assets").select("id,storage_path,origin").eq("workspace_id", actor.workspaceId).eq("project_id", projectId).order("created_at", { ascending: false }).limit(40);
  return Promise.all((data || []).map(async asset => ({ id: asset.id, origin: asset.origin, url: (await client.storage.from(storage).createSignedUrl(asset.storage_path, 3600)).data?.signedUrl || "" })));
}

export async function getPost(actor: AuthenticatedActor, projectId: string, postId: string) {
  await assertProjectAccess(actor, projectId);
  if (actor.persistence === "memory") { const row = demoPosts.get(demoKey(actor, projectId, postId)); if (!row) throw new Error("Conteúdo não encontrado neste negócio."); return row; }
  const { data, error } = await db().from("content_posts").select("*").eq("id", postId).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).maybeSingle();
  if (error || !data) throw new Error("Conteúdo não encontrado neste negócio.");
  return data;
}

export async function createPost(actor: AuthenticatedActor, projectId: string, input: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const brief = contentBriefSchema.parse(input);
  const business = await projectContext(actor, projectId);
  if (actor.persistence === "memory") {
    const plan = starterPlan(brief, business); const id = crypto.randomUUID();
    const row = { id, workspace_id: actor.workspaceId, project_id: projectId, created_by: actor.userId, status: "ready", objective: brief.objective, format: brief.format, brief_json: brief, plan_json: plan, slides_json: plan.slides, caption: plan.caption, current_version: 1, approved_version: null, updated_at: new Date().toISOString() };
    demoPosts.set(demoKey(actor, projectId, id), row); return row;
  }
  const plan = await aiPlan(actor, projectId, brief, business);
  const { data, error } = await db().from("content_posts").insert({ workspace_id: actor.workspaceId, project_id: projectId, created_by: actor.userId, status: "ready", objective: brief.objective, format: brief.format, brief_json: brief, plan_json: plan, slides_json: plan.slides, caption: plan.caption }).select("*").single();
  if (error || !data) throw new Error("Não foi possível salvar o conteúdo.");
  return data;
}

export async function editPost(actor: AuthenticatedActor, projectId: string, postId: string, input: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const edit = editContentSchema.parse(input);
  const current = await getPost(actor, projectId, postId);
  if (current.current_version !== edit.currentVersion) throw new Error("Este conteúdo mudou. Recarregue antes de salvar.");
  if (actor.persistence === "memory") { const updated = { ...current, slides_json: edit.slides, caption: edit.caption, current_version: Number(current.current_version) + 1, approved_version: null, updated_at: new Date().toISOString() }; demoPosts.set(demoKey(actor, projectId, postId), updated); return updated; }
  const { data, error } = await db().from("content_posts").update({ slides_json: edit.slides, caption: edit.caption, current_version: current.current_version + 1, approved_version: null, status: "ready", updated_at: new Date().toISOString() }).eq("id", postId).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).eq("current_version", edit.currentVersion).select("*").maybeSingle();
  if (error || !data) throw new Error("Não foi possível salvar. Recarregue e tente novamente.");
  await db().from("social_publications").update({ status: "cancelled", last_error_code: "content_changed" }).eq("post_id", postId).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).eq("status", "queued");
  return data;
}

export function parseCloudflareImage(payload: unknown) {
  const image = (payload as { result?: { image?: unknown } })?.result?.image;
  if (typeof image !== "string" || image.length > 16_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) throw new Error("Resposta de imagem inválida da Cloudflare.");
  const bytes = Buffer.from(image, "base64");
  if (bytes.length < 1000 || bytes.length > 12_000_000) throw new Error("Tamanho de imagem inválido.");
  return bytes;
}

export async function generateImage(actor: AuthenticatedActor, projectId: string, postId: string, slideId: string) {
  await assertProjectAccess(actor, projectId, "write");
  const post = await getPost(actor, projectId, postId);
  const slides = contentPlanSchema.shape.slides.parse(post.slides_json);
  const slide = slides.find(x => x.id === slideId);
  if (!slide) throw new Error("Card não encontrado.");
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) throw new Error("Geração de imagem por IA aguardando configuração da SOBE.");
  const client = db();
  const { data: reservation, error: reserveError } = await client.rpc("reserve_content_image", { p_workspace_id: actor.workspaceId, p_project_id: projectId, p_post_id: postId, p_user_id: actor.userId, p_workspace_cap: Number(process.env.CONTENT_IMAGE_MAX_PER_WORKSPACE_PER_DAY || 3), p_global_cap: Number(process.env.CONTENT_IMAGE_GLOBAL_DAILY_CAP || 20), p_post_cap: Number(process.env.CONTENT_IMAGE_MAX_PER_POST || 3) });
  if (reserveError || !reservation) throw new Error(reserveError?.message.includes("content_post_quota") ? "Este conteúdo atingiu o limite de imagens por carrossel. Continue com fotos salvas ou crie outro conteúdo." : "Limite diário de imagens da fase de teste alcançado. Você pode continuar editando com fotos salvas. A cota diária reinicia à 00:00 UTC.");
  try {
    const prompt = `${slide.visualPrompt || slide.headline}. Photographic visual only. No text, no letters, no logos, no labels, no watermark.`.slice(0, 2048);
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/ai/run/@cf/black-forest-labs/flux-1-schnell`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ prompt, steps: 4 }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(response.status === 429 ? "A cota da Cloudflare acabou. Tente após 00:00 UTC." : `Cloudflare retornou ${response.status}.`);
    const image = parseCloudflareImage(await response.json());
    const jpeg = await sharp(image, { limitInputPixels: 40_000_000 }).rotate().resize(1080, 1350, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
    const id = crypto.randomUUID(); const path = `${actor.workspaceId}/${projectId}/content/${postId}/${id}.jpg`;
    const { error: uploadError } = await client.storage.from(storage).upload(path, jpeg, { contentType: "image/jpeg" });
    if (uploadError) throw new Error("Não foi possível salvar a imagem gerada.");
    const { error: assetError } = await client.from("content_assets").insert({ id, workspace_id: actor.workspaceId, project_id: projectId, post_id: postId, slide_id: slideId, origin: "ai_generated", storage_path: path, mime_type: "image/jpeg", byte_size: jpeg.length });
    if (assetError) throw new Error("Não foi possível registrar a imagem.");
    await client.from("content_ai_usage").update({ status: "completed", request_id: response.headers.get("cf-ray") }).eq("id", reservation);
    return { assetId: id };
  } catch (error) {
    await client.from("content_ai_usage").update({ status: "failed" }).eq("id", reservation);
    throw error;
  }
}

export async function regenerateCardCopy(actor: AuthenticatedActor, projectId: string, postId: string, slideId: string) {
  await assertProjectAccess(actor, projectId, "write");
  if (!process.env.OPENAI_API_KEY) throw new Error("Geração de texto aguardando configuração da SOBE.");
  const post = await getPost(actor, projectId, postId);
  const slides = contentPlanSchema.shape.slides.parse(post.slides_json);
  const slide = slides.find(x => x.id === slideId);
  if (!slide) throw new Error("Card não encontrado.");
  const business = await projectContext(actor, projectId);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 0 });
  const response = await withCopyBudget(actor, projectId, () => client.responses.parse({ model: process.env.OPENAI_MODEL || "gpt-5.4-mini-2026-03-17", max_output_tokens: 1200,
    input: [{ role: "system", content: "Reescreva somente headline e body do card em português brasileiro. Preserve id, role, visualPrompt, layoutId, imageAssetId e cores. Use apenas fatos confirmados; não invente preço, desconto, resultado, avaliação ou promessa clínica." },
      { role: "user", content: JSON.stringify({ slide, theme: post.brief_json?.theme, facts: post.plan_json?.factualBasis, businessName: business.name }) }],
    text: { format: zodTextFormat(slideSchema, "content_slide") } }));
  if (!response.output_parsed) throw new Error("A IA não retornou texto válido.");
  const parsed = slideSchema.parse(response.output_parsed);
  return { headline: parsed.headline, body: parsed.body };
}

export async function renderSlide(actor: AuthenticatedActor, projectId: string, postId: string, slideId: string, approvedSlide?: ContentSlide) {
  const post = await getPost(actor, projectId, postId);
  const slide = approvedSlide || contentPlanSchema.shape.slides.parse(post.slides_json).find(x => x.id === slideId);
  if (!slide) throw new Error("Card não encontrado.");
  let photo: Buffer | undefined; let logo: Buffer | undefined;
  if (slide.imageAssetId) {
    const client = db();
    const { data: asset } = await client.from("content_assets").select("storage_path").eq("id", slide.imageAssetId).eq("post_id", postId).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).maybeSingle();
    const { data: media } = asset ? { data: null } : await client.from("media_assets").select("storage_path").eq("id", slide.imageAssetId).eq("project_id", projectId).eq("workspace_id", actor.workspaceId).in("mime_type", ["image/png", "image/jpeg", "image/webp"]).maybeSingle();
    const path = asset?.storage_path || media?.storage_path;
    if (!path) throw new Error("Imagem não pertence a este negócio.");
    const { data, error } = await client.storage.from(storage).download(path);
    if (error || !data) throw new Error("Não foi possível carregar a imagem.");
    photo = Buffer.from(await data.arrayBuffer());
  }
  if (actor.persistence === "database") {
    const client = db();
    const { data: brand } = await client.from("brand_profiles").select("primary_logo_asset_id").eq("project_id", projectId).maybeSingle();
    if (brand?.primary_logo_asset_id) {
      const { data: asset } = await client.from("media_assets").select("storage_path").eq("id", brand.primary_logo_asset_id).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).in("mime_type", ["image/png", "image/jpeg", "image/webp"]).maybeSingle();
      if (asset?.storage_path) { const { data } = await client.storage.from(storage).download(asset.storage_path); if (data) logo = Buffer.from(await data.arrayBuffer()); }
    }
  }
  return renderSlideScene(slide, photo, logo);
}

export async function approvePost(actor: AuthenticatedActor, projectId: string, postId: string) {
  await assertProjectAccess(actor, projectId, "write");
  const post = await getPost(actor, projectId, postId);
  if (!post.caption || !Array.isArray(post.slides_json) || post.slides_json.length < 1) throw new Error("Revise legenda e cards antes de aprovar.");
  if (actor.persistence === "memory") { const updated = { ...post, approved_version: post.current_version }; demoPosts.set(demoKey(actor, projectId, postId), updated); return updated; }
  const { data, error } = await db().from("content_posts").update({ approved_version: post.current_version }).eq("id", postId).eq("project_id", projectId).eq("workspace_id", actor.workspaceId).select("*").single();
  if (error) throw new Error("Não foi possível aprovar."); return data;
}

export function composioUserId(workspaceId: string, projectId: string) { return `sobe_${createHash("sha256").update(`${workspaceId}:${projectId}`).digest("hex").slice(0, 40)}`; }
