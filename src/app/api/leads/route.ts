import { leadSchema } from "@/lib/validation/schemas";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { enqueueProjectNotification } from "@/server/notifications/notification-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";
import { registerOpportunity } from "@/server/opportunities/service";

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
  const { data: project, error: projectError } = await supabase.from("projects").select("workspace_id").eq("id", parsed.data.projectId).eq("status", "published").single();
  if (projectError || !project) return respond(apiError("Projeto não encontrado.", 404, "project_not_found"));
  const { data: session } = await supabase.from("visitor_sessions").select("id").eq("session_key", parsed.data.sessionId).maybeSingle();
  const { data: lead, error } = await supabase.from("leads").insert({
    workspace_id: project.workspace_id, project_id: parsed.data.projectId, session_id: session?.id || null,
    name: parsed.data.name || null, email: parsed.data.email || null, phone: parsed.data.phone || null,
    company: parsed.data.company || null, status: parsed.data.status, source: parsed.data.source || null,
    campaign: parsed.data.campaign || null, recommendation: parsed.data.recommendation || null,
    answers: parsed.data.answers, score: parsed.data.score || null,
    qualification_band: parsed.data.qualificationBand || null, qualification_reason: parsed.data.qualificationReason || null,
    commercial_action: parsed.data.commercialAction || null, commercial_object_id: parsed.data.commercialObjectId || null,
    operational_status: parsed.data.operationalStatus || null, estimated_value: parsed.data.estimatedValue || null,
    scheduled_at: parsed.data.scheduledAt || null, location_name: parsed.data.locationName || null,
    items: parsed.data.items || [], attachments: parsed.data.attachments || [], timeline: parsed.data.timeline || [],
  }).select("id").single();
  if (error) return respond(apiError("Não foi possível salvar o lead.", 400, "lead_submit_failed"));
  const opportunity = !parsed.data.commercialObjectId ? await registerOpportunity(supabase, { workspaceId: project.workspace_id, projectId: parsed.data.projectId, sessionId: parsed.data.sessionId, sourceType: "lead", sourceId: lead.id, title: `Contato · ${parsed.data.name || "Novo interesse"}`, conversionGoalId: parsed.data.conversionGoalId, entryPointId: parsed.data.entryPointId, destinationId: parsed.data.destinationId, attribution: parsed.data.attribution, visitorData: { name: parsed.data.name || "", email: parsed.data.email || "", phone: parsed.data.phone || "", company: parsed.data.company || "" }, summary: parsed.data.recommendation, estimatedValue: parsed.data.estimatedValue }).catch(() => null) : null;
  await enqueueProjectNotification(parsed.data.projectId, "lead.created", "opportunity", opportunity?.id || parsed.data.commercialObjectId || lead.id, { visitorName: parsed.data.name, phone: parsed.data.phone, interest: parsed.data.recommendation, location: parsed.data.locationName }).catch(() => undefined);
  return respond(apiSuccess({ accepted: true, persisted: true }, 201));
}
