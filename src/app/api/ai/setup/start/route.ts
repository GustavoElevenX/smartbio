import { z } from "zod";
import { setupInitialInputSchema } from "@/features/ai-setup/ai-setup.schema";
import { getAISetupActor } from "@/server/auth/setup-actor";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiError, apiSuccess, requestIp } from "@/server/http/api-response";
import { checkRateLimit } from "@/server/services/rate-limit";

const startSchema = z.object({ input: setupInitialInputSchema, sources: z.array(z.string().trim().min(1).max(240)).max(10).default([]) });

export async function POST(request: Request) {
  if (!checkRateLimit(`ai-setup-start:${requestIp(request)}`, 8, 60_000)) return apiError("Muitas tentativas. Aguarde um instante.", 429, "rate_limited");
  try {
    const payload = startSchema.parse(await request.json());
    return apiSuccess(await aiSetupService.start(await getAISetupActor(), payload.input, payload.sources), 201);
  } catch (error) {
    return setupApiError(error);
  }
}
