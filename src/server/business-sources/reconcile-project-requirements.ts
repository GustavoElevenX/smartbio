import "server-only";

import { evaluateCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";

export async function reconcileProjectRequirements(actor: AuthenticatedActor, projectId: string) {
  const project = await loadProjectForActor(actor, projectId);
  if (!project) throw new Error("Projeto não encontrado para recalcular os requisitos.");
  const evaluated = evaluateCapabilityRequirements(project);
  const previous = new Map((project.dataRequirements || []).map((item) => [item.key, item]));
  const requirements = evaluated.map((item) => {
    const existing = previous.get(item.key);
    return existing?.status === "verified" ? existing : item;
  });
  if (actor.persistence === "database") {
    const client = createServiceClient();
    if (!client) throw new Error("Supabase não configurado.");
    const { error } = await client.from("project_data_requirements").upsert(requirements.map((item) => ({
      project_id: projectId,
      requirement_key: item.key,
      label: item.label,
      capability_key: item.capability,
      status: item.status,
      severity: item.severity,
      value: item.value ?? null,
      origin: item.origin || null,
      source_id: item.sourceId || null,
      field_metadata: item.fieldMetadata || {},
      reason: item.reason,
    })), { onConflict: "project_id,requirement_key" });
    if (error) throw new Error("Não foi possível atualizar os requisitos do projeto.");
  }
  return requirements;
}
