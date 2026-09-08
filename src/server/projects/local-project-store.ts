import "server-only";
import { canUseLocalStore } from "@/lib/runtime-mode";
import type { Project } from "@/types";

declare global { var __sobeLocalProjects: Map<string, Project> | undefined }

export function saveLocalProject(project: Project) {
  if (!canUseLocalStore()) throw new Error("Persistência local não está habilitada.");
  (globalThis.__sobeLocalProjects ??= new Map()).set(project.id, structuredClone(project));
  return project;
}

export function findLocalProject(value: string, publishedOnly = false) {
  if (!canUseLocalStore()) return null;
  const project = [...(globalThis.__sobeLocalProjects?.values() || [])].find((item) => item.id === value || item.slug === value);
  return project && (!publishedOnly || project.status === "published") ? structuredClone(project) : null;
}
