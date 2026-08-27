import { leadSchema } from "@/lib/validation/schemas";
import { createServiceClient } from "@/lib/supabase/server";
import { derivePublicLeadQualification } from "@/features/leads/public-lead";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { enqueueProjectNotification } from "@/server/notifications/notification-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";
import { registerOpportunity } from "@/server/opportunities/service";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";

const opportunitySourceByCapability = {
  quote: "quote",
  scheduling: "booking",
  catalog_order: "order",
  reservation: "reservation",
  routing: "routed_contact",
} as const;

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const candidate = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rate = await consumeRateLimit("public-lead-submit", publicRateLimitIdentifier(request, {
    projectId: typeof candidate.projectId === "string" ? candidate.projectId : undefined,
    sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : undefined,
  }), rateLimitRules.publicFormSubmit, { failClosed: true });
  const respond = <T extends Response>(response: T) => applyRateLimitHeaders(response, rate);
  if (!rate.allowed) return respond(apiError("Muitas tentativas. Aguarde antes de enviar novamente.", 429, "rate_limited"));
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) return respond(apiError("Dados inválidos.", 400, "validation_error"));
  if (parsed.data.honeypot) return respond(apiSuccess({ accepted: true }, 202));
  const supabase = createServiceClient(); if (!supabase) return respond(apiSuccess({ accepted: true, persisted: false }, 202));
  const project = await getPublicProjectById(supabase, parsed.data.projectId);
  if (!project) return respond(apiError("Projeto não encontrado.", 404, "project_not_found"));
  const conversionGoalId = parsed.data.conversionGoalId && (!project.conversionGoals || project.conversionGoals.some((item) => item.id === parsed.data.conversionGoalId))
    ? parsed.data.conversionGoalId
    : undefined;
  const entryPointId = parsed.data.entryPointId && (!project.entryPoints || project.entryPoints.some((item) => item.id === parsed.data.entryPointId))
    ? parsed.data.entryPointId
    : undefined;
  const destinationId = parsed.data.destinationId && (!project.commercialConfig?.routingDestinations || project.commercialConfig.routingDestinations.some((item) => item.id === parsed.data.destinationId))
    ? parsed.data.destinationId
    : undefined;
  const { answers, qualification } = derivePublicLeadQualification(
    parsed.data.answers,
    project.commercialConfig?.qualificationRules,
  );
  const { data: session } = await supabase.from("visitor_sessions").select("id").eq("project_id", parsed.data.projectId).eq("session_key", parsed.data.sessionId).maybeSingle();
  const expectedSourceType = parsed.data.capability && parsed.data.capability in opportunitySourceByCapability
    ? opportunitySourceByCapability[parsed.data.capability as keyof typeof opportunitySourceByCapability]
    : undefined;
  const { data: linkedOpportunity } = session?.id && expectedSourceType
    ? await supabase.from("commercial_opportunities").select("id,status,estimated_value").eq("project_id", parsed.data.projectId).eq("session_id", session.id).eq("source_type", expectedSourceType).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const { data: lead, error } = await supabase.from("leads").insert({
    workspace_id: project.workspaceId, project_id: parsed.data.projectId, session_id: session?.id || null,
    name: parsed.data.name || null, email: parsed.data.email || null, phone: parsed.data.phone || null,
    company: parsed.data.company || null, status: qualification?.band === "qualified" ? "qualified" : "new", source: parsed.data.source || null,
    campaign: parsed.data.campaign || null, recommendation: qualification?.recommendationKey || parsed.data.recommendation || null,
    answers, score: qualification?.score ?? null,
    qualification_band: qualification?.band || null, qualification_reason: qualification?.reasons.join(" ") || null,
    commercial_action: linkedOpportunity ? parsed.data.capability : qualification ? "qualification" : null,
    commercial_object_id: linkedOpportunity?.id || null,
    operational_status: linkedOpportunity?.status || "lead_captured", estimated_value: linkedOpportunity?.estimated_value == null ? null : Number(linkedOpportunity.estimated_value),
    scheduled_at: null, location_name: parsed.data.locationName || null,
    items: [], attachments: [], timeline: [],
  }).select("id").single();
  if (error) return respond(apiError("Não foi possível salvar o lead.", 400, "lead_submit_failed"));
  const opportunity = linkedOpportunity || await registerOpportunity(supabase, { workspaceId: project.workspaceId, projectId: parsed.data.projectId, projectName: project.name, sessionId: parsed.data.sessionId, sourceType: "lead", sourceId: lead.id, title: `Contato · ${parsed.data.name || "Novo interesse"}`, conversionGoalId, entryPointId, destinationId, attribution: parsed.data.attribution, visitorData: { name: parsed.data.name || "", email: parsed.data.email || "", phone: parsed.data.phone || "", company: parsed.data.company || "" }, summary: qualification?.reasons.join(" ") || parsed.data.recommendation }).catch(() => null);
  await supabase.from("analytics_events").insert({ project_id: parsed.data.projectId, session_id: session?.id || null, event_name: "lead_captured", conversion_goal_id: conversionGoalId || null, entry_point_id: entryPointId || null, destination_id: destinationId || null, presence_page_id: parsed.data.presencePageId || null, presence_section_id: parsed.data.presenceSectionId || null, metadata: { leadId: lead.id, qualificationBand: qualification?.band } });
  await enqueueProjectNotification(parsed.data.projectId, "lead.created", "opportunity", opportunity?.id || lead.id, { visitorName: parsed.data.name, phone: parsed.data.phone, interest: qualification?.recommendationKey || parsed.data.recommendation, location: parsed.data.locationName }).catch(() => undefined);
  return respond(apiSuccess({ accepted: true, persisted: true }, 201));
}
