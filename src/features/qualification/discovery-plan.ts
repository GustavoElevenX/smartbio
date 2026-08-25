import { z } from "zod";

import { contextSignature } from "@/features/qualification/offer-context";
import {
  buildDeterministicOfferIntelligence,
  offerIntelligenceDraftSchema,
  offerIntelligenceProfileSchema,
  profileFromDraft,
  type OfferIntelligenceDraft,
} from "@/features/qualification/offer-intelligence";
import { uid } from "@/lib/utils";

const structuredQuestionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  question: z.string().trim().min(1).max(240),
  type: z.enum(["text", "textarea", "select", "radio", "checkbox"]),
  options: z.array(z.string().trim().min(1).max(160)).max(10).optional(),
  purpose: z.enum(["need", "signal", "context", "constraint", "explicit_choice"]),
  required: z.boolean(),
});

export const discoveryPlanDraftSchema = z.object({
  offerIntelligenceProfiles: z.array(offerIntelligenceDraftSchema).max(100),
  questions: z.array(structuredQuestionSchema).min(2).max(4),
  fallbackStrategy: z.object({
    kind: z.enum(["real_offer", "team_handoff"]),
    offerName: z.string().trim().min(1).max(160).optional(),
    explanation: z.string().trim().min(1).max(300),
  }),
});

export const discoveryPlanSchema = z.object({
  id: z.string().min(1),
  version: z.literal(1),
  setupSessionId: z.string().min(1),
  projectId: z.string().optional(),
  contextSignature: z.string().min(1),
  declaredObjective: z.string().min(1),
  journeyMode: z.literal("assisted_discovery"),
  primaryAction: z.object({ key: z.string().min(1), label: z.string().min(1) }),
  completionAction: z.object({ label: z.string().min(1), destination: z.string().min(1) }),
  offerings: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), description: z.string().optional() })).min(2).max(100),
  offerIntelligenceProfiles: z.array(offerIntelligenceProfileSchema).min(2).max(100),
  questions: z.array(structuredQuestionSchema).min(2).max(4),
  fallbackStrategy: z.object({
    kind: z.enum(["real_offer", "team_handoff"]),
    offerId: z.string().optional(),
    explanation: z.string().min(1),
  }),
  provenance: z.object({
    source: z.enum(["contextual_ai", "business_confirmed", "deterministic_placeholder"]),
    providerOperation: z.literal("composeDiscoveryPlan"),
    createdAt: z.string(),
  }),
  status: z.enum(["ready", "degraded", "invalidated"]),
  issues: z.array(z.string()).max(100),
});

export type DiscoveryPlanDraft = z.infer<typeof discoveryPlanDraftSchema>;
export type DiscoveryPlan = z.infer<typeof discoveryPlanSchema>;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
export function discoveryContextSignature(input: {
  businessName: string;
  businessDescription: string;
  declaredObjective: string;
  destination: string;
  offeringNames: string[];
}) {
  return contextSignature([
    input.businessName,
    input.businessDescription,
    input.declaredObjective,
    input.destination,
    ...input.offeringNames.map(normalize).toSorted(),
  ].join("\n"));
}

export function discoveryPlanIssues(plan: DiscoveryPlan) {
  const issues = [...plan.issues];
  const offerIds = new Set(plan.offerings.map((item) => item.id));
  const offerNames = new Set(plan.offerings.map((item) => normalize(item.name)));
  const profileIds = new Set(plan.offerIntelligenceProfiles.map((item) => item.offerId));
  const profileNames = new Set(plan.offerIntelligenceProfiles.map((item) => normalize(item.offerName)));
  if (offerIds.size !== plan.offerings.length || offerNames.size !== plan.offerings.length) issues.push("As ofertas confirmadas contêm duplicatas.");
  if (profileIds.size !== plan.offerIntelligenceProfiles.length || profileNames.size !== plan.offerIntelligenceProfiles.length) issues.push("Os perfis de oferta contêm duplicatas.");
  if (offerIds.size !== profileIds.size || [...offerIds].some((id) => !profileIds.has(id))) issues.push("Cada oferta precisa ter exatamente um perfil com o mesmo ID.");
  if ([...offerNames].some((name) => !profileNames.has(name))) issues.push("Cada oferta precisa ter exatamente um perfil com o mesmo nome.");
  if (plan.offerIntelligenceProfiles.some((profile) => (
    profile.provenance.discoveryPlanId !== plan.id
    || profile.provenance.discoveryPlanVersion !== plan.version
    || profile.provenance.contextSignature !== plan.contextSignature
  ))) issues.push("A proveniência dos perfis não corresponde ao plano persistido.");
  if (plan.offerIntelligenceProfiles.some((profile) => !["contextual_ai", "business_confirmed"].includes(profile.provenance.source))) {
    issues.push("O plano contém perfil determinístico de placeholder.");
  }
  return [...new Set(issues)];
}

export function discoveryPlanIsReady(plan: DiscoveryPlan) {
  return plan.status === "ready" && plan.provenance.source !== "deterministic_placeholder" && discoveryPlanIssues(plan).length === 0;
}

export function createDiscoveryPlan(input: {
  setupSessionId: string;
  businessName: string;
  businessDescription: string;
  declaredObjective: string;
  primaryAction: { key: string; label: string };
  completionAction: { label: string; destination: string };
  offeringNames: string[];
  draft?: DiscoveryPlanDraft;
  providerFailed?: boolean;
}): DiscoveryPlan {
  const id = uid("discovery-plan");
  const version = 1 as const;
  const signature = discoveryContextSignature({
    businessName: input.businessName,
    businessDescription: input.businessDescription,
    declaredObjective: input.declaredObjective,
    destination: input.completionAction.destination,
    offeringNames: input.offeringNames,
  });
  const offerings = input.offeringNames.map((name) => ({ id: uid("offering"), name }));
  const draftsByName = new Map<string, OfferIntelligenceDraft[]>();
  for (const draft of input.draft?.offerIntelligenceProfiles || []) {
    const key = normalize(draft.offerName);
    draftsByName.set(key, [...(draftsByName.get(key) || []), draft]);
  }
  const issues: string[] = [];
  const knownNames = new Set(offerings.map((item) => normalize(item.name)));
  for (const [name, drafts] of draftsByName) {
    if (!knownNames.has(name)) issues.push(`O provider devolveu um perfil para oferta não confirmada: ${drafts[0]?.offerName}.`);
    if (drafts.length !== 1) issues.push(`O provider devolveu ${drafts.length} perfis para a mesma oferta: ${drafts[0]?.offerName}.`);
  }
  const profiles = offerings.map((offering) => {
    const draft = draftsByName.get(normalize(offering.name))?.[0];
    if (draft) return profileFromDraft(draft, {
      offerId: offering.id,
      projectId: `setup:${input.setupSessionId}`,
      businessContext: input.businessDescription,
      contextSignature: signature,
      discoveryPlanId: id,
      discoveryPlanVersion: version,
      source: "contextual_ai",
    });
    issues.push(`Falta perfil contextual para a oferta confirmada: ${offering.name}.`);
    const placeholder = buildDeterministicOfferIntelligence({
      projectId: `setup:${input.setupSessionId}`,
      offerId: offering.id,
      offerName: offering.name,
      businessContext: input.businessDescription,
      competingOfferNames: input.offeringNames,
    });
    return offerIntelligenceProfileSchema.parse({
      ...placeholder,
      provenance: {
        ...placeholder.provenance,
        contextSignature: signature,
        discoveryPlanId: id,
        discoveryPlanVersion: version,
        source: "deterministic_placeholder",
      },
    });
  });
  const fallbackOffer = input.draft?.fallbackStrategy.offerName
    ? offerings.find((item) => normalize(item.name) === normalize(input.draft!.fallbackStrategy.offerName!))
    : undefined;
  if (input.draft?.fallbackStrategy.kind === "real_offer" && !fallbackOffer) issues.push("O fallback indicado não corresponde a uma oferta real confirmada.");
  if (input.providerFailed) issues.push("O provider contextual falhou; o plano usa apenas placeholders e não pode ser publicado.");
  const questions = input.draft?.questions || [
    { id: "discovery-placeholder-need", question: "Conte com suas palavras o que você precisa resolver.", type: "textarea" as const, purpose: "need" as const, required: true },
    { id: "discovery-placeholder-context", question: "Que contexto a equipe deve considerar antes de orientar você?", type: "textarea" as const, purpose: "context" as const, required: true },
  ];
  const status = issues.length ? "degraded" as const : "ready" as const;
  return discoveryPlanSchema.parse({
    id,
    version,
    setupSessionId: input.setupSessionId,
    contextSignature: signature,
    declaredObjective: input.declaredObjective,
    journeyMode: "assisted_discovery",
    primaryAction: input.primaryAction,
    completionAction: input.completionAction,
    offerings,
    offerIntelligenceProfiles: profiles,
    questions,
    fallbackStrategy: {
      kind: input.draft?.fallbackStrategy.kind || "team_handoff",
      offerId: fallbackOffer?.id,
      explanation: input.draft?.fallbackStrategy.explanation || "Sem evidência suficiente, encaminhar o contexto para confirmação da equipe.",
    },
    provenance: {
      source: status === "ready" ? "contextual_ai" : "deterministic_placeholder",
      providerOperation: "composeDiscoveryPlan",
      createdAt: new Date().toISOString(),
    },
    status,
    issues,
  });
}

export function bindDiscoveryPlanToProject(plan: DiscoveryPlan, projectId: string): DiscoveryPlan {
  return discoveryPlanSchema.parse({
    ...plan,
    projectId,
    offerIntelligenceProfiles: plan.offerIntelligenceProfiles.map((profile) => ({
      ...profile,
      provenance: { ...profile.provenance, projectId },
    })),
  });
}
