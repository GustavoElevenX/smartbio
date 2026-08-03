import { resolveRoute } from "@/features/routing/routing-engine";
import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { routingResolveSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, requestIp, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { checkRateLimit } from "@/server/services/rate-limit";

export async function POST(request: Request) {
  if (!features.nativeRouting) return apiError("Roteamento nativo desativado.", 404, "feature_disabled");
  if (!checkRateLimit(`routing:${requestIp(request)}`, 30, 60_000)) return apiError("Muitas consultas de rota.", 429, "rate_limited");
  const parsed = routingResolveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const project = await getPublicProjectById(createServiceClient(), parsed.data.projectId);
  if (!project) return apiError("Projeto não encontrado.", 404, "project_not_found");
  const destinations = project.commercialConfig?.routingDestinations || [];
  const result = resolveRoute(parsed.data.context, project.commercialConfig?.routingRules || [], destinations, destinations[0]?.id);
  return apiSuccess({ result });
}
