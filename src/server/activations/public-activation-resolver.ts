import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicActivation } from "@/features/activations/activation.types";
import type { PublishedActivationSnapshot } from "@/features/activations/published-activation.schema";
import { listPublishedCampaigns } from "./published-campaign-resolver";

export function publicActivationFromSnapshot(snapshot: PublishedActivationSnapshot, pageId?: string): PublicActivation {
  return {
    id: snapshot.activationId, activationKey: snapshot.activationKey, publishedVersion: snapshot.activationVersion,
    name: snapshot.name, title: snapshot.title, message: snapshot.message, activationType: snapshot.activationType,
    conversionGoalId: snapshot.conversionGoalId, defaultDestinationId: snapshot.defaultDestinationId,
    requiresIdentity: snapshot.requiresIdentity, identityMode: snapshot.identityMode,
    completionChannel: snapshot.completionChannel, startsAt: snapshot.startsAt, endsAt: snapshot.endsAt,
    timezone: snapshot.timezone, offer: snapshot.offers.find((item) => item.isActive),
    placements: snapshot.placements.filter((item) => item.isActive && (!item.presencePageId || item.presencePageId === pageId)),
  };
}

export async function resolvePublicActivations(database: SupabaseClient | null | undefined, input: {
  projectId: string; entryPointId?: string; pageId?: string; now?: Date;
}) {
  const campaigns = await listPublishedCampaigns(database, input.projectId, input.now);
  return campaigns.filter((item) => item.status === "active" &&
    (!item.snapshot.entryPointIds.length || Boolean(input.entryPointId && item.snapshot.entryPointIds.includes(input.entryPointId))))
    .toSorted((a, b) => b.snapshot.priority - a.snapshot.priority || b.publishedAt.localeCompare(a.publishedAt) || a.snapshot.activationId.localeCompare(b.snapshot.activationId))
    .map((item) => publicActivationFromSnapshot(item.snapshot, input.pageId));
}
