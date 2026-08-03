import { evaluateCondition } from "@/features/capabilities/rules";
import type { QuoteCalculationRule, QuoteDefinition } from "@/types";

export interface QuoteEstimate {
  min?: number;
  max?: number;
  currency: string;
  appliedRuleIds: string[];
  requiresManualReview: boolean;
}

export function calculateQuoteEstimate(
  definition: Pick<QuoteDefinition, "baseAmount" | "currency" | "estimationMode">,
  rules: QuoteCalculationRule[],
  answers: Record<string, unknown>,
): QuoteEstimate {
  if (definition.estimationMode === "manual") {
    return { currency: definition.currency, appliedRuleIds: [], requiresManualReview: true };
  }

  let min = definition.baseAmount || 0;
  let max = definition.baseAmount || 0;
  const appliedRuleIds: string[] = [];
  for (const rule of rules) {
    if (!evaluateCondition(rule.condition, answers)) continue;
    appliedRuleIds.push(rule.id);
    if (rule.operation === "add") {
      min += rule.amount || 0;
      max += rule.amount || 0;
    } else if (rule.operation === "multiply") {
      min *= rule.amount || 1;
      max *= rule.amount || 1;
    } else if (rule.operation === "set") {
      min = rule.amount || 0;
      max = rule.amount || 0;
    } else {
      min = rule.minAmount ?? min;
      max = rule.maxAmount ?? max;
    }
  }

  if (definition.estimationMode === "starting_at") max = min;
  return {
    min: Math.max(0, Math.round(min * 100) / 100),
    max: Math.max(0, Math.round(Math.max(min, max) * 100) / 100),
    currency: definition.currency,
    appliedRuleIds,
    requiresManualReview: false,
  };
}
