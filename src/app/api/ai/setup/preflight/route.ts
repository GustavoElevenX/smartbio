import { getActivationPreflight } from "@/server/ai-setup/activation-preflight";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

export const GET = withAuthenticatedActor(async (_request, _context, actor) =>
  apiSuccess(await getActivationPreflight(actor)),
);
