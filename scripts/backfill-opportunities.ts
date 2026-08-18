import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("[opportunities] ignorado: Supabase não configurado.");
  process.exit(0);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sources = [
  {
    table: "leads",
    type: "lead",
    select:
      "id,workspace_id,project_id,session_id,name,email,phone,company,status,source,campaign,recommendation,estimated_value,created_at",
    title: (row: Record<string, unknown>) =>
      `Contato · ${row.name || "Novo interesse"}`,
  },
  {
    table: "quote_requests",
    type: "quote",
    select:
      "id,project_id,session_key,status,estimated_max,currency,visitor_data,created_at",
    title: () => "Solicitação de orçamento",
  },
  {
    table: "bookings",
    type: "booking",
    select: "id,project_id,session_key,status,visitor_data,created_at",
    title: () => "Solicitação de agendamento",
  },
  {
    table: "order_requests",
    type: "order",
    select:
      "id,project_id,session_key,status,totals,visitor_data,created_at",
    title: () => "Pedido",
  },
  {
    table: "reservations",
    type: "reservation",
    select:
      "id,project_id,session_key,status,total,visitor_data,created_at",
    title: () => "Solicitação de reserva",
  },
] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function status(value: unknown) {
  const current = String(value || "new");
  if (["converted", "accepted", "completed"].includes(current)) {
    return "converted";
  }
  if (["lost", "rejected", "cancelled"].includes(current)) return "lost";
  if (["contacted", "qualified", "in_progress"].includes(current)) {
    return "in_progress";
  }
  return "new";
}

let scanned = 0;
let eligible = 0;
let created = 0;
let updated = 0;

for (const source of sources) {
  const { data, error } = await db.from(source.table).select(source.select);
  if (error) throw error;

  for (const raw of data || []) {
    const row = raw as unknown as Record<string, unknown>;
    scanned++;

    const { data: project } = await db
      .from("projects")
      .select("workspace_id")
      .eq("id", row.project_id)
      .single();
    const workspaceId = row.workspace_id || project?.workspace_id;
    if (!workspaceId) continue;

    const visitor = record(row.visitor_data);
    const totals = record(row.totals);
    const contactName = text(visitor.name) || text(row.name);
    const contactEmail = text(visitor.email) || text(row.email);
    const contactPhone =
      text(visitor.phone) || text(visitor.whatsapp) || text(row.phone);
    const summary = text(row.recommendation);
    const attribution = {
      ...(text(row.source) ? { source: text(row.source) } : {}),
      ...(text(row.campaign) ? { campaign: text(row.campaign) } : {}),
    };
    const metadata = {
      backfilledFrom: source.table,
      ...(text(row.company) ? { company: text(row.company) } : {}),
    };

    const { data: existing } = await db
      .from("commercial_opportunities")
      .select("id,contact_name,contact_email,contact_phone,summary")
      .eq("project_id", row.project_id)
      .eq("source_type", source.type)
      .eq("source_id", String(row.id))
      .maybeSingle();

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (!existing.contact_name && contactName) patch.contact_name = contactName;
      if (!existing.contact_email && contactEmail) {
        patch.contact_email = contactEmail;
      }
      if (!existing.contact_phone && contactPhone) {
        patch.contact_phone = contactPhone;
      }
      if (!existing.summary && summary) patch.summary = summary;
      if (!Object.keys(patch).length) continue;

      eligible++;
      console.log(
        `[opportunities] ${dryRun ? "detectado" : "atualizando"}: ${source.type}:${row.id}`,
      );
      if (dryRun) continue;

      const { error: updateError } = await db
        .from("commercial_opportunities")
        .update(patch)
        .eq("id", existing.id);
      if (updateError) throw updateError;
      updated++;
      continue;
    }

    eligible++;
    console.log(
      `[opportunities] ${dryRun ? "detectado" : "criando"}: ${source.type}:${row.id}`,
    );
    if (dryRun) continue;

    const { data: session } = row.session_key
      ? await db
          .from("visitor_sessions")
          .select("id")
          .eq("session_key", row.session_key)
          .maybeSingle()
      : { data: null };
    const { error: insertError } = await db
      .from("commercial_opportunities")
      .insert({
        workspace_id: workspaceId,
        project_id: row.project_id,
        session_id: row.session_id || session?.id || null,
        source_type: source.type,
        source_id: String(row.id),
        status: status(row.status),
        title: source.title(row),
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        summary,
        estimated_value:
          row.estimated_value ||
          row.estimated_max ||
          row.total ||
          totals.total ||
          null,
        confirmed_value: null,
        currency: row.currency || totals.currency || "BRL",
        attribution,
        metadata,
        created_at: row.created_at,
      });
    if (insertError) throw insertError;
    created++;
  }
}

console.log(JSON.stringify({ dryRun, scanned, eligible, created, updated }));
