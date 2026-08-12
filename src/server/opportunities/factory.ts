import type { AttributionContext, CommercialOpportunity, OpportunitySourceType } from "@/types";

export interface OpportunityFactoryInput {
  workspaceId: string; projectId: string; projectName?: string; sessionId?: string; sourceType: OpportunitySourceType; sourceId: string;
  title: string; conversionGoalId?: string; entryPointId?: string; destinationId?: string; presencePageId?: string; presenceSectionId?: string; attribution?: AttributionContext;
  visitorData?: Record<string, unknown>; summary?: string; estimatedValue?: number; currency?: string; metadata?: Record<string, unknown>; now?: string;
}
const safeString = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
export function opportunityIdempotencyKey(input: Pick<OpportunityFactoryInput, "projectId" | "sourceType" | "sourceId">) { return `${input.projectId}:${input.sourceType}:${input.sourceId}`; }
export function createOpportunity(input: OpportunityFactoryInput): CommercialOpportunity {
  const now = input.now || new Date().toISOString(); const visitor = input.visitorData || {};
  return { id: opportunityIdempotencyKey(input), workspaceId: input.workspaceId, projectId: input.projectId, projectName: input.projectName, sessionId: input.sessionId,
    sourceType: input.sourceType, sourceId: input.sourceId, status: "new", title: input.title,
    contactName: safeString(visitor.name), contactEmail: safeString(visitor.email), contactPhone: safeString(visitor.phone) || safeString(visitor.whatsapp),
    summary: input.summary, estimatedValue: input.estimatedValue, currency: input.currency || "BRL", conversionGoalId: input.conversionGoalId,
    entryPointId: input.entryPointId, destinationId: input.destinationId, presencePageId: input.presencePageId || input.attribution?.presencePageId, presenceSectionId: input.presenceSectionId || input.attribution?.presenceSectionId, attribution: input.attribution, metadata: input.metadata || {}, createdAt: now, updatedAt: now };
}
