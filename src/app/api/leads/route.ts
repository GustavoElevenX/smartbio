import { NextResponse } from "next/server";
import { leadSchema } from "@/lib/validation/schemas";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/server/services/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  if (!checkRateLimit(`lead:${ip}`, 8, 60_000)) return NextResponse.json({ error: "Tente novamente em instantes." }, { status: 429 });
  const parsed = leadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.honeypot) return NextResponse.json({ accepted: true }, { status: 202 });
  const supabase = createServiceClient(); if (!supabase) return NextResponse.json({ accepted: true, persisted: false }, { status: 202 });
  const { data: project, error: projectError } = await supabase.from("projects").select("workspace_id").eq("id", parsed.data.projectId).eq("status", "published").single();
  if (projectError || !project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  const { data: session } = await supabase.from("visitor_sessions").select("id").eq("session_key", parsed.data.sessionId).maybeSingle();
  const { error } = await supabase.from("leads").insert({
    workspace_id: project.workspace_id, project_id: parsed.data.projectId, session_id: session?.id || null,
    name: parsed.data.name || null, email: parsed.data.email || null, phone: parsed.data.phone || null,
    company: parsed.data.company || null, status: parsed.data.status, source: parsed.data.source || null,
    campaign: parsed.data.campaign || null, recommendation: parsed.data.recommendation || null,
    answers: parsed.data.answers, score: parsed.data.score || null,
    qualification_band: parsed.data.qualificationBand || null, qualification_reason: parsed.data.qualificationReason || null,
    commercial_action: parsed.data.commercialAction || null, commercial_object_id: parsed.data.commercialObjectId || null,
    operational_status: parsed.data.operationalStatus || null, estimated_value: parsed.data.estimatedValue || null,
    scheduled_at: parsed.data.scheduledAt || null, location_name: parsed.data.locationName || null,
    items: parsed.data.items || [], attachments: parsed.data.attachments || [], timeline: parsed.data.timeline || [],
  });
  if (error) return NextResponse.json({ error: "Não foi possível salvar o lead." }, { status: 400 });
  return NextResponse.json({ accepted: true, persisted: true }, { status: 201 });
}
