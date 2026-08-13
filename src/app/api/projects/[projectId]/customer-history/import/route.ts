import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { assertProjectAccess } from "@/server/auth/project-access";
import { sourceRepository } from "@/server/business-sources/source-repository";
import { importHistoricalCustomers } from "@/server/customer-identity/customer-import";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { requireEntitlement } from "@/server/entitlements/require-entitlement";

const schema = z.object({
  sourceId: z.string().uuid(),
  phoneColumn: z.string().trim().optional(),
  emailColumn: z.string().trim().optional(),
  externalIdColumn: z.string().trim().optional(),
}).refine((value) => value.phoneColumn || value.emailColumn, { message: "Mapeie telefone ou e-mail." });

export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/customer-history/import">, actor) => {
  const { projectId } = await context.params;
  await assertProjectAccess(actor, projectId, "write");
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);
  if (actor.persistence !== "database") return apiError("Configure o Supabase para importar histórico de clientes.", 409, "database_required");
  const source = await sourceRepository.get(actor, parsed.data.sourceId);
  if (!source || source.projectId !== projectId || source.type !== "csv") return apiError("Selecione um CSV deste projeto.", 404, "source_not_found");
  const preview = source.extractedData?.csvPreview as { headers?: string[]; rows?: string[][] } | undefined;
  const headers = preview?.headers || [];
  const rows = preview?.rows || [];
  const index = (name?: string) => name ? headers.indexOf(name) : -1;
  const phoneIndex = index(parsed.data.phoneColumn);
  const emailIndex = index(parsed.data.emailColumn);
  const externalIndex = index(parsed.data.externalIdColumn);
  if (phoneIndex < 0 && emailIndex < 0) return apiError("As colunas mapeadas não existem no arquivo.", 422, "invalid_mapping");
  const database = createServiceClient()!;
  await requireEntitlement({database,workspaceId:actor.workspaceId,feature:"customer_history_import"});
  const { data: batch, error } = await database.from("customer_import_batches").insert({ workspace_id: actor.workspaceId, project_id: projectId, business_source_id: source.id, phone_column: parsed.data.phoneColumn || null, email_column: parsed.data.emailColumn || null, external_id_column: parsed.data.externalIdColumn || null, status: "processing", created_by: actor.userId }).select("id").single();
  if (error || !batch) return apiError("Não foi possível iniciar a importação.", 500, "import_failed");
  try {
    const result = await importHistoricalCustomers(database, { workspaceId: actor.workspaceId, projectId, sourceId: source.id, rows: rows.map((row) => ({ phone: phoneIndex >= 0 ? row[phoneIndex] : undefined, email: emailIndex >= 0 ? row[emailIndex] : undefined, externalId: externalIndex >= 0 ? row[externalIndex] : undefined })) });
    await Promise.all([
      database.from("customer_import_batches").update({ status: "completed", imported_count: result.imported, skipped_count: result.skipped, completed_at: new Date().toISOString() }).eq("id", batch.id),
      database.from("business_sources").update({ source_purpose: "customer_history" }).eq("id", source.id).eq("workspace_id", actor.workspaceId),
    ]);
    return apiSuccess({ batchId: batch.id, ...result }, 201);
  } catch {
    await database.from("customer_import_batches").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", batch.id);
    return apiError("A importação falhou sem alterar a configuração da ativação.", 500, "import_failed");
  }
});
