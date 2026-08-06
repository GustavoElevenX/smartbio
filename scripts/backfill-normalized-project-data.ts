import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("[backfill] ignorado: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não estão configurados.");
  process.exit(0);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: projects, error } = await db.from("projects").select("id,workspace_id,settings").order("created_at");
if (error) throw error;

let eligible = 0;
let migrated = 0;
let skipped = 0;

for (const row of projects || []) {
  const settings = row.settings && typeof row.settings === "object" ? row.settings : {};
  const payload = settings.projectPayload && typeof settings.projectPayload === "object" ? settings.projectPayload : null;
  if (!payload) { skipped += 1; continue; }
  const { count, error: countError } = await db.from("journey_steps").select("id", { count: "exact", head: true }).eq("project_id", row.id);
  if (countError) throw countError;
  if ((count || 0) > 0) { skipped += 1; continue; }
  eligible += 1;
  console.log(`[backfill] ${dryRun ? "detectado" : "migrando"}: ${row.id}`);
  if (dryRun) continue;

  const steps = Array.isArray(payload.steps) ? payload.steps as Array<Record<string, unknown>> : [];
  if (steps.length) {
    const { error: stepsError } = await db.from("journey_steps").insert(steps.map((step: Record<string, unknown>, index: number) => ({
      id: step.id, project_id: row.id, type: step.type, title: step.title,
      description: step.description || null, step_order: step.order ?? index,
      is_active: step.isActive ?? true,
      settings: { visualVariant: step.visualVariant, blocks: step.blocks || [], recommendation: step.recommendation, stepSettings: step.settings || {} },
    })));
    if (stepsError) throw stepsError;
  }
  if (payload.brand) {
    const { error: brandError } = await db.from("brand_profiles").upsert({
      project_id: row.id, extracted_colors: payload.brand.extractedColors || [], active_palette: payload.brand.activePalette || {},
      palette_variations: payload.brand.paletteVariations || [], design_system: payload.designSystem || {},
      brand_personality: payload.brand.brandPersonality || [], analysis_metadata: payload.brand.analysisMetadata || {},
    }, { onConflict: "project_id", ignoreDuplicates: true });
    if (brandError) throw brandError;
  }
  if (Array.isArray(payload.capabilities) && payload.capabilities.length) {
    const capabilities = payload.capabilities as Array<Record<string, unknown>>;
    const { error: capabilityError } = await db.from("project_capabilities").upsert(capabilities.map((item: Record<string, unknown>) => ({
      project_id: row.id, capability_key: item.key, enabled: item.enabled, source: item.source,
      settings: { ...(item.configuration || {}), version: item.version || 1 },
    })), { onConflict: "project_id,capability_key", ignoreDuplicates: true });
    if (capabilityError) throw capabilityError;
  }
  if (Array.isArray(payload.dataRequirements) && payload.dataRequirements.length) {
    const requirements = payload.dataRequirements as Array<Record<string, unknown>>;
    const { error: requirementError } = await db.from("project_data_requirements").upsert(requirements.map((item: Record<string, unknown>) => ({
      project_id: row.id, requirement_key: item.key, label: item.label, capability_key: item.capability,
      status: item.status, severity: item.severity, value: item.value ?? null, origin: item.origin || null,
      source_id: item.sourceId || null, field_metadata: item.fieldMetadata || {}, reason: item.reason,
    })), { onConflict: "project_id,requirement_key", ignoreDuplicates: true });
    if (requirementError) throw requirementError;
  }
  const { data: membership } = await db.from("workspace_members").select("user_id").eq("workspace_id", row.workspace_id).eq("role", "owner").order("created_at").limit(1).maybeSingle();
  const { error: auditError } = await db.from("commercial_audit_log").insert({ workspace_id: row.workspace_id, project_id: row.id, actor_id: membership?.user_id || null, object_type: "project", object_id: row.id, action: "project.normalized_backfill", before_state: null, after_state: { source: "settings.projectPayload" } });
  if (auditError) throw auditError;
  migrated += 1;
}

console.log(JSON.stringify({ dryRun, scanned: projects?.length || 0, eligible, migrated, skipped }));
