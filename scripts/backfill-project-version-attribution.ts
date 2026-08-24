import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("[project-version-attribution] NOT_RUN_ENV_MISSING");
  process.exit(0);
}

const database = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Historical sessions are deliberately not assigned to a guessed version. Only dependent
// rows inherit an already-known immutable version from their session.
async function run() {
const { data: sessions, error } = await database.from("visitor_sessions").select("id,project_version_id").not("project_version_id", "is", null);
if (error?.code === "42703" || error?.code === "42P01") {
  console.log("[project-version-attribution] NOT_RUN_MIGRATION_MISSING");
  return;
}
if (error) throw error;
const versionBySession = new Map((sessions || []).map((session) => [session.id, session.project_version_id]));
let events = 0;
let opportunities = 0;

for (const [sessionId, versionId] of versionBySession) {
  const [eventRows, opportunityRows] = await Promise.all([
    database.from("analytics_events").select("id", { count: "exact", head: true }).eq("session_id", sessionId).is("project_version_id", null),
    database.from("commercial_opportunities").select("id", { count: "exact", head: true }).eq("session_id", sessionId).is("project_version_id", null),
  ]);
  if (eventRows.error) throw eventRows.error;
  if (opportunityRows.error) throw opportunityRows.error;
  events += eventRows.count || 0;
  opportunities += opportunityRows.count || 0;
  if (dryRun) continue;
  const [eventUpdate, opportunityUpdate] = await Promise.all([
    database.from("analytics_events").update({ project_version_id: versionId }).eq("session_id", sessionId).is("project_version_id", null),
    database.from("commercial_opportunities").update({ project_version_id: versionId }).eq("session_id", sessionId).is("project_version_id", null),
  ]);
  if (eventUpdate.error) throw eventUpdate.error;
  if (opportunityUpdate.error) throw opportunityUpdate.error;
}

const { count: unresolvedSessions } = await database.from("visitor_sessions").select("id", { count: "exact", head: true }).is("project_version_id", null);
console.log(JSON.stringify({ dryRun, knownSessions: versionBySession.size, events, opportunities, unresolvedSessions: unresolvedSessions || 0, policy: "unknown historical versions remain null" }));
}

await run();
