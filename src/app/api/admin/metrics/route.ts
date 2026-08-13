import { apiSuccess } from "@/server/http/api-response";
import { createServiceClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/server/platform-admin/require-platform-admin";
import { PlatformAdminRepository } from "@/server/platform-admin/platform-admin-repository";

export async function GET(request: Request) {
  await requirePlatformAdmin();
  const days = Math.min(
    365,
    Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30),
  );
  const repository = new PlatformAdminRepository(createServiceClient()!);
  const [overview, health] = await Promise.all([
    repository.overview(days),
    repository.health(days),
  ]);
  return apiSuccess({ ...overview, health: health.data || [] });
}
