import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  if (!features.nativeCatalogOrders) return apiError("Catálogo nativo desativado.", 404, "feature_disabled");
  const { projectId } = await params;
  const project = await getPublicProjectById(createServiceClient(), projectId);
  if (!project) return apiError("Catálogo não encontrado.", 404, "catalog_not_found");
  return apiSuccess({ categories: project.commercialConfig?.catalogCategories || [], items: (project.commercialConfig?.catalogItems || []).filter((item) => item.isAvailable) });
}
