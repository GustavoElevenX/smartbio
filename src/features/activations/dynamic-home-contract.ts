import { z } from "zod";
import type { PublishedActivationSnapshot } from "./published-activation.schema";

/** Fase 4B: configuração versionada da superfície temporária, sem alterar Project.publication. */
export interface ActivationDynamicSurface {
  mode: "exclusive" | "exclusive_and_home";
  experienceKey: string;
  title: string;
  message?: string;
  conversionGoalId: string;
  sections: Array<{ key: string; kind: "hero" | "offer" | "conditions" | "action"; content: Record<string, unknown> }>;
}

export const activationDynamicSurfaceSchema = z.object({
  mode: z.enum(["exclusive", "exclusive_and_home"]),
  experienceKey: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(120),
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().max(1000).optional(),
  conversionGoalId: z.string().min(1).max(150),
  sections: z.array(z.object({ key: z.string().max(80), kind: z.enum(["hero", "offer", "conditions", "action"]), content: z.record(z.string(), z.unknown()) })).max(8),
});

export interface DynamicHomeCandidate {
  snapshot: Pick<PublishedActivationSnapshot, "activationId" | "activationKey" | "priority" | "startsAt" | "endsAt"> & {
    publishedAt: string;
    dynamicSurface: ActivationDynamicSurface;
  };
  status: "active" | "scheduled" | "paused" | "ended";
}

/** Ordenação estável para a resolução da home pública. */
export function selectDynamicHomeCandidate(candidates: DynamicHomeCandidate[], now: Date): DynamicHomeCandidate | null {
  return candidates.filter(({ snapshot, status }) =>
    status === "active" && snapshot.dynamicSurface.mode === "exclusive_and_home" &&
    (!snapshot.startsAt || new Date(snapshot.startsAt) <= now) &&
    (!snapshot.endsAt || new Date(snapshot.endsAt) > now),
  ).toSorted((left, right) =>
    right.snapshot.priority - left.snapshot.priority ||
    Date.parse(right.snapshot.publishedAt) - Date.parse(left.snapshot.publishedAt) ||
    left.snapshot.activationId.localeCompare(right.snapshot.activationId),
  )[0] || null;
}
