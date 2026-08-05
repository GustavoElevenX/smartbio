import { getAISetupActor } from "@/server/auth/setup-actor";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiError, apiSuccess, requestIp } from "@/server/http/api-response";
import { checkRateLimit } from "@/server/services/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  if (!checkRateLimit(`ai-setup-generate:${requestIp(request)}`, 8, 60_000)) return apiError("Muitas gerações. Aguarde um instante.", 429, "rate_limited");
  try {
    const { sessionId } = await params;
    return apiSuccess(await aiSetupService.generate(await getAISetupActor(), sessionId));
  } catch (error) {
    return setupApiError(error);
  }
}
