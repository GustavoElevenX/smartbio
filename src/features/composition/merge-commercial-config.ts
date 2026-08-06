import { uid, slugify } from "@/lib/utils";
import type { CommercialConfigPatch } from "@/features/composition/commercial-config-patch.schema";
import type { DataRequirement, Project } from "@/types";
import { protectedCommercialFieldSet } from "@/features/ai-editing/protected-commercial-fields";

type CommercialConfig = NonNullable<Project["commercialConfig"]>;

export interface CommercialConfigConflict {
  path: string;
  reason: string;
  existing?: unknown;
  proposed?: unknown;
}

export interface CommercialConfigMergeResult {
  value: CommercialConfig;
  conflicts: CommercialConfigConflict[];
  requirements: DataRequirement[];
}

function stableKey(value: Record<string, unknown>) {
  return String(value.id || value.slug || value.key || value.name || value.title || "").toLowerCase();
}

function requirement(projectId: string, path: string, reason: string): DataRequirement {
  return { id: `${projectId}:${path}`, key: path, label: path.split(".").at(-1) || path, capability: "project", status: "needs_confirmation", severity: "blocking", origin: "ai_inference", reason, actionLabel: "Confirmar", actionPath: `/app/projects/${projectId}/data` };
}

function mergeItem(existing: Record<string, unknown> | undefined, proposed: Record<string, unknown>, path: string, projectId: string, conflicts: CommercialConfigConflict[], requirements: DataRequirement[]) {
  const next: Record<string, unknown> = { ...(existing || {}), ...proposed, id: existing?.id || proposed.id || uid("item") };
  if ("projectId" in next || path !== "routingDestinations") next.projectId = projectId;
  for (const key of protectedCommercialFieldSet) {
    if (!(key in proposed)) continue;
    const fieldPath = `${path}.${key}`;
    if (existing?.[key] != null) {
      next[key] = existing[key];
      conflicts.push({ path: fieldPath, reason: "O valor existente foi preservado e a sugestão da IA exige confirmação.", existing: existing[key], proposed: proposed[key] });
    } else {
      delete next[key];
    }
    requirements.push(requirement(projectId, fieldPath, "Valor sugerido pela IA; confirme antes de persistir."));
  }
  return next;
}

function mergeCollection(existing: unknown[] | undefined, proposed: unknown[] | undefined, path: string, projectId: string, conflicts: CommercialConfigConflict[], requirements: DataRequirement[]) {
  if (!proposed) return existing;
  const byKey = new Map((existing || []).map((item) => [stableKey(item as Record<string, unknown>), item as Record<string, unknown>]));
  const result = [...(existing || [])] as Record<string, unknown>[];
  for (const raw of proposed) {
    const item = raw as Record<string, unknown>;
    const key = stableKey(item);
    const current = key ? byKey.get(key) : undefined;
    const next = mergeItem(current, item, `${path}.${key || result.length}`, projectId, conflicts, requirements);
    if (current) result[result.indexOf(current)] = next;
    else result.push(next);
  }
  return result;
}

function withDefaults(config: CommercialConfig, projectId: string): CommercialConfig {
  return {
    ...config,
    serviceOfferings: config.serviceOfferings?.map((item) => ({ ...item, projectId, currency: item.currency ?? "BRL", serviceMode: item.serviceMode ?? "contact", priceMode: item.priceMode ?? "on_request", isFeatured: item.isFeatured ?? false, isActive: item.isActive ?? true, order: item.order ?? 0, settings: item.settings ?? { generatedByAI: true, verificationStatus: "needs_confirmation" }, name: item.name || "Serviço sugerido", slug: item.slug || slugify(item.name || "servico-sugerido") })) as CommercialConfig["serviceOfferings"],
    catalogCategories: config.catalogCategories?.map((item) => ({ ...item, projectId, name: item.name || "Categoria", order: item.order ?? 0, isActive: item.isActive ?? true })) as CommercialConfig["catalogCategories"],
    catalogItems: config.catalogItems?.map((item) => ({ ...item, projectId, name: item.name || "Item sugerido", currency: item.currency ?? "BRL", isAvailable: item.isAvailable ?? false, variants: item.variants ?? [], metadata: item.metadata ?? { generatedByAI: true, verificationStatus: "needs_confirmation" } })) as CommercialConfig["catalogItems"],
    schedulableServices: config.schedulableServices?.map((item) => ({ ...item, projectId, name: item.name || "Serviço sugerido", durationMinutes: item.durationMinutes ?? 60, bufferBeforeMinutes: item.bufferBeforeMinutes ?? 0, bufferAfterMinutes: item.bufferAfterMinutes ?? 0, capacity: item.capacity ?? 1, confirmationMode: item.confirmationMode ?? "manual_approval", isActive: item.isActive ?? false })) as CommercialConfig["schedulableServices"],
    reservableUnits: config.reservableUnits?.map((item) => ({ ...item, projectId, name: item.name || "Opção sugerida", capacityAdults: item.capacityAdults ?? 1, capacityChildren: item.capacityChildren ?? 0, quantity: item.quantity ?? 1, currency: item.currency ?? "BRL", isActive: item.isActive ?? false, mediaAssetIds: item.mediaAssetIds ?? [], amenities: item.amenities ?? [] })) as CommercialConfig["reservableUnits"],
    locations: config.locations?.map((item) => ({ ...item, projectId, name: item.name || "Unidade sugerida", countryCode: item.countryCode ?? "BR", geocodingStatus: item.geocodingStatus ?? "pending", timezone: item.timezone ?? "America/Sao_Paulo", openingHours: item.openingHours ?? [], supportsDelivery: item.supportsDelivery ?? false, supportsPickup: item.supportsPickup ?? false, supportsInPerson: item.supportsInPerson ?? true, priority: item.priority ?? 0, isActive: item.isActive ?? false, settings: item.settings ?? { generatedByAI: true, verificationStatus: "needs_confirmation" } })) as CommercialConfig["locations"],
    policies: config.policies?.map((item) => ({ ...item, projectId, type: item.type ?? "custom", title: item.title || "Política pendente", content: item.content || "Confirme esta política antes de publicar.", isActive: item.isActive ?? false, settings: item.settings ?? { generatedByAI: true, verificationStatus: "needs_confirmation" } })) as CommercialConfig["policies"],
  };
}

export function mergeCommercialConfig(existing: CommercialConfig, patch: CommercialConfigPatch, projectId: string): CommercialConfigMergeResult {
  const conflicts: CommercialConfigConflict[] = [];
  const requirements: DataRequirement[] = [];
  const value: CommercialConfig = { ...existing };
  const collections = ["serviceOfferings", "schedulableServices", "catalogCategories", "catalogItems", "reservableUnits", "routingDestinations", "routingRules", "locations", "policies"] as const;
  for (const key of collections) (value as Record<string, unknown>)[key] = mergeCollection(existing[key] as unknown[] | undefined, patch[key] as unknown[] | undefined, key, projectId, conflicts, requirements);
  if (patch.quoteDefinition) value.quoteDefinition = mergeItem(existing.quoteDefinition as unknown as Record<string, unknown> | undefined, patch.quoteDefinition as Record<string, unknown>, "quoteDefinition", projectId, conflicts, requirements) as unknown as CommercialConfig["quoteDefinition"];
  if (patch.paymentUrl) {
    if (existing.paymentUrl) conflicts.push({ path: "paymentUrl", reason: "Checkout existente preservado.", existing: existing.paymentUrl, proposed: patch.paymentUrl });
    requirements.push(requirement(projectId, "payment.url", "Confirme a URL de pagamento sugerida pela IA."));
  }
  return { value: withDefaults(value, projectId), conflicts, requirements };
}
