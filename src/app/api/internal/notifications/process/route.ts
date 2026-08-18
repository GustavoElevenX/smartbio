import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { processNotificationOutboxBatch } from "@/server/notifications/notification-service";

export const runtime = "nodejs";

const inputSchema = z.object({ limit: z.number().int().min(1).max(100).optional() });

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const value = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || secret.length !== value.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(value));
}

async function processBatch(request: Request, input: unknown) {
  if (!authorized(request)) return apiError("Não autorizado.", 401, "unauthorized");
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return apiError("Lote inválido.", 422, "validation_error");
  const workerId = `${process.env.VERCEL_REGION || "local"}:${crypto.randomUUID()}`;
  return apiSuccess(await processNotificationOutboxBatch(workerId, parsed.data.limit));
}

export async function GET(request: Request) {
  return processBatch(request, {});
}

export async function POST(request: Request) {
  return processBatch(request, await request.json().catch(() => ({})));
}
