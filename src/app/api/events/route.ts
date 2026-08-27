import { publicAnalyticsEventSchema } from "@/lib/validation/schemas";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";
import { recordProjectLifecycleMilestone } from "@/server/product-lifecycle/project-lifecycle";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const candidate = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rate = await consumeRateLimit("public-analytics", publicRateLimitIdentifier(request, {
    projectId: typeof candidate.projectId === "string" ? candidate.projectId : undefined,
    sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : undefined,
  }), rateLimitRules.publicAnalytics, { failClosed: true });
  const respond = <T extends Response>(response: T) => applyRateLimitHeaders(response, rate);
  if (!rate.allowed) return respond(apiError("Muitas requisições.", 429, "rate_limited"));
  const parsed = publicAnalyticsEventSchema.safeParse(raw);
  if (!parsed.success) return respond(apiError("Evento inválido.", 400, "validation_error"));
  const supabase = createServiceClient();
  if (!supabase) return respond(apiSuccess({ accepted: true, persisted: false }, 202));
  const data = parsed.data;
  const { data: session } = await supabase.from("visitor_sessions").select("id,project_id,project_version_id").eq("session_key", data.sessionId).maybeSingle();
  if (session && session.project_id !== data.projectId) return respond(apiError("Sessão inválida.", 400, "session_project_mismatch"));
  let sessionId = session?.id;
  let projectVersionId = session?.project_version_id || null;
  if (!sessionId) {
    const { data: project } = await supabase.from("projects").select("published_version_id,status").eq("id", data.projectId).maybeSingle();
    if (!project || project.status !== "published") return respond(apiError("Projeto indisponível.", 404, "project_unavailable"));
    projectVersionId = project.published_version_id || null;
    const { data: inserted, error: sessionError } = await supabase.from("visitor_sessions").insert({ project_id: data.projectId, project_version_id: projectVersionId, visitor_id: data.visitorId, session_key: data.sessionId, conversion_goal_id: data.conversionGoalId || null, entry_point_id: data.entryPointId || null, destination_id: data.destinationId || null, presence_page_id: data.presencePageId || null, presence_section_id: data.presenceSectionId || null, activation_id: data.activationId || null, benefit_claim_id: data.benefitClaimId || null, referrer: data.referrer || null, utm_source: data.utmSource || null, utm_medium: data.utmMedium || null, utm_campaign: data.utmCampaign || null, utm_content: data.utmContent || null, utm_term: data.utmTerm || null, device_type: data.deviceType || null }).select("id,project_version_id").single();
    if (sessionError) return respond(apiError("Não foi possível iniciar a sessão.", 400, "session_start_failed")); sessionId = inserted.id; projectVersionId = inserted.project_version_id;
    if (["page_view", "presence_page_viewed", "session_started"].includes(data.eventName)) void recordProjectLifecycleMilestone(supabase, { eventName: "first_traffic_received", projectId: data.projectId, metadata: { versionId: projectVersionId || "unknown" } }).catch(() => undefined);
  }
  await supabase.from("visitor_sessions").update({ conversion_goal_id: data.conversionGoalId || null, entry_point_id: data.entryPointId || null, destination_id: data.destinationId || null, presence_page_id: data.presencePageId || null, presence_section_id: data.presenceSectionId || null, activation_id: data.activationId || null, benefit_claim_id: data.benefitClaimId || null }).eq("id", sessionId);
  const eventRow = { project_id: data.projectId, project_version_id: projectVersionId, session_id: sessionId, event_name: data.eventName, idempotency_key: data.idempotencyKey || null, step_id: data.stepId || null, option_id: data.optionId || null, conversion_goal_id: data.conversionGoalId || null, entry_point_id: data.entryPointId || null, destination_id: data.destinationId || null, presence_page_id: data.presencePageId || null, presence_section_id: data.presenceSectionId || null, activation_id: data.activationId || null, benefit_claim_id: data.benefitClaimId || null, metadata: { ...data.metadata, utm_source: data.utmSource, utm_medium: data.utmMedium, utm_campaign: data.utmCampaign, utm_content: data.utmContent, utm_term: data.utmTerm } };
  const { error } = await supabase.from("analytics_events").insert(eventRow);
  if (error?.code === "23505" && data.idempotencyKey) return respond(apiSuccess({ accepted: true, persisted: true, idempotent: true }, 200));
  if (error) return respond(apiError("Não foi possível registrar o evento.", 400, "event_submit_failed"));
  return respond(apiSuccess({ accepted: true, persisted: true }, 201));
}
