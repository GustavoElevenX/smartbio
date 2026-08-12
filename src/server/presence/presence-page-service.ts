import "server-only";

import { z } from "zod";
import { presencePageSchema } from "@/features/presence/presence-page.schema";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { createServiceClient } from "@/lib/supabase/server";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";

const inputSchema = z.object({ page: presencePageSchema, expectedVersion: z.number().int().min(0), deletedSectionIds: z.array(z.string()).default([]) });
export class PresenceSaveConflictError extends Error {}

export async function savePresencePageForActor(actor: AuthenticatedActor, projectId: string, raw: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const input = inputSchema.parse(raw);
  if (input.page.projectId !== projectId) throw new Error("A página não pertence a este projeto.");
  if (actor.persistence === "memory") return input.page;
  const database = createServiceClient();
  if (!database) throw new Error("Supabase não configurado.");
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
