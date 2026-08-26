import { resolveRoute } from "@/features/routing/routing-engine";
import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { routingResolveSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const candidate = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rate = await consumeRateLimit("public-route-resolve", publicRateLimitIdentifier(request, {
    projectId: typeof candidate.projectId === "string" ? candidate.projectId : undefined,
    sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : undefined,
  }), rateLimitRules.publicRouteResolve, { failClosed: false });
  const respond = <T extends Response>(response: T) => applyRateLimitHeaders(response, rate);
  if (!rate.allowed) return respond(apiError("Muitas consultas de rota.", 429, "rate_limited"));
  if (!features.nativeRouting) return respond(apiError("Roteamento nativo desativado.", 404, "feature_disabled"));
  const parsed = routingResolveSchema.safeParse(raw);
  if (!parsed.success) return respond(validationError(parsed.error));
  const project = await getPublicProjectById(createServiceClient(), parsed.data.projectId);
  if (!project) return respond(apiError("Projeto não encontrado.", 404, "project_not_found"));
  const destinations = project.commercialConfig?.routingDestinations || [];
  const fallbackDestinationId = destinations.find((item) => item.isDefault && item.role === "general_contact")?.id;
  const result = resolveRoute(parsed.data.context, project.commercialConfig?.routingRules || [], destinations, fallbackDestinationId, project.commercialConfig?.locations || []);
  return respond(apiSuccess({ result }));
}
