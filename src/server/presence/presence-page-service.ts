import "server-only";

import { z } from "zod";
import { presencePageSchema } from "@/features/presence/presence-page.schema";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { createServiceClient } from "@/lib/supabase/server";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import { requireEntitlement, requireResourceCapacity } from "@/server/entitlements/require-entitlement";

const inputSchema = z.object({ page: presencePageSchema, expectedVersion: z.number().int().min(0), deletedSectionIds: z.array(z.string()).default([]) });
export class PresenceSaveConflictError extends Error {}

async function assertPresenceCapacity(actor: AuthenticatedActor, projectId: string, page: z.infer<typeof presencePageSchema>, database: NonNullable<ReturnType<typeof createServiceClient>>) {
  const [{ data: existing }, sectionEntitlement] = await Promise.all([
    database.from("presence_pages").select("id").eq("id", page.id).eq("project_id", projectId).maybeSingle(),
    requireEntitlement({ database, workspaceId: actor.workspaceId, feature: "presence_sections_per_page" }),
  ]);
  if (!existing) await requireResourceCapacity({ database, workspaceId: actor.workspaceId, feature: "presence_pages" });
  if (sectionEntitlement.limit != null && page.sections.length > sectionEntitlement.limit) throw new Error(`Esta página excede o limite de ${sectionEntitlement.limit} seções do seu plano.`);
  if (!page.settings.footer.showVirouBranding) await requireEntitlement({ database, workspaceId: actor.workspaceId, feature: "remove_virou_branding" });
}

export async function savePresencePageForActor(actor: AuthenticatedActor, projectId: string, raw: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const input = inputSchema.parse(raw);
  if (input.page.projectId !== projectId) throw new Error("A página não pertence a este projeto.");
  if (actor.persistence === "memory") return input.page;
  const database = createServiceClient();
  if (!database) throw new Error("Supabase não configurado.");
  await assertPresenceCapacity(actor, projectId, input.page, database);
  const { error } = await database.rpc("save_presence_page", { p_workspace_id: actor.workspaceId, p_actor_id: actor.userId, p_project_id: projectId, p_expected_version: input.expectedVersion, p_payload: { page: input.page, deletedSectionIds: input.deletedSectionIds } });
  if (error) {
    if (error.code === "40001" || error.message.includes("presence_page_version_conflict")) throw new PresenceSaveConflictError("Esta página foi alterada em outra sessão. Recarregue antes de salvar.");
    throw new Error("Não foi possível salvar a página em uma transação.");
  }
  const project = await loadProjectForActor(actor, projectId);
  const page = project?.presence?.pages.find((item) => item.id === input.page.id);
  if (!page) throw new Error("A página foi salva, mas não pôde ser recarregada.");
  return page;
}

export async function savePresencePagesForActor(actor: AuthenticatedActor, projectId: string, rawPages: Array<{ page: unknown; expectedVersion: number; deletedSectionIds?: string[] }>) {
  await assertProjectAccess(actor, projectId, "write");
  const inputs = rawPages.map((raw) => inputSchema.parse(raw));
  if (inputs.some((input) => input.page.projectId !== projectId)) throw new Error("Uma das páginas não pertence a este projeto.");
  if (actor.persistence === "memory") return inputs.map((input) => input.page);
  const database = createServiceClient();
  if (!database) throw new Error("Supabase não configurado.");
  await Promise.all(inputs.map((input) => assertPresenceCapacity(actor, projectId, input.page, database)));
  const { error } = await database.rpc("save_presence_site_draft", {
    p_workspace_id: actor.workspaceId,
    p_actor_id: actor.userId,
    p_project_id: projectId,
    p_pages: inputs.map((input) => ({ page: input.page, expectedVersion: input.expectedVersion, deletedSectionIds: input.deletedSectionIds })),
  });
  if (error) {
    if (error.code === "40001" || error.message.includes("presence_page_version_conflict")) throw new PresenceSaveConflictError("Uma página foi alterada em outra sessão. Gere novamente a proposta.");
    throw new Error("Não foi possível aplicar todas as páginas em uma única transação.");
  }
  const project = await loadProjectForActor(actor, projectId);
  return project?.presence?.pages.filter((page) => inputs.some((input) => input.page.id === page.id)) || [];
}

export async function deletePresencePageForActor(actor: AuthenticatedActor, projectId: string, pageId: string) {
  await assertProjectAccess(actor, projectId, "write");
  if (actor.persistence === "memory") return;
  const database = createServiceClient();
  if (!database) throw new Error("Supabase não configurado.");
  const { data: page } = await database.from("presence_pages").select("is_home").eq("id", pageId).eq("project_id", projectId).maybeSingle();
  if (!page) throw new Error("Página não encontrada.");
  if (page.is_home) throw new Error("A página inicial não pode ser excluída.");
  const { count } = await database.from("entry_points").select("id", { count: "exact", head: true }).eq("presence_page_id", pageId);
  if (count) throw new Error("Remova as entradas ligadas a esta página antes de excluí-la.");
  const { error } = await database.from("presence_pages").delete().eq("id", pageId).eq("project_id", projectId);
  if (error) throw new Error("Não foi possível excluir a página.");
}
