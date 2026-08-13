import type { SupabaseClient } from "@supabase/supabase-js";
import { findDemoProject } from "@/data/demo-projects";
import { getPublishedProject } from "@/server/repositories/public-project-repository";
import type { Project } from "@/types";
import { canUseLocalStore } from "@/lib/runtime-mode";

export async function getPublicProjectById(supabase: SupabaseClient | null, projectId: string): Promise<Project | null> {
  if (!supabase||canUseLocalStore()) return findDemoProject(projectId) || null;
  return getPublishedProject(supabase, "id", projectId);
}
