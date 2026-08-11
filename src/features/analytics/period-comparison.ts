export interface PeriodComparison { current: number; previous: number; changePercent: number | null; label: string; }
export function comparePeriods(current: number, previous: number): PeriodComparison {
  if (previous === 0) return { current, previous, changePercent: null, label: "Sem comparação ainda" };
  const changePercent = Math.round(((current - previous) / previous) * 1000) / 10;
  return { current, previous, changePercent, label: `${changePercent > 0 ? "+" : ""}${changePercent}% vs. período anterior` };
}
