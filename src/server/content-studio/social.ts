import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { composioUserId, getPost, renderSlide } from "./studio";
import { contentPlanSchema } from "@/features/content-studio/schema";

const db = () => { const client = createServiceClient(); if (!client) throw new Error("Configure o Supabase."); return client; };
const api = "https://backend.composio.dev";
async function composio(path: string, init?: { method?: string; body?: unknown }) {
  if (!process.env.COMPOSIO_API_KEY) throw new Error("Instagram aguardando configuração da SOBE.");
  const response = await fetch(`${api}${path}`, { method: init?.method || "GET", headers: { "x-api-key": process.env.COMPOSIO_API_KEY, "Content-Type": "application/json" }, body: init?.body ? JSON.stringify(init.body) : undefined, signal: AbortSignal.timeout(20000), cache: "no-store" });
  const result: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Composio retornou ${response.status}. Verifique a conexão e as permissões.`);
  return result as Record<string, unknown>;
}
async function proxy(connection: { connected_account_id: string; composio_user_id: string }, endpoint: string, method: "GET" | "POST", body?: Record<string, unknown>) {
  const result = await composio("/api/v3.1/tools/execute/proxy", { method: "POST", body: { connected_account_id: connection.connected_account_id, user_id: connection.composio_user_id, endpoint, method, body } });
  if (Number(result.status) >= 400 || !result.data || typeof result.data !== "object") throw new Error(`Instagram recusou uma etapa (${result.status || "sem resposta"}).`);
  return result.data as Record<string, unknown>;
}
function graphPost(connection: { connected_account_id: string; composio_user_id: string }, path: string, parameters: Record<string, string>) {
  return proxy(connection, `${path}?${new URLSearchParams(parameters)}`, "POST");
}
const nonceHash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function connectInstagram(actor: AuthenticatedActor, projectId: string, origin: string) {
  await assertProjectAccess(actor, projectId, "write");
  if (actor.persistence === "memory") throw new Error("Conexão real exige Supabase configurado.");
  if (!process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID) throw new Error("Instagram aguardando configuração da SOBE.");
  const nonce = crypto.randomUUID();
  const userId = composioUserId(actor.workspaceId, projectId);
  const callback = `${origin}/app/projects/${encodeURIComponent(projectId)}/content?tab=instagram&state=${encodeURIComponent(nonce)}`;
  const result = await composio("/api/v3/connected_accounts/link", { method: "POST", body: { user_id: userId, auth_config_id: process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID, callback_url: callback } });
  const url = result.redirect_url;
  if (typeof url !== "string" || !new URL(url).hostname.endsWith(".composio.dev") || !url.startsWith("https://")) throw new Error("Link de autorização inválido.");
  const { error } = await db().from("social_connections").upsert({ workspace_id: actor.workspaceId, project_id: projectId, provider: "instagram", composio_user_id: userId, connection_request_id: result.connected_account_id || null, connected_account_id: null, status: "pending", initiated_by: actor.userId, nonce_hash: nonceHash(nonce), nonce_expires_at: new Date(Date.now() + 15 * 60_000).toISOString() }, { onConflict: "workspace_id,project_id,provider" });
  if (error) throw new Error("Não foi possível iniciar a conexão.");
  return { url };
}

export async function instagramStatus(actor: AuthenticatedActor, projectId: string, state?: string) {
  await assertProjectAccess(actor, projectId);
  if (actor.persistence === "memory") return { status: "unconfigured" };
  const client = db();
  const { data: row } = await client.from("social_connections").select("*").eq("workspace_id", actor.workspaceId).eq("project_id", projectId).maybeSingle();
  if (!row || row.status === "disconnected") return { status: "disconnected" };
  if (row.status === "pending") {
    if (!state || row.initiated_by !== actor.userId || !row.nonce_hash || !row.nonce_expires_at || new Date(row.nonce_expires_at) < new Date()) return { status: "pending" };
    const supplied = Buffer.from(nonceHash(state)); const expected = Buffer.from(row.nonce_hash);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return { status: "pending" };
    const query = new URLSearchParams({ user_ids: row.composio_user_id, toolkit_slugs: "instagram", statuses: "ACTIVE" });
    const remote = await composio(`/api/v3.1/connected_accounts?${query}`);
    const items = Array.isArray(remote.items) ? remote.items as Array<Record<string, unknown>> : [];
    const matched = items.find(x => x.id === row.connection_request_id && x.user_id === row.composio_user_id && x.status === "ACTIVE");
    if (!matched) return { status: "pending" };
    const info = await proxy({ connected_account_id: String(matched.id), composio_user_id: row.composio_user_id }, "/me?fields=id,username,account_type", "GET");
    if (!info.id || (info.account_type && !["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(String(info.account_type)))) throw new Error("Conecte uma conta Instagram Business ou Creator.");
    const { data } = await client.from("social_connections").update({ status: "active", connected_account_id: matched.id, display_name: info.username ? `@${info.username}` : "Instagram profissional", nonce_hash: null, nonce_expires_at: null, last_checked_at: new Date().toISOString() }).eq("id", row.id).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).select("*").single();
    return { status: "active", id: data?.id, displayName: data?.display_name || "Instagram conectado" };
  }
  if (row.connected_account_id) {
    const remote = await composio(`/api/v3.1/connected_accounts/${encodeURIComponent(row.connected_account_id)}`);
    if (remote.status !== "ACTIVE" || remote.user_id !== row.composio_user_id) {
      await client.from("social_connections").update({ status: "failed" }).eq("id", row.id);
      return { status: "failed" };
    }
  }
  return { status: row.status, id: row.id, displayName: row.display_name || "Instagram conectado" };
}

export async function disconnectInstagram(actor: AuthenticatedActor, projectId: string) {
  await assertProjectAccess(actor, projectId, "write");
  const client = db();
  const { data: row } = await client.from("social_connections").select("*").eq("workspace_id", actor.workspaceId).eq("project_id", projectId).maybeSingle();
  if (!row) return;
  if (row.connected_account_id) await composio(`/api/v3.1/connected_accounts/${encodeURIComponent(row.connected_account_id)}/revoke`, { method: "POST" });
  await client.from("social_connections").update({ status: "disconnected", connected_account_id: null }).eq("id", row.id);
  await client.from("social_publications").update({ status: "cancelled" }).eq("connection_id", row.id).eq("status", "queued");
}

export async function queuePublication(actor: AuthenticatedActor, projectId: string, postId: string, connectionId: string, scheduledAt?: string) {
  await assertProjectAccess(actor, projectId, "write");
  if (actor.mode !== "workspace" || actor.persistence === "memory") throw new Error("Publicação indisponível neste modo.");
  if (process.env.SOCIAL_PUBLISHING_ENABLED !== "true") throw new Error("Publicação aguardando ativação pela SOBE.");
  const post = await getPost(actor, projectId, postId);
  if (post.approved_version !== post.current_version) throw new Error("Aprove a versão atual antes de publicar.");
  const { data: connection } = await db().from("social_connections").select("*").eq("id", connectionId).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).eq("status", "active").maybeSingle();
  if (!connection) throw new Error("Conta Instagram não conectada a este negócio.");
  if (scheduledAt && (new Date(scheduledAt).getTime() <= Date.now() + 60_000 || Number.isNaN(new Date(scheduledAt).getTime()))) throw new Error("Escolha um horário futuro válido.");
  const snapshot = { caption: post.caption, slides: contentPlanSchema.shape.slides.parse(post.slides_json), version: post.current_version };
  if (post.format === "carousel" && snapshot.slides.length < 2) throw new Error("Carrossel precisa de pelo menos 2 cards.");
  const { data: active } = await db().from("social_publications").select("*").eq("workspace_id", actor.workspaceId).eq("project_id", projectId).eq("post_id", postId).eq("connection_id", connectionId).eq("snapshot_version", post.current_version).in("status", ["queued", "in_progress", "published", "needs_review"]).maybeSingle();
  if (active?.status === "queued" && (!scheduledAt || active.scheduled_at_utc === scheduledAt)) return active;
  if (active) throw new Error(active.status === "queued" ? "Este conteúdo já está agendado. Cancele no calendário antes de reagendar." : "Esta versão já foi enviada ou está em revisão. Crie uma nova versão antes de publicar novamente.");
  const key = `${postId}:${post.current_version}:${connectionId}:${scheduledAt || "now"}:${crypto.randomUUID()}`;
  const { data, error } = await db().from("social_publications").upsert({ workspace_id: actor.workspaceId, project_id: projectId, post_id: postId, connection_id: connectionId, approved_by: actor.userId, snapshot_json: snapshot, snapshot_version: post.current_version, scheduled_at_utc: scheduledAt || new Date().toISOString(), idempotency_key: key, status: "queued" }, { onConflict: "workspace_id,idempotency_key", ignoreDuplicates: true }).select("*").maybeSingle();
  if (error) throw new Error("Não foi possível registrar a publicação.");
  if (!data) { const existing = await db().from("social_publications").select("*").eq("workspace_id", actor.workspaceId).eq("idempotency_key", key).single(); return existing.data; }
  await db().from("content_posts").update({ status: scheduledAt ? "scheduled" : "publishing" }).eq("id", postId).eq("workspace_id", actor.workspaceId).eq("project_id", projectId);
  return data;
}

export async function listPublications(actor: AuthenticatedActor, projectId: string) {
  await assertProjectAccess(actor, projectId);
  if (actor.persistence === "memory") return [];
  const { data } = await db().from("social_publications").select("id,post_id,status,scheduled_at_utc,external_permalink,last_error_code,created_at").eq("workspace_id", actor.workspaceId).eq("project_id", projectId).order("created_at", { ascending: false });
  return data || [];
}
export async function cancelPublication(actor: AuthenticatedActor, projectId: string, publicationId: string) {
  await assertProjectAccess(actor, projectId, "write");
  const { data } = await db().from("social_publications").update({ status: "cancelled" }).eq("id", publicationId).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).eq("status", "queued").select("id,post_id").maybeSingle();
  if (!data) throw new Error("Esta publicação já está em processamento ou foi concluída.");
  await db().from("content_posts").update({ status: "ready" }).eq("id", data.post_id).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).eq("status", "scheduled");
  return data;
}

export async function processPublication(row: Record<string, unknown>, worker: string) {
  const client = db(); const publicationId = String(row.id); const postId = String(row.post_id); const projectId = String(row.project_id); const workspaceId = String(row.workspace_id);
  const { data: connection } = await client.from("social_connections").select("*").eq("id", row.connection_id).eq("project_id", projectId).eq("workspace_id", workspaceId).eq("status", "active").single();
  if (!connection?.connected_account_id) throw new Error("instagram_disconnected");
  const remote = await composio(`/api/v3.1/connected_accounts/${encodeURIComponent(connection.connected_account_id)}`);
  if (remote.status !== "ACTIVE" || remote.user_id !== connection.composio_user_id) throw new Error("instagram_not_active");
  const account = { connected_account_id: connection.connected_account_id, composio_user_id: connection.composio_user_id };
  const me = await proxy(account, "/me?fields=id,username,account_type", "GET");
  const igId = String(me.id || ""); if (!/^\d+$/.test(igId)) throw new Error("instagram_account_id_missing");
  if (me.account_type && !["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(String(me.account_type))) throw new Error("instagram_professional_required");
  const snapshot = row.snapshot_json as { slides: Array<import("@/features/content-studio/schema").ContentSlide>; caption: string };
  const actor = { workspaceId, persistence: "database", mode: "workspace", userId: String(row.approved_by), role: "owner", email: "" } as AuthenticatedActor;
  const children: string[] = [];
  for (const slide of snapshot.slides) {
    const jpeg = await renderSlide(actor, projectId, postId, slide.id, slide);
    const path = `${workspaceId}/${projectId}/content/${postId}/publication-${publicationId}-${slide.id}.jpg`;
    await client.storage.from("media-private").upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
    const signed = await client.storage.from("media-private").createSignedUrl(path, 86400);
    if (!signed.data?.signedUrl) throw new Error("media_url_unavailable");
    const container = await graphPost(account, `/${igId}/media`, snapshot.slides.length === 1 ? { image_url: signed.data.signedUrl, caption: snapshot.caption } : { image_url: signed.data.signedUrl, is_carousel_item: "true" });
    if (!container.id) throw new Error("instagram_container_missing");
    children.push(String(container.id));
  }
  const parent = snapshot.slides.length === 1 ? { id: children[0] } : await graphPost(account, `/${igId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: snapshot.caption });
  if (!parent.id) throw new Error("instagram_carousel_missing");
  await client.from("social_publications").update({ external_creation_id: parent.id }).eq("id", publicationId).eq("lease_owner", worker);
  const published = await graphPost(account, `/${igId}/media_publish`, { creation_id: String(parent.id) });
  if (!published.id) throw new Error("instagram_publish_uncertain");
  const detail = await proxy(account, `/${published.id}?fields=id,permalink`, "GET");
  if (!detail.id || !detail.permalink) throw new Error("instagram_confirmation_uncertain");
  await client.from("social_publications").update({ status: "published", external_media_id: detail.id, external_permalink: detail.permalink, published_at: new Date().toISOString(), lease_owner: null, lease_until: null }).eq("id", publicationId).eq("lease_owner", worker);
  await client.from("content_posts").update({ status: "published" }).eq("id", postId).eq("workspace_id", workspaceId).eq("project_id", projectId);
}

export async function processPublications(worker: string, limit = 3, publicationId?: string) {
  if (process.env.SOCIAL_PUBLISHING_ENABLED !== "true") throw new Error("Publicação aguardando ativação pela SOBE.");
  const client = db(); const { data, error } = await client.rpc("claim_social_publications", { p_worker: worker, p_limit: limit, p_publication_id: publicationId || null });
  if (error) throw new Error("Não foi possível reservar a fila.");
  const results = [];
  for (const row of data || []) {
    try { await processPublication(row, worker); results.push({ id: row.id, status: "published" }); }
    catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 80) : "unknown";
      console.error("social_publication_needs_review", { publicationId: row.id, workspaceId: row.workspace_id, projectId: row.project_id, phase: "process", code });
      await client.from("social_publications").update({ status: "needs_review", last_error_code: code, lease_owner: null, lease_until: null }).eq("id", row.id).eq("lease_owner", worker);
      results.push({ id: row.id, status: "needs_review", code });
    }
  }
  return results;
}
