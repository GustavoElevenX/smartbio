import type { SupabaseClient } from "@supabase/supabase-js";
import { findDemoProject } from "@/data/demo-projects";
import { getPublishedProject } from "@/server/repositories/public-project-repository";
import type { Project } from "@/types";
import { canUseLocalStore } from "@/lib/runtime-mode";
import { findLocalProject } from "@/server/projects/local-project-store";

export async function getPublicProjectById(supabase: SupabaseClient | null, projectId: string): Promise<Project | null> {
  if (!supabase||canUseLocalStore()) return findLocalProject(projectId, true) || findDemoProject(projectId) || null;
  return getPublishedProject(supabase, "id", projectId);
}
