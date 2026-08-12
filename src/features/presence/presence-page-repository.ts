"use client";

import { isSupabaseConfigured } from "@/lib/supabase/client";
import { projectRepository } from "@/lib/repositories/project-repository";
import type { PresencePage } from "./presence.types";
import type { Project } from "@/types";

export class PresencePageConflictError extends Error {}

export async function savePresencePage(project: Project, page: PresencePage, deletedSectionIds: string[] = []) {
  if (!isSupabaseConfigured()) {
    const pages = project.presence?.pages || [];
    const next = pages.some((item) => item.id === page.id) ? pages.map((item) => item.id === page.id ? page : item) : [...pages, page];
    const saved = await projectRepository.saveProject({ ...project, presence: { pages: next }, updatedAt: new Date().toISOString() });
    return saved.presence!.pages.find((item) => item.id === page.id)!;
  }
  const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/presence/pages/${encodeURIComponent(page.id)}`, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ page, expectedVersion: page.createdAt ? page.version || 1 : 0, deletedSectionIds }),
  });
  const payload = await response.json() as { data?: PresencePage; error?: string; code?: string };
  if (response.status === 409) throw new PresencePageConflictError(payload.error || "A página mudou em outra sessão.");
  if (!response.ok || !payload.data) throw new Error(payload.error || "Não foi possível salvar a página.");
  return payload.data;
}

export async function deletePresencePage(project: Project, pageId: string) {
  const page = project.presence?.pages.find((item) => item.id === pageId);
  if (!page || page.isHome) throw new Error("A página inicial não pode ser excluída.");
  if (project.entryPoints?.some((entry) => entry.presencePageId === pageId)) throw new Error("Remova as entradas ligadas a esta página antes de excluí-la.");
  if (!isSupabaseConfigured()) return projectRepository.saveProject({ ...project, presence: { pages: (project.presence?.pages || []).filter((item) => item.id !== pageId) } });
  const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/presence/pages/${encodeURIComponent(pageId)}`, { method: "DELETE" });
  const payload = await response.json() as { error?: string };
  if (!response.ok) throw new Error(payload.error || "Não foi possível excluir a página.");
  return { ...project, presence: { pages: (project.presence?.pages || []).filter((item) => item.id !== pageId) } };
}
