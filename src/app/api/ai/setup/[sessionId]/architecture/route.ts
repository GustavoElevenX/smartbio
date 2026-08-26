import { z } from "zod";
import { commercialArchitectureSchema } from "@/features/ai-setup/ai-setup.schema";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

const updateSchema = z.object({ architecture: commercialArchitectureSchema });

export const POST = withAuthenticatedActor(async (_request, context: { params: Promise<{ sessionId: string }> }, actor) => {
  try {
    const { sessionId } = await context.params;
    return apiSuccess(await aiSetupService.confirmCommercialArchitecture(actor, sessionId));
  } catch (error) {
    return setupApiError(error);
  }
});

export const PATCH = withAuthenticatedActor(async (request, context: { params: Promise<{ sessionId: string }> }, actor) => {
  try {
    const { sessionId } = await context.params;
    const input = updateSchema.parse(await request.json());
    return apiSuccess(await aiSetupService.updateCommercialArchitecture(actor, sessionId, input.architecture));
  } catch (error) {
    return setupApiError(error);
  }
});
