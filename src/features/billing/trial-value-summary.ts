export interface TrialValueOpportunity {
  status: string;
  confirmed_value?: number | string | null;
}

export function buildTrialValueSummary(input: { periodDays: number; sessions: number; opportunities: TrialValueOpportunity[] }) {
  const converted = input.opportunities.filter((item) => item.status === "converted");
  return {
    periodDays: input.periodDays,
    sessions: input.sessions,
    opportunities: input.opportunities.length,
    conversions: converted.length,
    confirmedValue: converted.reduce((total, item) => total + Number(item.confirmed_value || 0), 0),
  };
}
