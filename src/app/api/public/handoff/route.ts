import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { registerOpportunity } from "@/server/opportunities/service";
import { formatVisitorHandoff, toPerformanceEvidence } from "@/features/handoff/handoff-formatter";
import { buildCommercialBriefing } from "@/features/handoff/commercial-briefing";
import { confirmedHandoffFacts } from "@/features/handoff/confirmed-handoff-facts";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";
import { listPublishedCampaigns } from "@/server/activations/published-campaign-resolver";
import { publicHandoffContextSchema } from "@/features/handoff/public-handoff-schema";

const requestSchema = z.object({ projectId: z.string().min(1), sessionId: z.string().min(1), destinationId: z.string().optional(), context: publicHandoffContextSchema });

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  if (parsed.data.context.projectId !== parsed.data.projectId) return apiError("Contexto inconsistente.", 400, "invalid_handoff_context");
  const rate = await consumeRateLimit("public-commercial-handoff", publicRateLimitIdentifier(request, { projectId: parsed.data.projectId, sessionId: parsed.data.sessionId }), rateLimitRules.publicFormSubmit, { failClosed: true });
  const respond = <T extends Response>(response: T) => applyRateLimitHeaders(response, rate);
  if (!rate.allowed) return respond(apiError("Muitas tentativas em sequência.", 429, "rate_limited"));
  const database = createServiceClient();
  const project = await getPublicProjectById(database, parsed.data.projectId);
  if (!project) return respond(apiError("Projeto não encontrado.", 404, "project_not_found"));
  const destination = project.commercialConfig?.routingDestinations?.find((item) => item.id === parsed.data.destinationId);
  if (parsed.data.destinationId && !destination) return respond(apiError("Destino não encontrado neste projeto.", 422, "invalid_handoff_destination"));
  const locationId = parsed.data.context.intent.locationId;
  if (locationId && !project.commercialConfig?.locations?.some((item) => item.id === locationId && item.isActive)) return respond(apiError("Unidade não disponível.", 422, "invalid_handoff_location"));
  if (locationId && destination?.locationId && destination.locationId !== locationId) return respond(apiError("O destino não corresponde à unidade selecionada.", 422, "invalid_handoff_destination"));
  if (parsed.data.context.conversionGoalId && !project.conversionGoals?.some((item) => item.id === parsed.data.context.conversionGoalId && item.isActive)) return respond(apiError("Caminho não disponível.", 422, "invalid_handoff_goal"));
  const requestedActivationId = parsed.data.context.origin.activationId;
  const publishedActivation = requestedActivationId
    ? (await listPublishedCampaigns(database, project.id)).find((item) => item.status === "active" && item.snapshot.activationId === requestedActivationId)
    : undefined;
  if (requestedActivationId && !publishedActivation) return respond(apiError("Campanha indisponível.", 422, "invalid_handoff_activation"));
  // Public input is always a visitor statement; it cannot certify business facts.
  const confirmedFacts = confirmedHandoffFacts(project, parsed.data.context.intent);
  const safeContext = {
    ...parsed.data.context,
    projectName: project.name,
    origin: { ...parsed.data.context.origin, activationId: publishedActivation?.snapshot.activationId,
      campaign: parsed.data.context.origin.campaign || publishedActivation?.snapshot.activationKey },
    intent: { ...parsed.data.context.intent, kind: project.conversionGoals?.find((item) => item.id === parsed.data.context.conversionGoalId)?.kind },
    qualification: [
      ...parsed.data.context.qualification.filter((item) => !confirmedFacts.some((fact) => fact.label === item.label && fact.value === item.value)).map((item) => ({ ...item, source: "visitor" as const })),
      ...confirmedFacts,
    ],
  };
  const message = formatVisitorHandoff(safeContext, project);
  const briefing = buildCommercialBriefing(safeContext);
  if (!database) return respond(apiSuccess({ persisted: false, message, briefing }, 202));
  const opportunity = await registerOpportunity(database, {
    workspaceId: project.workspaceId,
    projectId: project.id,
    projectName: project.name,
    sessionId: parsed.data.sessionId,
    sourceType: "routed_contact",
    sourceId: `handoff:${parsed.data.sessionId}:${parsed.data.destinationId || "direct"}:${publishedActivation?.snapshot.activationId || "standard"}`,
    title: `Contato iniciado · ${parsed.data.context.intent.label || "Atendimento"}`,
    conversionGoalId: parsed.data.context.conversionGoalId,
    entryPointId: parsed.data.context.origin.entryPointId,
    destinationId: parsed.data.destinationId,
    activationId: publishedActivation?.snapshot.activationId,
    presencePageId: parsed.data.context.origin.pageId,
    attribution: { entryPointId: parsed.data.context.origin.entryPointId, conversionGoalId: parsed.data.context.conversionGoalId, source: parsed.data.context.origin.source || "direct", campaign: safeContext.origin.campaign, presencePageId: parsed.data.context.origin.pageId },
    visitorData: parsed.data.context.identity,
    summary: message,
    metadata: { handoff: safeContext, briefing, activationVersion: publishedActivation?.snapshot.activationVersion, evidence: toPerformanceEvidence(safeContext) },
  });
  return respond(apiSuccess({ persisted: true, opportunityId: opportunity.id, message, briefing }, 201));
}
