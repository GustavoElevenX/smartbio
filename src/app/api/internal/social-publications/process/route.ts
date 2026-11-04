import { timingSafeEqual } from "node:crypto";
import { processPublications } from "@/server/content-studio/social";
import { apiError } from "@/server/http/api-response";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.SOCIAL_PUBLISHING_CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || secret.length !== supplied.length || !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) return apiError("Não autorizado.", 401, "unauthorized");
  if (process.env.SOCIAL_PUBLISHING_ENABLED !== "true") return apiError("Publicação desativada.", 503, "disabled");
  try { return Response.json({ data: await processPublications(`cron:${crypto.randomUUID()}`) }); }
  catch { return apiError("Não foi possível processar a fila.", 500, "queue_failed"); }
}
