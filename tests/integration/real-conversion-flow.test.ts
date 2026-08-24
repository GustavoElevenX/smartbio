import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Project } from "@/types";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";

const database = createClient(process.env.INTEGRATION_TEST_SUPABASE_URL!, process.env.INTEGRATION_TEST_SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const userId = process.env.INTEGRATION_TEST_USER_ID!;
let workspaceId: string | undefined;

describe("real Supabase conversion lifecycle", () => {
  it("persists version → session → event → opportunity → confirmed conversion without preview analytics", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const workspace = await database.from("workspaces").insert({ name: `Integration ${suffix}`, slug: `integration-${suffix}`, owner_id: userId }).select("id").single();
    if (workspace.error) throw workspace.error;
    workspaceId = workspace.data.id;
    await database.from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.INTEGRATION_TEST_SUPABASE_URL!;
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.INTEGRATION_TEST_SUPABASE_SERVICE_ROLE_KEY!;
    process.env.OPENAI_API_KEY = "";
    const { aiSetupService } = await import("@/server/ai-setup/ai-setup-service");
    const actor: AuthenticatedActor = { userId, email: "integration@sobe.test", workspaceId: workspace.data.id, role: "owner", persistence: "database", mode: "workspace" };
    let onboarding = await aiSetupService.start(actor, { businessName: `Integration ${suffix}`, description: "Consultoria de integração com atendimento comercial por formulário.", phone: "5511999999999" });
    onboarding = await aiSetupService.analyze(actor, onboarding.id);
    onboarding = await aiSetupService.confirmVisitorActions(actor, onboarding.id, onboarding.visitorActions);
    onboarding = await aiSetupService.generate(actor, onboarding.id);
    const draft = onboarding.projectDraft as Project;
    const project = await database.from("projects").insert({ id: draft.id, workspace_id: workspaceId, name: draft.name, slug: `integration-project-${suffix}`, description: draft.description, status: "draft", primary_goal: draft.primaryGoal, category: draft.category || null, theme: draft.designSystem, settings: { version: draft.version, projectPayload: { ...draft, slug: `integration-project-${suffix}` } } }).select("id").single();
    if (project.error) throw project.error;
    await aiSetupService.complete(actor, onboarding.id, project.data.id);
    const completedOnboarding = await database.from("ai_setup_sessions").select("status,project_id").eq("id", onboarding.id).single();
    expect(completedOnboarding.data).toMatchObject({ status: "completed", project_id: project.data.id });
    const experiment = await database.from("optimization_experiments").insert({ workspace_id: workspaceId, project_id: project.data.id, source_suggestion_key: `integration:${suffix}`, suggestion_kind: "presence_cta", change_type: "change_cta_copy", proposed_change: { before: { label: "Falar" }, after: { label: "Pedir proposta" } }, target_metric: "intention_rate", status: "approved", risk_level: "low", created_by: userId }).select("id").single();
    if (experiment.error) throw experiment.error;
    const version = await database.from("project_versions").insert({ project_id: project.data.id, version_number: 1, snapshot: { id: project.data.id, integration: true }, created_by: userId }).select("id").single();
    if (version.error) throw version.error;
    await database.from("projects").update({ status: "published", published_at: new Date().toISOString(), published_version_id: version.data.id }).eq("id", project.data.id);
    const linked = await database.rpc("link_published_optimization_experiments", { target_project: project.data.id, target_version: version.data.id, published_at: new Date().toISOString() });
    if (linked.error) throw linked.error;
    const sessionKey = `integration:${suffix}`;
    const session = await database.from("visitor_sessions").insert({ project_id: project.data.id, project_version_id: version.data.id, visitor_id: `visitor:${suffix}`, session_key: sessionKey, utm_source: "integration", utm_medium: "test", utm_campaign: "version-attribution" }).select("id,project_version_id").single();
    if (session.error) throw session.error;
    await database.from("analytics_events").insert([{ project_id: project.data.id, project_version_id: version.data.id, session_id: session.data.id, event_name: "page_view", metadata: {} }, { project_id: project.data.id, project_version_id: version.data.id, session_id: session.data.id, event_name: "conversion_goal_selected", metadata: {} }, { project_id: project.data.id, project_version_id: version.data.id, session_id: session.data.id, event_name: "form_submitted", metadata: {} }]);
    const opportunity = await database.from("commercial_opportunities").insert({ workspace_id: workspaceId, project_id: project.data.id, project_version_id: version.data.id, session_id: session.data.id, source_type: "lead", source_id: `integration:${suffix}`, status: "converted", title: "Integration opportunity", confirmed_value: 100, currency: "BRL", attribution: { source: "integration", campaign: "version-attribution" }, metadata: {} }).select("id,project_version_id,confirmed_value").single();
    if (opportunity.error) throw opportunity.error;
    await database.from("analytics_events").insert({ project_id: project.data.id, project_version_id: version.data.id, session_id: session.data.id, event_name: "conversion_confirmed", metadata: { confirmedValue: 100 } });
    const [events, preview] = await Promise.all([
      database.from("analytics_events").select("event_name,project_version_id").eq("project_id", project.data.id),
      database.from("analytics_events").select("id", { count: "exact", head: true }).eq("project_id", project.data.id).eq("metadata->>preview", "true"),
    ]);
    expect(events.data?.map((row) => row.event_name)).toEqual(expect.arrayContaining(["page_view", "conversion_goal_selected", "form_submitted", "conversion_confirmed"]));
    expect(events.data?.every((row) => row.project_version_id === version.data.id)).toBe(true);
    expect(Number(opportunity.data.confirmed_value)).toBe(100);
    expect(preview.count).toBe(0);
    const linkedExperiment = await database.from("optimization_experiments").select("candidate_version_id,status").eq("id", experiment.data.id).single();
    expect(linkedExperiment.data).toMatchObject({ candidate_version_id: version.data.id, status: "collecting" });
  });
});

afterAll(async () => {
  if (workspaceId) await database.from("workspaces").delete().eq("id", workspaceId);
});
