import { z } from "zod";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

const completeSchema = z.object({ projectId: z.string().trim().min(1).max(100).optional() });

export const POST = withAuthenticatedActor(async (request, { params }: { params: Promise<{ sessionId: string }> }, actor) => {
  try {
    const { sessionId } = await params;
    const payload = completeSchema.parse(await request.json());
    return apiSuccess(await aiSetupService.complete(actor, sessionId, payload.projectId));
  } catch (error) { return setupApiError(error); }
});
