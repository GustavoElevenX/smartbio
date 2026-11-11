import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { BenefitRepository } from "@/server/benefits/benefit-repository";
import { getPublishedActivation } from "@/server/activations/get-published-activation";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { registerOpportunity } from "@/server/opportunities/service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";
import { publicHandoffContextSchema } from "@/features/handoff/public-handoff-schema";
import { confirmedHandoffFacts } from "@/features/handoff/confirmed-handoff-facts";
import { formatVisitorHandoff } from "@/features/handoff/handoff-formatter";
import { buildCommercialBriefing } from "@/features/handoff/commercial-briefing";

const schema = z.object({ projectId: z.string().min(1), sessionId: z.string().min(1), claimId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(12).max(180), destinationId: z.string().max(150).optional(),
  locationId: z.string().max(150).optional(), entryPointId: z.string().max(150).optional(),
  presencePageId: z.string().max(150).optional(), presenceSectionId: z.string().max(150).optional(),
  conversionGoalId: z.string().max(150).optional(), context: publicHandoffContextSchema.optional() });

export async function POST(request: Request, { params }: RouteContext<"/api/public/activations/[activationId]/handoff">) {
  const { activationId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const rate = await consumeRateLimit("activation-handoff", publicRateLimitIdentifier(request, { projectId: input.projectId, sessionId: input.sessionId }), rateLimitRules.activationHandoff, { failClosed: true });
  const respond = <T extends Response>(response: T) => applyRateLimitHeaders(response, rate);
  if (!rate.allowed) return respond(apiError("Muitas tentativas em sequência.", 429, "rate_limited"));
  const database = createServiceClient();
  if (!database) return respond(apiSuccess({ presented: false, persisted: false }, 202));
  const [project, published] = await Promise.all([
    getPublicProjectById(database, input.projectId), getPublishedActivation(database, input.projectId, activationId),
  ]);
  if (!project || !published || published.status !== "active") return respond(apiError("Ativação inválida.", 404, "invalid_activation"));
  const activation = published.snapshot;
  if (input.context && (input.context.projectId !== project.id || input.context.origin.activationId !== activationId)) {
    return respond(apiError("Contexto da campanha inconsistente.", 422, "invalid_activation_context"));
  }
  const { data: claim } = await database.from("benefit_claims").select("*").eq("project_id", project.id).eq("activation_id", activationId).eq("id", input.claimId).maybeSingle();
  if (!claim) return respond(apiError("Benefício inválido.", 404, "claim_not_found"));
  const claimBenefit = claim.benefit_snapshot && typeof claim.benefit_snapshot === "object" ? claim.benefit_snapshot as Record<string, unknown> : {};
  const claimVersion = typeof claim.activation_version === "number" ? claim.activation_version : activation.activationVersion;
  const claimOfferId = typeof claim.offer_id === "string" ? claim.offer_id : undefined;
  const claimOfferLabel = claimBenefit.offerType !== "no_discount" && typeof claimBenefit.label === "string" ? claimBenefit.label : undefined;
  if (input.context?.origin.activationVersion && input.context.origin.activationVersion !== claimVersion) {
    return respond(apiError("Versão da campanha inconsistente.", 422, "invalid_activation_version"));
  }
  if (input.context?.benefit?.offerId && input.context.benefit.offerId !== claimOfferId) {
    return respond(apiError("Oferta da campanha inconsistente.", 422, "invalid_activation_offer"));
  }
  const { data: existing } = await database.from("activation_handoffs").select("opportunity_id").eq("project_id", project.id).eq("activation_id", activationId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (existing) return respond(apiSuccess({ presented: true, opportunityId: existing.opportunity_id, idempotent: true }));
  const facts = input.context ? confirmedHandoffFacts(project, input.context.intent) : [];
  const safeContext = input.context ? {
    ...input.context, projectName: project.name, conversionGoalId: activation.conversionGoalId,
    origin: { ...input.context.origin, activationId, activationVersion: claimVersion, campaign: input.context.origin.campaign || activation.activationKey },
    intent: { ...input.context.intent, kind: project.conversionGoals?.find((item) => item.id === activation.conversionGoalId)?.kind },
    qualification: [
      ...input.context.qualification.filter((item) => !facts.some((fact) => fact.label === item.label && fact.value === item.value)).map((item) => ({ ...item, source: "visitor" as const })),
      ...facts,
    ],
    benefit: { offerId: claimOfferId, label: claimOfferLabel, code: claim.code },
  } : undefined;
  const briefing = safeContext ? buildCommercialBriefing(safeContext) : undefined;
  const message = safeContext ? formatVisitorHandoff(safeContext, project) : undefined;
  const opportunity = await registerOpportunity(database, {
    workspaceId: project.workspaceId, projectId: project.id, projectName: project.name, sessionId: input.sessionId,
    sourceType: "routed_contact", sourceId: `handoff:${input.idempotencyKey}`, title: `Atendimento · ${activation.name}`,
    conversionGoalId: activation.conversionGoalId, entryPointId: input.entryPointId,
    destinationId: input.destinationId || activation.defaultDestinationId, presencePageId: input.presencePageId,
    presenceSectionId: input.presenceSectionId, activationId, benefitClaimId: claim.id, customerIdentityId: claim.customer_identity_id,
    attribution: { source: safeContext?.origin.source || "campaign", campaign: safeContext?.origin.campaign || activation.activationKey,
      entryPointId: input.entryPointId, conversionGoalId: activation.conversionGoalId, presencePageId: input.presencePageId },
    summary: message, metadata: { activationId, activationVersion: claimVersion, offerId: claimOfferId, benefitClaimId: claim.id,
      benefitLabel: claimOfferLabel, briefing, handoff: safeContext },
  });
  await new BenefitRepository(database).markPresented(project.id, claim.id, opportunity.id);
  const { data: event } = await database.from("analytics_events").insert({ project_id: project.id, event_name: "benefit_claim_presented", activation_id: activationId,
    benefit_claim_id: claim.id, destination_id: input.destinationId || activation.defaultDestinationId || null,
    metadata: { locationId: input.locationId, idempotencyKey: input.idempotencyKey, campaign: activation.activationKey,
      activationVersion: claimVersion, offerId: claimOfferId } }).select("id").single();
  const { error } = await database.from("activation_handoffs").insert({ workspace_id: project.workspaceId, project_id: project.id, activation_id: activationId,
    claim_id: claim.id, idempotency_key: input.idempotencyKey, opportunity_id: opportunity.id, presented_event_id: event?.id || null });
  if (error?.code === "23505") {
    const { data: retry } = await database.from("activation_handoffs").select("opportunity_id").eq("project_id", project.id).eq("activation_id", activationId).eq("idempotency_key", input.idempotencyKey).single();
    return respond(apiSuccess({ presented: true, opportunityId: retry?.opportunity_id || opportunity.id, idempotent: true }));
  }
  if (error) throw error;
  return respond(apiSuccess({ presented: true, opportunityId: opportunity.id }));
}
