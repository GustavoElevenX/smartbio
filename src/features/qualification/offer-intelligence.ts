import { z } from "zod";

import { contextSignature } from "@/features/qualification/offer-context";
import type { FormField, ServiceOffering, StructuredJourneyQuestion } from "@/types";

const text = (max: number) => z.string().trim().min(1).max(max);
const textList = (maxItems: number, maxLength = 220) => z.array(text(maxLength)).max(maxItems);

export const offerStrongSignalGroupSchema = z.object({
  clues: textList(8, 160).min(2),
  minimumMatches: z.number().int().min(2).max(8),
  rationale: text(300),
}).refine((group) => group.minimumMatches <= group.clues.length, {
  message: "minimumMatches não pode exceder a quantidade de indícios",
  path: ["minimumMatches"],
});

export const offerDiscriminatingQuestionSchema = z.object({
  question: text(180),
  purpose: z.enum(["need", "signal", "context", "constraint"]),
  separatesFromOfferNames: textList(20, 160),
});

const offerIntelligenceCoreSchema = z.object({
  version: z.literal(1),
  offerName: text(160),
  safeDescription: text(300),
  subjectLabel: text(120).optional(),
  compatibleNeeds: textList(16).min(1),
  relatedGoals: textList(12).min(1),
  strongSignalGroups: z.array(offerStrongSignalGroupSchema).max(12),
  supportingSignals: textList(24, 160).min(2),
  ambiguitySignals: textList(16, 160).min(1),
  exclusions: textList(16),
  discriminatingQuestions: z.array(offerDiscriminatingQuestionSchema).min(1).max(12),
  explanationData: textList(12, 300).min(1),
  fallbackEligible: z.boolean(),
});

export const offerIntelligenceDraftSchema = offerIntelligenceCoreSchema;

export const offerIntelligenceProfileSchema = offerIntelligenceCoreSchema.extend({
  offerId: text(200),
  provenance: z.object({
    projectId: text(200),
    contextSignature: text(100),
    source: z.enum(["ai_composition", "deterministic_context", "business_confirmed"]),
    sourceFields: z.array(z.enum(["offer_name", "offer_description", "business_description", "confirmed_offer_list"])).min(1).max(4),
  }),
});

export type OfferIntelligenceDraft = z.infer<typeof offerIntelligenceDraftSchema>;
export type OfferIntelligenceProfile = z.infer<typeof offerIntelligenceProfileSchema>;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function unique(values: string[]) {
  const byValue = new Map<string, string>();
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    const key = normalize(value);
    if (!byValue.has(key)) byValue.set(key, value);
  }
  return [...byValue.values()];
}

function offerTerms(value: string) {
  const ignored = new Set(["para", "com", "sem", "por", "uma", "uns", "das", "dos", "de", "da", "do", "e", "em"]);
  return unique(normalize(value).split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !ignored.has(token)));
}

export function profileFromDraft(
  draft: OfferIntelligenceDraft,
  input: { offerId: string; projectId: string; businessContext: string; source?: OfferIntelligenceProfile["provenance"]["source"] },
): OfferIntelligenceProfile {
  return offerIntelligenceProfileSchema.parse({
    ...draft,
    offerId: input.offerId,
    provenance: {
      projectId: input.projectId,
      contextSignature: contextSignature(`${input.projectId} ${input.businessContext}`),
      source: input.source || "ai_composition",
      sourceFields: ["offer_name", "business_description", "confirmed_offer_list"],
    },
  });
}

/**
 * Fallback estritamente composicional. Ele usa apenas o nome/descrição da oferta e
 * as outras ofertas deste projeto. Conhecimento semântico amplo deve chegar pelo
 * draft estruturado da composição, nunca por uma tabela global de setores.
 */
export function buildDeterministicOfferIntelligence(input: {
  projectId: string;
  offerId: string;
  offerName: string;
  offerDescription?: string;
  businessContext: string;
  competingOfferNames: string[];
}): OfferIntelligenceProfile {
  const terms = offerTerms(`${input.offerName} ${input.offerDescription || ""}`);
  const competitors = input.competingOfferNames.filter((name) => normalize(name) !== normalize(input.offerName));
  const safeDescription = input.offerDescription?.trim()
    || `${input.offerName}: opção real informada pelo negócio, com escopo a confirmar com a equipe.`;
  const supportingSignals = unique([
    input.offerName,
    ...terms,
    `Contexto descrito para ${input.offerName.toLocaleLowerCase("pt-BR")}`,
  ]).slice(0, 12);
  return profileFromDraft({
    version: 1,
    offerName: input.offerName,
    safeDescription,
    compatibleNeeds: [`Necessidade descrita com sinais relacionados a ${input.offerName.toLocaleLowerCase("pt-BR")}.`],
    relatedGoals: [`Entender se ${input.offerName.toLocaleLowerCase("pt-BR")} merece ser considerada.`],
    strongSignalGroups: terms.length >= 2 ? [{
      clues: terms.slice(0, Math.min(4, terms.length)),
      minimumMatches: 2,
      rationale: "Múltiplos sinais da própria oferta aparecem juntos na resposta.",
    }] : [],
    supportingSignals,
    ambiguitySignals: ["contexto insuficiente", "necessidade ainda ampla"],
    exclusions: [],
    discriminatingQuestions: [{
      question: `Que sinais você percebe para a equipe avaliar ${input.offerName.toLocaleLowerCase("pt-BR")}?`,
      purpose: "signal",
      separatesFromOfferNames: competitors,
    }],
    explanationData: ["A oferta foi relacionada apenas aos sinais informados e ainda precisa ser confirmada pela equipe."],
    fallbackEligible: /\b(?:diagnostico|avaliacao|triagem|analise)\b/i.test(normalize(input.offerName)),
  }, {
    offerId: input.offerId,
    projectId: input.projectId,
    businessContext: input.businessContext,
    source: "deterministic_context",
  });
}

export function offerIntelligenceFor(offering: ServiceOffering) {
  const parsed = offerIntelligenceProfileSchema.safeParse(offering.settings?.offerIntelligence);
  return parsed.success ? parsed.data : undefined;
}

export function attachOfferIntelligenceDrafts(input: {
  offerings: ServiceOffering[];
  drafts: OfferIntelligenceDraft[];
  projectId: string;
  businessContext: string;
}) {
  const drafts = new Map(input.drafts.map((draft) => [normalize(draft.offerName), draft]));
  const competingOfferNames = input.offerings.map((offering) => offering.name);
  return input.offerings.map((offering) => {
    const draft = drafts.get(normalize(offering.name));
    const profile = draft
      ? profileFromDraft(draft, { offerId: offering.id, projectId: input.projectId, businessContext: input.businessContext })
      : buildDeterministicOfferIntelligence({
          offerId: offering.id,
          projectId: input.projectId,
          offerName: offering.name,
          offerDescription: offering.shortDescription || offering.description,
          businessContext: input.businessContext,
          competingOfferNames,
        });
    return { ...offering, settings: { ...offering.settings, offerIntelligence: profile } };
  });
}

export function questionsFromOfferIntelligenceProfiles(
  profiles: OfferIntelligenceProfile[],
  limit = 3,
): StructuredJourneyQuestion[] {
  const candidates = profiles.flatMap((profile) => profile.discriminatingQuestions.map((question) => ({
    ...question,
    coverage: question.separatesFromOfferNames.length,
  })));
  const seen = new Set<string>();
  return candidates
    .toSorted((a, b) => b.coverage - a.coverage)
    .filter((candidate) => {
      const key = normalize(candidate.question);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((candidate, index) => ({
      id: `offer-intelligence-${index + 1}`,
      question: candidate.question.endsWith("?") ? candidate.question : `${candidate.question}?`,
      type: "textarea" as const,
      purpose: index === 0 ? "need" : candidate.purpose,
      required: true,
    }));
}

export function questionsFromOfferIntelligence(offerings: ServiceOffering[], limit = 3) {
  return questionsFromOfferIntelligenceProfiles(
    offerings.map(offerIntelligenceFor).filter((profile): profile is OfferIntelligenceProfile => Boolean(profile)),
    limit,
  );
}

export function offerIntelligenceIsSufficient(offering: ServiceOffering, projectId: string) {
  const profile = offerIntelligenceFor(offering);
  if (!profile || profile.offerId !== offering.id || profile.provenance.projectId !== projectId || normalize(profile.offerName) !== normalize(offering.name)) return false;
  return Boolean(
    profile.safeDescription
    && profile.compatibleNeeds.length
    && profile.supportingSignals.length >= 2
    && profile.discriminatingQuestions.length
    && profile.explanationData.length,
  );
}

function semanticTerms(value: string) {
  return new Set(normalize(value).split(/[^a-z0-9]+/).filter((term) => term.length > 2));
}

function overlap(value: string, answerTerms: Set<string>) {
  return [...semanticTerms(value)].filter((term) => answerTerms.has(term)).length;
}

export function selectNextQualificationQuestion(input: {
  answers: Record<string, unknown>;
  offerings: ServiceOffering[];
  fields: FormField[];
  visibleFieldIds: string[];
}) {
  const answerTerms = semanticTerms(Object.values(input.answers).flat().map(String).join(" "));
  const visible = new Set(input.visibleFieldIds);
  const profiles = input.offerings.flatMap((offering) => {
    const profile = offerIntelligenceFor(offering);
    if (!profile) return [];
    const signals = [
      ...profile.compatibleNeeds,
      ...profile.relatedGoals,
      ...profile.supportingSignals,
      ...profile.strongSignalGroups.flatMap((group) => group.clues),
      ...profile.ambiguitySignals,
    ];
    return [{
      offering,
      profile,
      score: signals.reduce((score, signal) => score + overlap(signal, answerTerms), 0),
    }];
  });
  const candidateNames = new Set(
    profiles
      .toSorted((a, b) => b.score - a.score)
      .filter((candidate, index, values) => candidate.score > 0 && candidate.score >= (values[0]?.score || 0) - 1)
      .slice(0, 3)
      .map((candidate) => normalize(candidate.offering.name)),
  );
  const fieldsByQuestion = new Map(input.fields.map((field) => [normalize(field.label).replace(/\?$/, ""), field]));
  return profiles
    .flatMap(({ profile, offering, score }) => profile.discriminatingQuestions.flatMap((question) => {
      const field = fieldsByQuestion.get(normalize(question.question).replace(/\?$/, ""));
      if (!field || visible.has(field.id)) return [];
      const separatesCandidates = question.separatesFromOfferNames
        .filter((name) => candidateNames.has(normalize(name))).length;
      return [{ field, score: score * 4 + separatesCandidates * 2 + (candidateNames.has(normalize(offering.name)) ? 3 : 0) }];
    }))
    .toSorted((a, b) => b.score - a.score)[0]?.field;
}
