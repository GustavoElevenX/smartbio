import { z } from "zod";

export const setupAnswerDetailKindSchema = z.enum([
  "business_name",
  "url",
  "whatsapp",
  "phone",
  "email",
  "address",
  "location",
  "service",
  "product",
  "price",
  "schedule",
  "audience",
  "differentiator",
  "policy",
  "goal",
  "preference",
  "constraint",
  "other",
]);

const interpretedDetailSchema = z.object({
  kind: setupAnswerDetailKindSchema,
  label: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(2000),
  evidenceExcerpt: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
});

const interpretedLocationMappingSchema = z.object({
  locationId: z.string().trim().max(160).nullable(),
  locationLabel: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(1000),
  evidenceExcerpt: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
});

export const setupAnswerInterpretationSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  textValue: z.string().trim().max(2000).nullable(),
  locationMappings: z.array(interpretedLocationMappingSchema).max(100),
  recognizedDetails: z.array(interpretedDetailSchema).max(200),
});

export const setupAnswerFactSchema = interpretedDetailSchema.extend({
  sourceId: z.string().trim().min(1).max(200),
  origin: z.literal("user"),
  verificationStatus: z.literal("verified"),
});

export const setupAnswerContextSchema = z.object({
  sourceId: z.string().trim().min(1).max(200),
  answerKey: z.string().trim().min(1).max(120),
  question: z.string().trim().min(1).max(400),
  rawAnswer: z.string().trim().min(1).max(6000),
  summary: z.string().trim().min(1).max(2000),
  origin: z.literal("user"),
  interpretationMode: z.enum(["ai", "deterministic_fallback"]),
  facts: z.array(setupAnswerFactSchema).min(1).max(201),
  locationMappings: z.array(interpretedLocationMappingSchema.extend({
    sourceId: z.string().trim().min(1).max(200),
    origin: z.literal("user"),
  })).max(100),
  capturedAt: z.iso.datetime(),
});

export const setupAnswerContextAuditSchema = z.object({
  status: z.enum(["complete", "needs_review"]),
  sourceIds: z.array(z.string().trim().min(1).max(200)).max(100),
  representedSourceIds: z.array(z.string().trim().min(1).max(200)).max(100),
  unrepresented: z.array(z.object({
    sourceId: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(1).max(500),
  })).max(100),
  generatedAt: z.iso.datetime(),
});

export type SetupAnswerInterpretation = z.infer<typeof setupAnswerInterpretationSchema>;
export type SetupAnswerContext = z.infer<typeof setupAnswerContextSchema>;
export type SetupAnswerContextAudit = z.infer<typeof setupAnswerContextAuditSchema>;

function cleanTail(value: string) {
  return value.replace(/[),.;!?]+$/, "");
}

function uniqueMatches(values: string[]) {
  return [...new Set(values.map((value) => cleanTail(value.trim())).filter(Boolean))];
}

export function deterministicAnswerInterpretation(answer: string): SetupAnswerInterpretation {
  const raw = answer.trim();
  const details: SetupAnswerInterpretation["recognizedDetails"] = [];
  const add = (kind: SetupAnswerInterpretation["recognizedDetails"][number]["kind"], label: string, value: string) => {
    if (details.some((item) => item.kind === kind && item.value === value)) return;
    details.push({ kind, label, value, evidenceExcerpt: value.slice(0, 500), confidence: 1 });
  };
  uniqueMatches(raw.match(/https?:\/\/[^\s<>"']+/gi) || []).forEach((value) => add("url", "Link informado", value));
  uniqueMatches(raw.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g) || []).forEach((value) => add("email", "E-mail informado", value));
  uniqueMatches([...raw.matchAll(/(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?(?:9?\d{4})[\s.-]*-?[\s.-]*\d{4}/g)].map((match) => match[0])).forEach((value) => add("phone", "Telefone informado", value));
  add("other", "Resposta completa", raw);
  return { summary: raw.slice(0, 2000), textValue: raw.slice(0, 2000), locationMappings: [], recognizedDetails: details };
}

function verifiedExcerpt(rawAnswer: string, excerpt: string) {
  return rawAnswer.includes(excerpt) ? excerpt : rawAnswer.slice(0, 500);
}

export function buildSetupAnswerContext(input: {
  sessionId: string;
  answerKey: string;
  question: string;
  rawAnswer: string;
  interpretation: SetupAnswerInterpretation;
  interpretationMode: SetupAnswerContext["interpretationMode"];
  capturedAt?: string;
}): SetupAnswerContext {
  const sourceId = `setup-answer:${input.sessionId}:${input.answerKey}`.slice(0, 200);
  const rawAnswer = input.rawAnswer.trim();
  const interpretedFacts = input.interpretation.recognizedDetails.map((detail) => ({
    ...detail,
    evidenceExcerpt: verifiedExcerpt(rawAnswer, detail.evidenceExcerpt),
    sourceId,
    origin: "user" as const,
    verificationStatus: "verified" as const,
  }));
  const completeAnswer = {
    kind: "other" as const,
    label: "Resposta completa",
    value: rawAnswer,
    evidenceExcerpt: rawAnswer.slice(0, 500),
    confidence: 1,
    sourceId,
    origin: "user" as const,
    verificationStatus: "verified" as const,
  };
  const facts = interpretedFacts.some((fact) => fact.kind === "other" && fact.value === rawAnswer)
    ? interpretedFacts
    : [...interpretedFacts, completeAnswer];
  return setupAnswerContextSchema.parse({
    sourceId,
    answerKey: input.answerKey,
    question: input.question,
    rawAnswer,
    summary: input.interpretation.summary || rawAnswer.slice(0, 2000),
    origin: "user",
    interpretationMode: input.interpretationMode,
    facts,
    locationMappings: input.interpretation.locationMappings.map((mapping) => ({
      ...mapping,
      evidenceExcerpt: verifiedExcerpt(rawAnswer, mapping.evidenceExcerpt),
      sourceId,
      origin: "user" as const,
    })),
    capturedAt: input.capturedAt || new Date().toISOString(),
  });
}

export function answerContextsForAI(contexts: SetupAnswerContext[] | undefined) {
  return (contexts || []).map((context) => ({
    sourceId: context.sourceId,
    answerKey: context.answerKey,
    question: context.question,
    rawAnswer: context.rawAnswer,
    summary: context.summary,
    origin: context.origin,
    facts: context.facts.map(({ kind, label, value, evidenceExcerpt, confidence, sourceId, origin, verificationStatus }) => ({ kind, label, value, evidenceExcerpt, confidence, sourceId, origin, verificationStatus })),
    locationMappings: context.locationMappings,
  }));
}
