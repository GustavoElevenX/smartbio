import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

export const GET = withAuthenticatedActor(async (_request, { params }: { params: Promise<{ sessionId: string }> }, actor) => {
  try { const { sessionId } = await params; return apiSuccess(await aiSetupService.get(actor, sessionId)); }
  catch (error) { return setupApiError(error); }
});

export const PATCH = withAuthenticatedActor(async (request, { params }: { params: Promise<{ sessionId: string }> }, actor) => {
  try {
    const { sessionId } = await params;
    const input = setupDraftInputSchema.parse(await request.json());
    return apiSuccess(await aiSetupService.saveDraft(actor, sessionId, input));
  } catch (error) {
    return setupApiError(error);
  }
});
import { setupDraftInputSchema } from "@/features/ai-setup/ai-setup.schema";
