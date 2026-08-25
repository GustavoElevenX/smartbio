import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

export const GET = withAuthenticatedActor(async (_request, _context, actor) => {
  try {
    return apiSuccess({ session: await aiSetupService.active(actor) });
  } catch (error) {
    return setupApiError(error);
  }
});
