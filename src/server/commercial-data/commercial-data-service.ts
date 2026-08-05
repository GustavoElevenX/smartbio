import "server-only";
import { z } from "zod";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { saveCatalogConfig } from "@/server/commercial-data/catalog-config-repository";
import { savePolicies } from "@/server/commercial-data/policy-repository";
import { saveQuoteConfig } from "@/server/commercial-data/quote-config-repository";
import { commercialDatabase } from "@/server/commercial-data/repository-utils";
import { saveReservationConfig } from "@/server/commercial-data/reservation-config-repository";
import { saveRoutingConfig } from "@/server/commercial-data/routing-config-repository";
import { saveSchedulingConfig } from "@/server/commercial-data/scheduling-config-repository";
import { saveServiceOfferings } from "@/server/commercial-data/service-offerings-repository";
import type { Project } from "@/types";

const commercialDataInputSchema = z.object({
  commercialConfig: z.custom<NonNullable<Project["commercialConfig"]>>((value) => Boolean(value && typeof value === "object"), "Configuração comercial inválida."),
  capabilities: z.custom<NonNullable<Project["capabilities"]>>((value) => Array.isArray(value), "Capacidades inválidas."),
  dataRequirements: z.custom<NonNullable<Project["dataRequirements"]>>((value) => Array.isArray(value), "Requisitos inválidos."),
});

export type CommercialDataInput = z.infer<typeof commercialDataInputSchema>;

export async function saveCommercialData(actor: AuthenticatedActor, projectId: string, rawInput: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const input = commercialDataInputSchema.parse(rawInput);
  const config = input.commercialConfig;
  if (actor.persistence === "memory") return input;
  const database = commercialDatabase();
  const { data: row, error: loadError } = await database.from("projects").select("settings").eq("id", projectId).eq("workspace_id", actor.workspaceId).maybeSingle();
  if (loadError || !row) throw new Error("Projeto não encontrado neste workspace.");
  const settings = (row.settings || {}) as Record<string, unknown>;
  const beforeProject = settings.projectPayload && typeof settings.projectPayload === "object" ? settings.projectPayload as Project : undefined;
  await saveServiceOfferings(projectId, config.serviceOfferings || []);
  await saveQuoteConfig(projectId, config.quoteDefinition);
  await saveSchedulingConfig(projectId, { services: config.schedulableServices || [], resources: config.resources || [], rules: config.availabilityRules || [], exceptions: config.availabilityExceptions || [] });
  await saveCatalogConfig(projectId, config.catalogCategories || [], config.catalogItems || []);
  await saveReservationConfig(projectId, config.reservableUnits || [], config.reservationBlocks || []);
  await saveRoutingConfig(projectId, config.routingDestinations || [], config.routingRules || [], config.locations || []);
  await savePolicies(projectId, config.policies || []);
  const afterProject = beforeProject ? { ...beforeProject, commercialConfig: config, capabilities: input.capabilities, dataRequirements: input.dataRequirements, updatedAt: new Date().toISOString() } : undefined;
  const { error: updateError } = await database.from("projects").update({ settings: { ...settings, projectPayload: afterProject }, updated_at: new Date().toISOString() }).eq("id", projectId).eq("workspace_id", actor.workspaceId);
  if (updateError) throw new Error("Os dados normalizados foram salvos, mas não foi possível atualizar o snapshot do projeto.");
  const { error: auditError } = await database.from("commercial_audit_log").insert({ workspace_id: actor.workspaceId, project_id: projectId, actor_id: actor.userId, object_type: "commercial_data", object_id: projectId, action: "configuration_saved", before_state: beforeProject?.commercialConfig || {}, after_state: config });
  if (auditError) throw new Error("Os dados foram salvos, mas a auditoria falhou.");
  return input;
}
