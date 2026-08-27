import { createClient } from "@supabase/supabase-js";
import { productionReadinessIssues } from "@/lib/env/production-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    return Response.json({
      status: "ok",
      environment: process.env.NODE_ENV || "development",
      checks: { application: true, configuration: true, supabase: "not_required", rateLimit: "not_required" },
    });
  }

  const issues = productionReadinessIssues(process.env);
  const configuration = issues.length === 0;
  let supabase = false;
  if (configuration) {
    try {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const result = await client.from("projects").select("id", { count: "exact", head: true });
      supabase = !result.error;
    } catch {
      supabase = false;
    }
  }
  const rateLimit = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
  const ready = configuration && supabase && rateLimit;
  return Response.json(
    {
      status: ready ? "ready" : "not_ready",
      environment: "production",
      checks: { application: true, configuration, supabase, rateLimit },
      ...(ready ? {} : { issues: issues.map(({ variable, message }) => ({ variable, message })) }),
    },
    { status: ready ? 200 : 503 },
  );
}
