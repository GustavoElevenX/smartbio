import { qualifyLead } from "@/features/qualification/qualification-engine";
import type { QualificationRule } from "@/types";

const reservedAnswerKeys = new Set([
  "qualification_score",
  "qualification_band",
  "qualification_reason",
  "status",
  "score",
  "estimated_value",
  "estimatedValue",
  "operational_status",
  "operationalStatus",
]);

export function sanitizePublicLeadAnswers(answers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(answers).filter(([key]) => !reservedAnswerKeys.has(key)),
  );
}

export function derivePublicLeadQualification(
  answers: Record<string, string>,
  rules: QualificationRule[] = [],
) {
  const sanitizedAnswers = sanitizePublicLeadAnswers(answers);
  return {
    answers: sanitizedAnswers,
    qualification: rules.length
      ? qualifyLead(sanitizedAnswers, rules)
      : undefined,
  };
}
