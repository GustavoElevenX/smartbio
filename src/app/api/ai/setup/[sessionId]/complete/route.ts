import { z } from "zod";
import { getAISetupActor } from "@/server/auth/setup-actor";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiSuccess } from "@/server/http/api-response";

const completeSchema = z.object({ projectId: z.string().trim().min(1).max(100).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const payload = completeSchema.parse(await request.json());
    return apiSuccess(await aiSetupService.complete(await getAISetupActor(), sessionId, payload.projectId));
  } catch (error) {
    return setupApiError(error);
  }
}
