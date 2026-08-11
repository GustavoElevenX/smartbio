export interface AnalyticsFilters { from?: string; to?: string; goalId?: string; entryId?: string; destinationId?: string; campaign?: string; }
interface FilterableQuery { gte(column: string, value: string): FilterableQuery; lte(column: string, value: string): FilterableQuery; eq(column: string, value: string): FilterableQuery; }
export function applyAnalyticsFilters(query: FilterableQuery, filters: AnalyticsFilters) {
  let next = query; if (filters.from) next = next.gte("created_at", filters.from); if (filters.to) next = next.lte("created_at", filters.to);
  if (filters.goalId) next = next.eq("conversion_goal_id", filters.goalId); if (filters.entryId) next = next.eq("entry_point_id", filters.entryId);
  if (filters.destinationId) next = next.eq("destination_id", filters.destinationId); return next;
}
