import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canUseLocalStore } from "@/lib/runtime-mode";
import { publishedActivationSnapshotSchema, type PublishedActivationSnapshot } from "@/features/activations/published-activation.schema";
import { publishedActivationStatus, type PublishedActivationStatus } from "@/features/activations/published-activation-status";
import { selectDynamicHomeCandidate, type DynamicHomeCandidate } from "@/features/activations/dynamic-home-contract";
import { ActivationRepository } from "./activation-repository";

export interface PublishedCampaign {
  snapshot: PublishedActivationSnapshot;
  publishedAt: string;
  status: PublishedActivationStatus;
}

interface CampaignRow { status: string; published_at?: string | null; published_snapshot: unknown }

export function resolvePublishedCampaignRows(rows: CampaignRow[], now = new Date()): PublishedCampaign[] {
  return rows.flatMap((row) => {
    if (!row.published_at) return [];
    const parsed = publishedActivationSnapshotSchema.safeParse(row.published_snapshot);
    if (!parsed.success) return [];
    return [{ snapshot: parsed.data as PublishedActivationSnapshot, publishedAt: row.published_at,
      status: publishedActivationStatus(row.status, parsed.data, now) }];
  });
}

export async function listPublishedCampaigns(database: SupabaseClient | null | undefined, projectId: string, now = new Date()): Promise<PublishedCampaign[]> {
  if (!database || canUseLocalStore()) {
    const activations = await new ActivationRepository(null).list(projectId);
    return resolvePublishedCampaignRows(activations.map((item) => ({ status: item.status, published_at: item.publishedAt, published_snapshot: item.publishedSnapshot })), now);
  }
  const { data, error } = await database.from("conversion_activations")
    .select("status,published_at,published_snapshot").eq("project_id", projectId).not("published_at", "is", null);
  if (error) throw error;
  return resolvePublishedCampaignRows(data || [], now);
}

export function resolveCampaignHome(campaigns: PublishedCampaign[], now = new Date()): PublishedCampaign | null {
  const candidates: DynamicHomeCandidate[] = campaigns.flatMap((campaign) => {
    const { snapshot } = campaign;
    if (snapshot.snapshotVersion !== 2 || !snapshot.dynamicSurface) return [];
    return [{ status: campaign.status, snapshot: {
      activationId: snapshot.activationId, activationKey: snapshot.activationKey, priority: snapshot.priority,
      startsAt: snapshot.startsAt, endsAt: snapshot.endsAt, publishedAt: campaign.publishedAt,
      dynamicSurface: snapshot.dynamicSurface,
    } }];
  });
  const selected = selectDynamicHomeCandidate(candidates, now);
  return selected ? campaigns.find((item) => item.snapshot.activationId === selected.snapshot.activationId) || null : null;
}

export function resolveExclusiveCampaign(campaigns: PublishedCampaign[], activationKey: string): PublishedCampaign | null {
  return campaigns.find((item) => item.status === "active" && item.snapshot.activationKey === activationKey &&
    item.snapshot.snapshotVersion === 2 && item.snapshot.dynamicSurface?.experienceKey === activationKey) || null;
}
