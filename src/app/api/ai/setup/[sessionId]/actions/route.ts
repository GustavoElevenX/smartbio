import { z } from "zod";
import { visitorActionSelectionSchema } from "@/features/ai-setup/ai-setup.schema";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

const schema = z.object({
  actions: z.array(visitorActionSelectionSchema).min(1).max(8),
});

export const POST = withAuthenticatedActor(async (request, context: { params: Promise<{ sessionId: string }> }, actor) => {
  try {
    const { sessionId } = await context.params;
    const input = schema.parse(await request.json());
    return apiSuccess(await aiSetupService.confirmVisitorActions(actor, sessionId, input.actions));
  } catch (error) {
    return setupApiError(error);
  }
});
