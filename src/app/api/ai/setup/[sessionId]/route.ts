import { getAISetupActor } from "@/server/auth/setup-actor";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiSuccess } from "@/server/http/api-response";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    return apiSuccess(await aiSetupService.get(await getAISetupActor(), sessionId));
  } catch (error) {
    return setupApiError(error);
  }
}
