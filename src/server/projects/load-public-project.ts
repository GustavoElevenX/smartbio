import "server-only";

import { findDemoProject } from "@/data/demo-projects";
import { createServiceClient } from "@/lib/supabase/server";
import { getPublishedProjectBySlug } from "@/server/repositories/public-project-repository";

export async function loadPublishedPublicProject(slug: string) {
  const database = createServiceClient();
  return database ? getPublishedProjectBySlug(database, slug) : findDemoProject(slug) || null;
}
