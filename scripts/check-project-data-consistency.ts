import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("[consistency] ignorado: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não estão configurados.");
  process.exit(0);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: projects, error } = await db.from("projects").select("id,settings").order("created_at");
if (error) throw error;
let divergences = 0;

for (const project of projects || []) {
  const settings = project.settings && typeof project.settings === "object" ? project.settings : {};
  const cached = settings.projectPayload && typeof settings.projectPayload === "object" ? settings.projectPayload : null;
  const published = settings.publishedPayload && typeof settings.publishedPayload === "object" ? settings.publishedPayload : null;
  const [steps, capabilities, requirements, services] = await Promise.all([
    db.from("journey_steps").select("id", { count: "exact", head: true }).eq("project_id", project.id),
    db.from("project_capabilities").select("id", { count: "exact", head: true }).eq("project_id", project.id),
    db.from("project_data_requirements").select("id", { count: "exact", head: true }).eq("project_id", project.id),
    db.from("service_offerings").select("id", { count: "exact", head: true }).eq("project_id", project.id),
  ]);
  for (const result of [steps, capabilities, requirements, services]) if (result.error) throw result.error;
  const comparisons = [
    ["steps", steps.count || 0, Array.isArray(cached?.steps) ? cached.steps.length : 0],
    ["capabilities", capabilities.count || 0, Array.isArray(cached?.capabilities) ? cached.capabilities.length : 0],
    ["dataRequirements", requirements.count || 0, Array.isArray(cached?.dataRequirements) ? cached.dataRequirements.length : 0],
    ["commercialConfig.serviceOfferings", services.count || 0, Array.isArray(cached?.commercialConfig?.serviceOfferings) ? cached.commercialConfig.serviceOfferings.length : 0],
  ];
  for (const [field, normalized, cache] of comparisons) {
    if (cached && normalized !== cache) {
      divergences += 1;
      console.log(JSON.stringify({ projectId: project.id, field, normalized, cache, cacheVersion: cached.version || null, publishedVersion: published?.version || null }));
    }
  }
}
console.log(JSON.stringify({ scanned: projects?.length || 0, divergences }));
if (divergences) process.exitCode = 2;
