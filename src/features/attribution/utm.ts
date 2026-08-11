export interface UtmValues { source?: string; medium?: string; campaign?: string; content?: string; term?: string; }
export function readUtm(search: URLSearchParams): UtmValues {
  return { source: search.get("utm_source") || undefined, medium: search.get("utm_medium") || undefined, campaign: search.get("utm_campaign") || undefined, content: search.get("utm_content") || undefined, term: search.get("utm_term") || undefined };
}
