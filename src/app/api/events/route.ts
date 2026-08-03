import { NextResponse } from "next/server";
import { analyticsEventSchema } from "@/lib/validation/schemas";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/server/services/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  if (!checkRateLimit(`event:${ip}`, 120)) return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });
  const parsed = analyticsEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Evento inválido.", details: parsed.error.flatten() }, { status: 400 });
  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ accepted: true, persisted: false }, { status: 202 });
  const data = parsed.data;
  const { data: session } = await supabase.from("visitor_sessions").select("id").eq("session_key", data.sessionId).maybeSingle();
  let sessionId = session?.id;
  if (!sessionId) {
    const { data: inserted, error: sessionError } = await supabase.from("visitor_sessions").insert({ project_id: data.projectId, visitor_id: data.visitorId, session_key: data.sessionId, referrer: data.referrer || null, utm_source: data.utmSource || null, utm_medium: data.utmMedium || null, utm_campaign: data.utmCampaign || null, device_type: data.deviceType || null }).select("id").single();
    if (sessionError) return NextResponse.json({ error: "Não foi possível iniciar a sessão." }, { status: 400 }); sessionId = inserted.id;
  }
  const { error } = await supabase.from("analytics_events").insert({ project_id: data.projectId, session_id: sessionId, event_name: data.eventName, step_id: data.stepId || null, option_id: data.optionId || null, metadata: { ...data.metadata, utm_content: data.utmContent, utm_term: data.utmTerm } });
  if (error) return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 400 });
  return NextResponse.json({ accepted: true, persisted: true }, { status: 201 });
}
