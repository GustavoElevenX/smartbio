import "server-only";

import { findDemoProject } from "@/data/demo-projects";
import { createServiceClient } from "@/lib/supabase/server";
import { getPublishedProjectBySlug } from "@/server/repositories/public-project-repository";
import { canUseLocalStore, isProduction } from "@/lib/runtime-mode";
import { ProductionConfigurationError } from "@/server/auth/auth-errors";

export async function loadPublishedPublicProject(slug: string) {
  if(canUseLocalStore())return findDemoProject(slug)||null;
  const database = createServiceClient();
  if (!database) {
    if (isProduction()) throw new ProductionConfigurationError("O Supabase é obrigatório para projetos públicos em produção.");
    return null;
  }
  try {
    return await getPublishedProjectBySlug(database, slug);
  } catch (error) {
    if (isProduction()) throw error;
    return null;
  }
}
