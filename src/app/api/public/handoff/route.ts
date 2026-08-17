import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { registerOpportunity } from "@/server/opportunities/service";
import { formatCommercialHandoff, toPerformanceEvidence } from "@/features/handoff/handoff-formatter";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";

const contextSchema = z.object({
  projectId: z.string().min(1),
  conversionGoalId: z.string().optional(),
  origin: z.object({ entryPointId: z.string().optional(), source: z.string().optional(), campaign: z.string().optional(), pageId: z.string().optional(), activationId: z.string().optional() }),
  identity: z.object({ name: z.string().optional(), phone: z.string().optional(), email: z.string().optional() }),
  intent: z.object({ label: z.string().optional(), productIds: z.array(z.string()).max(50).optional(), serviceIds: z.array(z.string()).max(50).optional(), locationId: z.string().optional() }),
  qualification: z.array(z.object({ label: z.string().max(120), value: z.string().max(1000), include: z.boolean() })).max(100),
  benefit: z.object({ label: z.string().optional(), code: z.string().optional() }).optional(),
});
const requestSchema = z.object({ projectId: z.string().min(1), sessionId: z.string().min(1), destinationId: z.string().optional(), context: contextSchema });

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  if (parsed.data.context.projectId !== parsed.data.projectId) return apiError("Contexto inconsistente.", 400, "invalid_handoff_context");
  const rate = await consumeRateLimit("public-commercial-handoff", publicRateLimitIdentifier(request, { projectId: parsed.data.projectId, sessionId: parsed.data.sessionId }), rateLimitRules.publicFormSubmit, { failClosed: true });
  const respond = <T extends Response>(response: T) => applyRateLimitHeaders(response, rate);
  if (!rate.allowed) return respond(apiError("Muitas tentativas em sequência.", 429, "rate_limited"));
  const database = createServiceClient();
  if (!database) return respond(apiSuccess({ persisted: false, message: formatCommercialHandoff(parsed.data.context) }, 202));
  const project = await getPublicProjectById(database, parsed.data.projectId);
  if (!project) return respond(apiError("Projeto não encontrado.", 404, "project_not_found"));
  const message = formatCommercialHandoff(parsed.data.context);
  const opportunity = await registerOpportunity(database, {
    workspaceId: project.workspaceId,
    projectId: project.id,
    projectName: project.name,
    sessionId: parsed.data.sessionId,
    sourceType: "routed_contact",
    sourceId: `handoff:${parsed.data.sessionId}:${parsed.data.destinationId || "direct"}`,
    title: `Contato encaminhado · ${parsed.data.context.intent.label || "Atendimento"}`,
    conversionGoalId: parsed.data.context.conversionGoalId,
    entryPointId: parsed.data.context.origin.entryPointId,
    destinationId: parsed.data.destinationId,
    presencePageId: parsed.data.context.origin.pageId,
    attribution: { entryPointId: parsed.data.context.origin.entryPointId, conversionGoalId: parsed.data.context.conversionGoalId, source: parsed.data.context.origin.source || "direct", campaign: parsed.data.context.origin.campaign, presencePageId: parsed.data.context.origin.pageId },
    visitorData: parsed.data.context.identity,
    summary: message,
    metadata: { handoff: parsed.data.context, evidence: toPerformanceEvidence(parsed.data.context) },
  });
  return respond(apiSuccess({ persisted: true, opportunityId: opportunity.id, message }, 201));
}
