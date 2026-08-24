import { OPTIMIZATION_THRESHOLDS } from "./config";

export interface EvaluationMetrics {
  sessions: number;
  opportunities: number;
  conversions: number;
  confirmedValue: number;
  rate: number;
}

export function evaluateObservationalChange(baseline: EvaluationMetrics, candidate: EvaluationMetrics) {
  if (baseline.sessions < OPTIMIZATION_THRESHOLDS.projectSessions || candidate.sessions < OPTIMIZATION_THRESHOLDS.projectSessions) {
    return { result: "insufficient" as const, absoluteDelta: candidate.rate - baseline.rate, relativeDelta: null, method: "observational_before_after_v1" as const };
  }
  const absoluteDelta = candidate.rate - baseline.rate;
  const relativeDelta = baseline.rate > 0 ? absoluteDelta / baseline.rate : null;
  const result = Math.abs(absoluteDelta) <= OPTIMIZATION_THRESHOLDS.neutralBand ? "neutral" : absoluteDelta > 0 ? "positive" : "negative";
  return { result, absoluteDelta, relativeDelta, method: "observational_before_after_v1" as const };
}
