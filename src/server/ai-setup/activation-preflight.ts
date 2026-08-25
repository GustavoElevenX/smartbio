import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import {
  evaluateActivationPreflight,
  type ActivationPreflight,
  type ActivationPreflightProject,
} from "@/features/ai-setup/activation-preflight";
import type { AISetupActor } from "@/server/auth/setup-actor";
import { resolveWorkspaceEntitlements } from "@/server/entitlements/entitlement-resolver";

export class ActivationPreflightError extends Error {
  readonly status = 403;

  constructor(readonly preflight: ActivationPreflight) {
    super(preflight.blockedReason || "Não é possível iniciar esta configuração agora.");
  }
}

export async function getActivationPreflight(
  actor: AISetupActor,
): Promise<ActivationPreflight> {
  if (actor.persistence === "memory") {
    return evaluateActivationPreflight({
      plan: { key: "local", name: "Modo local", status: "active" },
      features: {
        projects: { enabled: true },
        presence: { enabled: true },
        presence_pages: { enabled: true },
        ai_business_analysis: { enabled: true },
        ai_journey: { enabled: true },
        ai_presence: { enabled: true },
        ai_generations_month: { enabled: true },
      },
      projects: [],
    });
  }

  const database = createServiceClient();
  if (!database) throw new Error("Supabase não configurado.");
  const [entitlements, projectResult] = await Promise.all([
    resolveWorkspaceEntitlements(database, actor.workspaceId),
    database
      .from("projects")
      .select("id,name,status")
      .eq("workspace_id", actor.workspaceId)
      .order("updated_at", { ascending: false }),
  ]);
  if (projectResult.error) throw projectResult.error;
  const projects = (projectResult.data || []).map(
    (project): ActivationPreflightProject => ({
      id: project.id,
      name: project.name,
      status: project.status === "published" ? "published" : "draft",
    }),
  );
  return evaluateActivationPreflight({
    plan: entitlements.plan,
    features: entitlements.features,
    projects,
  });
}

export async function requireActivationPreflight(actor: AISetupActor) {
  const preflight = await getActivationPreflight(actor);
  if (!preflight.allowed) throw new ActivationPreflightError(preflight);
  return preflight;
}
