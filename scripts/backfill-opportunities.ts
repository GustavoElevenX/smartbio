import { createClient } from "@supabase/supabase-js";
const dryRun = process.argv.includes("--dry-run"); const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log("[opportunities] ignorado: Supabase não configurado."); process.exit(0); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const sources = [
  { table: "leads", type: "lead", select: "id,workspace_id,project_id,session_id,name,status,estimated_value,created_at", title: (row: Record<string, unknown>) => `Contato · ${row.name || "Novo interesse"}` },
  { table: "quote_requests", type: "quote", select: "id,project_id,session_key,status,estimated_max,currency,visitor_data,created_at", title: () => "Solicitação de orçamento" },
  { table: "bookings", type: "booking", select: "id,project_id,session_key,status,visitor_data,created_at", title: () => "Solicitação de agendamento" },
  { table: "order_requests", type: "order", select: "id,project_id,session_key,status,totals,visitor_data,created_at", title: () => "Pedido" },
  { table: "reservations", type: "reservation", select: "id,project_id,session_key,status,total,visitor_data,created_at", title: () => "Solicitação de reserva" },
] as const;
let scanned = 0; let eligible = 0; let created = 0;
for (const source of sources) { const { data, error } = await db.from(source.table).select(source.select); if (error) throw error; for (const raw of data || []) { const row = raw as unknown as Record<string, unknown>; scanned++; const { data: project } = await db.from("projects").select("workspace_id").eq("id", row.project_id).single(); const workspaceId = row.workspace_id || project?.workspace_id; if (!workspaceId) continue;
    const { count } = await db.from("commercial_opportunities").select("id", { count: "exact", head: true }).eq("project_id", row.project_id).eq("source_type", source.type).eq("source_id", String(row.id)); if (count) continue; eligible++; console.log(`[opportunities] ${dryRun ? "detectado" : "criando"}: ${source.type}:${row.id}`); if (dryRun) continue;
    const visitor = row.visitor_data && typeof row.visitor_data === "object" ? row.visitor_data as Record<string, unknown> : {}; const totals = row.totals && typeof row.totals === "object" ? row.totals as Record<string, unknown> : {};
    const { data: session } = row.session_key ? await db.from("visitor_sessions").select("id").eq("session_key", row.session_key).maybeSingle() : { data: null };
    const { error: insertError } = await db.from("commercial_opportunities").insert({ workspace_id: workspaceId, project_id: row.project_id, session_id: row.session_id || session?.id || null, source_type: source.type, source_id: String(row.id), status: ["converted", "accepted", "completed"].includes(String(row.status)) ? "converted" : ["lost", "rejected", "cancelled"].includes(String(row.status)) ? "lost" : "new", title: source.title(row), contact_name: visitor.name || row.name || null, contact_email: visitor.email || null, contact_phone: visitor.phone || null, estimated_value: row.estimated_value || row.estimated_max || row.total || totals.total || null, confirmed_value: null, currency: row.currency || totals.currency || "BRL", attribution: {}, metadata: { backfilledFrom: source.table }, created_at: row.created_at }); if (insertError) throw insertError; created++;
  } }
console.log(JSON.stringify({ dryRun, scanned, eligible, created }));
