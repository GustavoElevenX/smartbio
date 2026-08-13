import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivationOffer,
  ActivationPlacement,
  PublicActivation,
} from "@/features/activations/activation.types";
import { publishedActivationSnapshotSchema } from "@/features/activations/published-activation.schema";
import { canUseLocalStore } from "@/lib/runtime-mode";
import { ActivationRepository } from "./activation-repository";

type PublishedActivationRow = {
  status: string;
  starts_at?: string | null;
  ends_at?: string | null;
  published_snapshot: unknown;
};

function resolveRows(
  rows: PublishedActivationRow[],
  input: {
    entryPointId?: string;
    pageId?: string;
    now?: Date;
  },
) {
  const now = input.now || new Date();

  return rows.flatMap((row) => {
    if (
      row.status === "paused" ||
      row.status === "ended" ||
      row.status === "archived" ||
      (row.starts_at && new Date(row.starts_at) > now) ||
      (row.ends_at && new Date(row.ends_at) <= now)
    )
      return [];

    const parsed = publishedActivationSnapshotSchema.safeParse(
      row.published_snapshot,
    );
    if (!parsed.success) return [];
    const item = parsed.data;
    if (
      item.entryPointIds.length &&
      (!input.entryPointId || !item.entryPointIds.includes(input.entryPointId))
    )
      return [];

    return [
      {
        id: item.activationId,
        name: item.name,
        title: item.title,
        message: item.message,
        activationType: item.activationType,
        conversionGoalId: item.conversionGoalId,
        defaultDestinationId: item.defaultDestinationId,
        requiresIdentity: item.requiresIdentity,
        identityMode: item.identityMode,
        completionChannel: item.completionChannel,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        timezone: item.timezone,
        offer: item.offers.find((offer: ActivationOffer) => offer.isActive),
        placements: item.placements.filter(
          (placement: ActivationPlacement) =>
            placement.isActive &&
            (!placement.presencePageId ||
              placement.presencePageId === input.pageId),
        ),
      } satisfies PublicActivation,
    ];
  });
}

export async function resolvePublicActivations(
  database: SupabaseClient | null | undefined,
  input: {
    projectId: string;
    entryPointId?: string;
    pageId?: string;
    now?: Date;
  },
) {
  if (!database || canUseLocalStore()) {
    const activations = await new ActivationRepository(null).list(
      input.projectId,
    );
    return resolveRows(
      activations
        .filter((item) => item.publishedAt && item.publishedSnapshot)
        .map((item) => ({
          status: item.status,
          starts_at: item.startsAt,
          ends_at: item.endsAt,
          published_snapshot: item.publishedSnapshot,
        })),
      input,
    );
  }
  const { data, error } = await database
    .from("conversion_activations")
    .select("id,status,starts_at,ends_at,published_at,published_snapshot")
    .eq("project_id", input.projectId)
    .not("published_at", "is", null);
  if (error) throw error;
  return resolveRows(data || [], input);
}
