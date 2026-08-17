import "server-only";

import { z } from "zod";
import { getAIProvider } from "@/server/ai/ai-client";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import { createServiceClient } from "@/lib/supabase/server";
import type { Project } from "@/types";
import { requireEntitlement } from "@/server/entitlements/require-entitlement";

const inputSchema = z.object({ requestedSurface: z.enum(["business_site", "landing_page"]), objective: z.string().max(1000).optional(), campaignContext: z.record(z.string(), z.unknown()).optional(), projectSnapshot: z.custom<Project>().optional() });
function containsMarkup(value: unknown): boolean { if (typeof value === "string") return /<\/?[a-z][^>]*>|<script|javascript:/i.test(value); if (Array.isArray(value)) return value.some(containsMarkup); return Boolean(value && typeof value === "object" && Object.values(value).some(containsMarkup)); }

export async function composePresence(actor: AuthenticatedActor, projectId: string, raw: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  if (process.env.NEXT_PUBLIC_FEATURE_PRESENCE_AI !== "true") throw new Error("O compositor de presença por IA está desativado.");
  const input = inputSchema.parse(raw);
  const project = actor.persistence === "memory" ? input.projectSnapshot : await loadProjectForActor(actor, projectId);
  if (!project) throw new Error("Projeto não encontrado.");
  let verifiedFacts: Array<{ key: string; value: unknown; sourceId?: string; verificationStatus: string }> = [];
  if (actor.persistence === "database") {
    const database = createServiceClient();
    if (database) await requireEntitlement({ database, workspaceId: actor.workspaceId, feature: "ai_page_edits" });
    const { data } = database ? await database.from("business_source_facts").select("fact_key,fact_value,source_id,verification_status,business_sources!inner(project_id)").eq("business_sources.project_id", projectId).eq("verification_status", "verified") : { data: [] };
    verifiedFacts = (data || []).map((fact) => ({ key: String(fact.fact_key), value: fact.fact_value, sourceId: fact.source_id ? String(fact.source_id) : undefined, verificationStatus: String(fact.verification_status) }));
  }
  const draft = await getAIProvider().composePresence({ workspaceId: actor.workspaceId, projectId, userId: actor.userId, businessProfile: project.businessProfile || { offerKinds: ["service"], primaryIntents: ["contact"], secondaryIntents: [], confirmationMode: "manual_approval", capacityKinds: ["none"], hasMultipleLocations: false, requiresQualification: false, requiresMediaUpload: false, requiresPayment: false, allowsCancellationRequest: false, allowsRescheduleRequest: false, completionChannel: "whatsapp", requiredVisitorData: [], businessRules: [] }, conversionGoals: project.conversionGoals || [], brand: project.brand, commercialData: { serviceOfferings: project.commercialConfig?.serviceOfferings, catalogItems: project.commercialConfig?.catalogItems, locations: project.commercialConfig?.locations, reservableUnits: project.commercialConfig?.reservableUnits, policies: project.commercialConfig?.policies }, verifiedFacts, mediaAssets: project.mediaAssets || [], requestedSurface: input.requestedSurface, objective: input.objective, campaignContext: input.campaignContext as never });
  if (containsMarkup(draft)) throw new Error("A IA retornou conteúdo não permitido. O rascunho foi descartado.");
  return { draft, applied: false, published: false };
}
