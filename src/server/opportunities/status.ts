import type { CommercialOpportunity, OpportunityStatus } from "@/types";

const transitions: Record<OpportunityStatus, OpportunityStatus[]> = {
  new: ["in_progress", "converted", "lost", "archived"], in_progress: ["converted", "lost", "archived"],
  converted: ["archived"], lost: ["in_progress", "archived"], archived: [],
};

export function canTransitionOpportunity(from: OpportunityStatus, to: OpportunityStatus) { return from === to || transitions[from].includes(to); }
export function transitionOpportunity(opportunity: CommercialOpportunity, status: OpportunityStatus, input: { confirmedValue?: number; lossReason?: string; now?: string } = {}): CommercialOpportunity {
  if (!canTransitionOpportunity(opportunity.status, status)) throw new Error(`Transição inválida: ${opportunity.status} → ${status}.`);
  if (status === "lost" && !input.lossReason?.trim()) throw new Error("Informe por que a oportunidade foi perdida.");
  const now = input.now || new Date().toISOString();
  return { ...opportunity, status, confirmedValue: status === "converted" ? input.confirmedValue : opportunity.confirmedValue, lossReason: status === "lost" ? input.lossReason : opportunity.lossReason, firstHandledAt: status !== "new" ? opportunity.firstHandledAt || now : opportunity.firstHandledAt, convertedAt: status === "converted" ? now : opportunity.convertedAt, lostAt: status === "lost" ? now : opportunity.lostAt, updatedAt: now };
}
