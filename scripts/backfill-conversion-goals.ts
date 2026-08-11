import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run"); const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log("[conversion-goals] ignorado: Supabase não configurado."); process.exit(0); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: projects, error } = await db.from("projects").select("id,primary_goal,settings").order("created_at"); if (error) throw error;
let eligible = 0; let created = 0; let skipped = 0;
for (const project of projects || []) { const { count } = await db.from("conversion_goals").select("id", { count: "exact", head: true }).eq("project_id", project.id); if (count) { skipped++; continue; }
  const { data: steps, error: stepError } = await db.from("journey_steps").select("id,title,description,type,step_order,is_active").eq("project_id", project.id).eq("is_active", true).order("step_order"); if (stepError) throw stepError; const first = steps?.[0]; if (!first) { skipped++; continue; } eligible++;
  const goalKind = first.type === "quote" ? "request_quote" : first.type === "schedule" ? "schedule" : first.type === "reservation" ? "reserve" : ["catalog", "cart"].includes(first.type) ? "buy" : first.type === "routing" ? "visit" : "custom";
  console.log(`[conversion-goals] ${dryRun ? "detectado" : "criando"}: ${project.id} → ${project.primary_goal || first.title}`); if (dryRun) continue;
  const { error: insertError } = await db.from("conversion_goals").insert({ id: randomUUID(), project_id: project.id, name: project.primary_goal || first.title, description: first.description, goal_kind: goalKind, target_step_id: first.id, destination_label: (project.settings as Record<string, unknown> | null)?.primaryDestination || null, is_primary: true, is_active: true, goal_order: 0 }); if (insertError) throw insertError; created++;
}
console.log(JSON.stringify({ dryRun, scanned: projects?.length || 0, eligible, created, skipped }));
