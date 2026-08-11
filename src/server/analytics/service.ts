import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsFilters } from "./queries";
import { loadConversionAnalyticsRows } from "./repository";
export async function getConversionAnalytics(supabase: SupabaseClient, projectId: string, filters: AnalyticsFilters = {}) { return loadConversionAnalyticsRows(supabase, projectId, filters); }
