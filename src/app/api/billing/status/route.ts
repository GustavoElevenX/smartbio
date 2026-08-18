import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { billingErrorResponse, getBillingStatus } from "@/server/billing/billing-service";

export const runtime = "nodejs";
export const GET = withAuthenticatedActor(async (_request, _context, actor) => {
  try {
    return apiSuccess(await getBillingStatus(actor));
  } catch (error) {
    return billingErrorResponse(error);
  }
});
