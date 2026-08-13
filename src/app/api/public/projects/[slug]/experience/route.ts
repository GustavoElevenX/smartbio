import { findDemoProject } from "@/data/demo-projects";
import { createServiceClient } from "@/lib/supabase/server";
import { canUseLocalStore } from "@/lib/runtime-mode";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getPublishedProjectBySlug } from "@/server/repositories/public-project-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = canUseLocalStore() ? null : createServiceClient();
  const project = supabase
    ? await getPublishedProjectBySlug(supabase, slug)
    : findDemoProject(slug) || null;
  if (!project)
    return apiError(
      "Experiência não encontrada ou ainda não publicada.",
      404,
      "project_not_found",
    );
  return apiSuccess({ project });
}
