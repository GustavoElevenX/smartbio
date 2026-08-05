import { z } from "zod";
import { getAISetupActor } from "@/server/auth/setup-actor";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiError, apiSuccess, requestIp } from "@/server/http/api-response";
import { checkRateLimit } from "@/server/services/rate-limit";

const answerSchema = z.object({
  key: z.string().trim().min(1).max(120),
  value: z.union([z.string().trim().min(1).max(4000), z.array(z.string().trim().min(1).max(500)).min(1).max(30), z.number().finite(), z.boolean()]),
});

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  if (!checkRateLimit(`ai-setup-answer:${requestIp(request)}`, 40, 60_000)) return apiError("Muitas respostas em sequência.", 429, "rate_limited");
  try {
    const { sessionId } = await params;
    const payload = answerSchema.parse(await request.json());
    return apiSuccess(await aiSetupService.answer(await getAISetupActor(), sessionId, payload.key, payload.value));
  } catch (error) {
    return setupApiError(error);
  }
}
