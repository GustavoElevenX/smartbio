import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { billingErrorResponse, getBillingStatus } from "@/server/billing/billing-service";
import { getRequestId, requestPathname } from "@/server/observability/log";

export const runtime = "nodejs";
export const GET = withAuthenticatedActor(async (request, _context, actor) => {
  try {
    return apiSuccess(await getBillingStatus(actor));
  } catch (error) {
    return billingErrorResponse(error, { requestId: getRequestId(request), route: requestPathname(request), workspaceId: actor.workspaceId, userId: actor.userId });
  }
});
