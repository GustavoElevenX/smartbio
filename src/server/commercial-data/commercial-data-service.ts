import "server-only";

import { commercialDataInputSchema, type CommercialDataInput } from "@/features/commercial-data/commercial-data.schema";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { commercialDatabase } from "@/server/commercial-data/repository-utils";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import { requireEntitlement } from "@/server/entitlements/require-entitlement";
import { DEFAULT_CATALOG_THRESHOLDS } from "@/features/site-composer/catalog-strategy";
import { projectCommercialContextService } from "@/server/commercial-context/project-commercial-context-service";

export class CommercialDataConflictError extends Error {
  readonly status = 409;
}

export async function saveCommercialData(actor: AuthenticatedActor, projectId: string, rawInput: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const input: CommercialDataInput = commercialDataInputSchema.parse(rawInput);
  if (actor.persistence === "memory") return input;
  const database = commercialDatabase();
  if ((input.data.catalogItems?.length || 0) > DEFAULT_CATALOG_THRESHOLDS.featuredMax) {
    await requireEntitlement({ database, workspaceId: actor.workspaceId, feature: "catalog_large" });
  }
  const { error } = await database.rpc("save_project_commercial_data", {
    p_workspace_id: actor.workspaceId,
    p_project_id: projectId,
    p_actor_id: actor.userId,
    p_payload: input,
  });
  if (error) {
    if (error.code === "40001" || error.message.includes("project_version_conflict")) {
      throw new CommercialDataConflictError("Este projeto foi alterado em outra sessão. Recarregue antes de salvar novamente.");
    }
    throw new Error("Não foi possível salvar os dados comerciais em uma transação.");
  }
  const aggregate = await loadProjectForActor(actor, projectId);
  if (!aggregate) throw new Error("Os dados foram salvos, mas o agregado não pôde ser recarregado.");
  await projectCommercialContextService.synchronizeOperationalChanges(actor, aggregate);
  return aggregate;
}
