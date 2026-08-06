import { z } from "zod";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

const schema = z.object({ projectId: z.uuid(), applyVerifiedFacts: z.boolean() });

export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/ai/setup/[sessionId]/finalize-project">, actor) => {
  try {
    const { sessionId } = await context.params;
    const input = schema.parse(await request.json());
    return apiSuccess(await aiSetupService.finalizeProject(actor, sessionId, input.projectId, input.applyVerifiedFacts));
  } catch (error) { return setupApiError(error); }
});
