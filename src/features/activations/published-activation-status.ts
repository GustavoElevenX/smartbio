import type { PublishedActivationSnapshot } from "./published-activation.schema";

export type PublishedActivationStatus = "active" | "scheduled" | "paused" | "ended";

/** A janela publicada é imutável; datas editadas no rascunho não afetam a experiência ativa. */
export function publishedActivationStatus(status: string, snapshot: Pick<PublishedActivationSnapshot, "startsAt" | "endsAt">, now: Date): PublishedActivationStatus {
  if (status === "paused") return "paused";
  if (status === "ended" || status === "archived") return "ended";
  if (status !== "active" && status !== "scheduled") return "ended";
  if (snapshot.endsAt && new Date(snapshot.endsAt) <= now) return "ended";
  if (snapshot.startsAt && new Date(snapshot.startsAt) > now) return "scheduled";
  return "active";
}
