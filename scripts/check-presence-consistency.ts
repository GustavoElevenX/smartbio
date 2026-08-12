import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log("[presence-consistency] ignorado: Supabase não configurado."); process.exit(0); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const [{ data: pages, error: pagesError }, { data: sections, error: sectionsError }, { data: entries, error: entriesError }] = await Promise.all([
  db.from("presence_pages").select("id,project_id,page_key,path,is_home,is_active,default_conversion_goal_id"),
  db.from("presence_sections").select("id,page_id,section_key,section_type,section_order"),
  db.from("entry_points").select("id,project_id,surface_mode,presence_page_id,conversion_goal_id,target_step_id"),
]);
if (pagesError || sectionsError || entriesError) throw pagesError || sectionsError || entriesError;
const issues: Array<Record<string, unknown>> = [];
const pagesByProject = Map.groupBy(pages || [], (page) => page.project_id);
for (const [projectId, projectPages] of pagesByProject) {
  if (projectPages.filter((page) => page.is_home).length !== 1) issues.push({ projectId, code: "home_count", count: projectPages.filter((page) => page.is_home).length });
  if (new Set(projectPages.map((page) => page.path)).size !== projectPages.length) issues.push({ projectId, code: "duplicate_path" });
  if (new Set(projectPages.map((page) => page.page_key)).size !== projectPages.length) issues.push({ projectId, code: "duplicate_key" });
}
const pageIds = new Set((pages || []).map((page) => page.id));
for (const section of sections || []) if (!pageIds.has(section.page_id)) issues.push({ sectionId: section.id, code: "orphan_section" });
for (const entry of entries || []) {
  if (["presence", "landing"].includes(entry.surface_mode) && entry.presence_page_id && !pageIds.has(entry.presence_page_id)) issues.push({ entryId: entry.id, code: "missing_presence_page" });
  if (entry.surface_mode === "conversion_direct" && !entry.conversion_goal_id && !entry.target_step_id) issues.push({ entryId: entry.id, code: "missing_direct_destination" });
}
issues.forEach((issue) => console.log(JSON.stringify(issue)));
console.log(JSON.stringify({ pages: pages?.length || 0, sections: sections?.length || 0, entries: entries?.length || 0, issues: issues.length }));
if (issues.length) process.exitCode = 2;
