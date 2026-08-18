import { apiError, apiSuccess } from "@/server/http/api-response";
import { loadPublishedPublicProject } from "@/server/projects/load-public-project";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const project = await loadPublishedPublicProject(slug);
  if (!project)
    return apiError(
      "Experiência não encontrada ou ainda não publicada.",
      404,
      "project_not_found",
    );
  return apiSuccess({ project });
}
