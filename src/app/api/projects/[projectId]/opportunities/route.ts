import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { assertProjectAccess } from "@/server/auth/project-access";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

const updateSchema = z.object({ id: z.string().uuid(), status: z.enum(["new", "in_progress", "converted", "lost", "archived"]), confirmedValue: z.number().nonnegative().optional(), lossReason: z.string().trim().min(2).max(500).optional() }).superRefine((value, context) => { if (value.status === "converted" && value.confirmedValue == null) context.addIssue({ code: "custom", message: "Informe o valor confirmado." }); if (value.status === "lost" && !value.lossReason) context.addIssue({ code: "custom", message: "Informe o motivo da perda." }); });

export const GET = withAuthenticatedActor(async (_request, context: { params: Promise<{ projectId: string }> }, actor) => {
  const { projectId } = await context.params; await assertProjectAccess(actor, projectId, "read"); if (actor.persistence === "memory") return apiSuccess([]);
  const supabase = createServiceClient(); if (!supabase) return apiSuccess([]);
  const { data, error } = await supabase.from("commercial_opportunities").select("*,opportunity_timeline(*)").eq("project_id", projectId).eq("workspace_id", actor.workspaceId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message); return apiSuccess(data || []);
});

export const PATCH = withAuthenticatedActor(async (request, context: { params: Promise<{ projectId: string }> }, actor) => {
  const { projectId } = await context.params; await assertProjectAccess(actor, projectId, "write"); const input = updateSchema.parse(await request.json());
  if (actor.persistence === "memory") return apiSuccess(input); const supabase = createServiceClient(); if (!supabase) return apiSuccess(input);
  const { data: current } = await supabase.from("commercial_opportunities").select("first_handled_at,session_id,conversion_goal_id,entry_point_id,destination_id").eq("id", input.id).eq("project_id", projectId).eq("workspace_id", actor.workspaceId).single();
  const now = new Date().toISOString(); const patch = { status: input.status, confirmed_value: input.status === "converted" ? input.confirmedValue : null, loss_reason: input.status === "lost" ? input.lossReason : null, first_handled_at: input.status !== "new" ? current?.first_handled_at || now : current?.first_handled_at || null, converted_at: input.status === "converted" ? now : null, lost_at: input.status === "lost" ? now : null };
  const { data, error } = await supabase.from("commercial_opportunities").update(patch).eq("id", input.id).eq("project_id", projectId).eq("workspace_id", actor.workspaceId).select("*").single(); if (error) throw new Error(error.message);
  await supabase.from("opportunity_timeline").insert({ opportunity_id: input.id, event_type: input.status === "converted" ? "converted" : input.status === "lost" ? "lost" : "status_changed", label: input.status === "converted" ? "Conversão confirmada" : input.status === "lost" ? "Oportunidade perdida" : "Status atualizado", metadata: { status: input.status, confirmedValue: input.confirmedValue, lossReason: input.lossReason } });
  if (input.status === "converted" || input.status === "lost") await supabase.from("analytics_events").insert({ project_id: projectId, session_id: current?.session_id || null, event_name: input.status === "converted" ? "conversion_confirmed" : "conversion_lost", conversion_goal_id: current?.conversion_goal_id || null, entry_point_id: current?.entry_point_id || null, destination_id: current?.destination_id || null, metadata: input.status === "converted" ? { confirmedValue: input.confirmedValue } : { lossReason: input.lossReason } });
  return apiSuccess(data);
});
