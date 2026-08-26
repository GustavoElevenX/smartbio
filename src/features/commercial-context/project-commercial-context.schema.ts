import { z } from "zod";

export const commercialContextStatusSchema = z.enum(["confirmed", "inferred", "deprecated"]);

export const commercialContextEvidenceSchema = z.object({
  id: z.string().trim().min(1).max(200),
  sourceId: z.string().trim().min(1).max(200),
  origin: z.enum(["user", "operational", "website", "document", "link_bio", "instagram", "logo_analysis", "ai_inference", "system_fallback"]),
  excerpt: z.string().trim().max(500).nullable(),
  confidence: z.number().min(0).max(1),
  observedAt: z.iso.datetime(),
});

const semanticBaseSchema = z.object({
  status: commercialContextStatusSchema,
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string().trim().min(1).max(200)).max(30),
});

export const sourceCoverageSchema = z.object({
  website: z.boolean(),
  instagram: z.boolean(),
  linkInBio: z.boolean(),
  menuOrCatalog: z.boolean(),
  documents: z.boolean(),
  logo: z.boolean(),
});

export const projectCommercialContextSchema = z.object({
  projectId: z.string().min(1),
  schemaVersion: z.number().int().min(1),
  revision: z.number().int().min(1),
  summary: z.object({
    businessDescription: z.string().max(4000),
    whatItSells: z.string().max(2000),
    commercialModel: z.string().max(1000).nullable(),
    valueProposition: z.string().max(1000).nullable(),
  }),
  evidence: z.array(commercialContextEvidenceSchema).max(500),
  audienceContexts: z.array(semanticBaseSchema.extend({
    id: z.string().min(1).max(200),
    label: z.string().min(1).max(240),
    description: z.string().max(1000).nullable(),
    kind: z.enum(["consumer", "business", "reseller", "partner", "guest", "lead", "other"]).nullable(),
  })).max(100),
  offeringContexts: z.array(semanticBaseSchema.extend({
    id: z.string().min(1).max(200),
    offeringId: z.string().nullable(),
    externalKey: z.string().nullable(),
    label: z.string().min(1).max(240),
    commercialRoles: z.array(z.string().max(120)).max(20),
    audienceContextIds: z.array(z.string()).max(100),
  })).max(400),
  intentContexts: z.array(semanticBaseSchema.extend({
    id: z.string().min(1).max(200),
    semanticKey: z.string().max(120).nullable(),
    label: z.string().min(1).max(240),
    visitorNeed: z.string().min(1).max(1000),
    audienceContextIds: z.array(z.string()).max(100),
    offeringIds: z.array(z.string()).max(400),
    priority: z.number().int().min(0).max(100),
    entryVisibility: z.enum(["primary", "secondary", "contextual"]),
  })).max(100),
  channelContexts: z.array(semanticBaseSchema.extend({
    id: z.string().min(1).max(200),
    destinationId: z.string().nullable(),
    externalUrl: z.string().max(1000).nullable(),
    role: z.string().min(1).max(240),
    servesIntentIds: z.array(z.string()).max(100),
    servesAudienceContextIds: z.array(z.string()).max(100),
    locationIds: z.array(z.string()).max(100),
  })).max(200),
  locationContexts: z.array(semanticBaseSchema.extend({
    id: z.string().min(1).max(200),
    locationId: z.string(),
    commercialRoles: z.array(z.string().max(120)).max(30),
    destinationIds: z.array(z.string()).max(30),
    servesIntentIds: z.array(z.string()).max(100),
  })).max(200),
  purchaseMechanisms: z.array(semanticBaseSchema.extend({
    id: z.string().min(1).max(200),
    label: z.string().min(1).max(240),
    intentIds: z.array(z.string()).min(1).max(30),
    journeyBlueprintId: z.string().nullable(),
    mechanism: z.enum(["direct_url", "direct_whatsapp", "guided_whatsapp", "qualification_then_contact", "quote_then_contact", "routing_then_contact", "schedule", "reservation", "native_catalog", "external_catalog", "other"]),
    requiredInformation: z.array(z.string().max(240)).max(50),
    completionStrategy: z.string().min(1).max(500),
    destinationIds: z.array(z.string()).max(30),
  })).max(100),
  currentArchitecture: z.object({
    architectureRevision: z.number().int().min(1),
    materializedProjectVersion: z.number().int().min(1),
    intentIds: z.array(z.string()).max(100),
    journeyBlueprintIds: z.array(z.string()).max(100),
    generatedAt: z.iso.datetime(),
    confirmedAt: z.iso.datetime().nullable(),
  }).nullable(),
  assumptions: z.array(z.object({
    id: z.string().min(1).max(200),
    statement: z.string().min(1).max(1000),
    importance: z.enum(["blocking", "important", "optional"]),
    status: z.enum(["unverified", "confirmed", "rejected", "superseded"]),
    confidence: z.number().min(0).max(1),
    evidenceRefs: z.array(z.string()).max(30),
  })).max(200),
  sourceCoverage: sourceCoverageSchema,
  lastAnalyzedAt: z.iso.datetime(),
  lastConfirmedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
});

export const commercialContextProposalSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  baseRevision: z.number().int().min(1),
  status: z.enum(["pending", "accepted", "rejected"]),
  reason: z.string().min(1).max(500),
  evidence: z.array(commercialContextEvidenceSchema).max(100),
  proposedContext: projectCommercialContextSchema,
  affectedIntentIds: z.array(z.string()).max(100),
  createdAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});

export type ProjectCommercialContext = z.infer<typeof projectCommercialContextSchema>;
export type CommercialContextProposal = z.infer<typeof commercialContextProposalSchema>;
export type CommercialContextEvidence = z.infer<typeof commercialContextEvidenceSchema>;
export type CommercialContextStatus = z.infer<typeof commercialContextStatusSchema>;
