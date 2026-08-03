import { evaluateCondition } from "@/features/capabilities/rules";
import type { QualificationResult, QualificationRule } from "@/types";

export interface QualificationBands {
  coldMax: number;
  potentialMax: number;
}

const defaultBands: QualificationBands = { coldMax: 19, potentialMax: 49 };

export function qualifyLead(
  answers: Record<string, unknown>,
  rules: QualificationRule[],
  bands: QualificationBands = defaultBands,
): QualificationResult {
  let score = 0;
  let recommendationKey: string | undefined;
  let routeKey: string | undefined;
  const reasons: string[] = [];

  for (const rule of rules) {
    if (!evaluateCondition(rule.condition, answers)) continue;
    score += rule.scoreDelta || 0;
    recommendationKey = rule.recommendationKey || recommendationKey;
    routeKey = rule.routeKey || routeKey;
    if (rule.reason) reasons.push(rule.reason);
  }

  const band: QualificationResult["band"] = score <= bands.coldMax ? "cold" : score <= bands.potentialMax ? "potential" : "qualified";
  return {
    score,
    band,
    recommendationKey: recommendationKey || `recommendation_${band}`,
    routeKey,
    reasons: reasons.length ? reasons : ["Classificação calculada pelas respostas da jornada."],
  };
}
