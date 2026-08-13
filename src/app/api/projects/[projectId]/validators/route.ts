import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { assertProjectAccess } from "@/server/auth/project-access";
import { createValidatorSecret } from "@/server/benefits/validator-auth";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { requireEntitlement } from "@/server/entitlements/require-entitlement";

const schema = z.object({ name: z.string().trim().min(2).max(80), locationId: z.string().uuid().optional() });

export const GET = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/validators">, actor) => {
  const { projectId } = await context.params;
  await assertProjectAccess(actor, projectId, "read");
  const database = createServiceClient();
  if (!database) return apiSuccess([]);
  const { data, error } = await database.from("redemption_validators").select("id,name,location_id,last_used_at,is_active,created_at").eq("project_id", projectId).eq("workspace_id", actor.workspaceId).order("created_at", { ascending: false });
  if (error) return apiError("Não foi possível listar os validadores.", 500, "validators_failed");
  return apiSuccess(data || []);
});

export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/validators">, actor) => {
  const { projectId } = await context.params;
  await assertProjectAccess(actor, projectId, "write");
  if (actor.role !== "owner") return apiError("Somente owners podem criar validadores.", 403, "forbidden");
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);
  const database = createServiceClient();
  if (!database) return apiError("Configure o Supabase para criar validadores.", 409, "database_required");
  await requireEntitlement({database,workspaceId:actor.workspaceId,feature:"benefit_validators"});
  const token = createValidatorSecret();
  const { data, error } = await database.from("redemption_validators").insert({ workspace_id: actor.workspaceId, project_id: projectId, location_id: parsed.data.locationId || null, name: parsed.data.name, token_hash: token.tokenHash, created_by: actor.userId }).select("id,name,location_id,last_used_at,is_active").single();
  if (error || !data) return apiError("Não foi possível criar o validador.", 500, "validator_create_failed");
  return apiSuccess({ validator: data, activationToken: token.secret }, 201);
});
