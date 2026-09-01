import "server-only";

import { NextResponse } from "next/server";
import { authErrorCode, authErrorStatus } from "@/server/auth/auth-errors";
import {
  requireAuthenticatedActor,
  type AuthenticatedActor,
} from "@/server/auth/setup-actor";
import { createServiceClient } from "@/lib/supabase/server";
import { EntitlementError } from "@/server/entitlements/entitlement-types";
import {
  getRequestId,
  logError,
  requestPathname,
  withRequestId,
} from "@/server/observability/log";

export function withAuthenticatedActor<TContext = unknown>(
  handler: (
    request: Request,
    context: TContext,
    actor: AuthenticatedActor,
  ) => Promise<Response>,
) {
  return async (request: Request, context: TContext) => {
    const requestId = getRequestId(request);
    let actor: AuthenticatedActor | undefined;
    try {
      actor = await requireAuthenticatedActor();
      const response = await handler(request, context, actor);
      if (
        actor.mode === "platform_support" &&
        request.method !== "GET" &&
        request.method !== "HEAD" &&
        response.status < 400
      ) {
        await createServiceClient()
          ?.from("platform_admin_audit_log")
          .insert({
            admin_user_id: actor.platform!.realUserId,
            admin_role: actor.platform!.role,
            support_session_id: actor.platform!.supportSessionId,
            workspace_id: actor.workspaceId,
            action: "support.mutation",
            object_type: "api_route",
            object_id: new URL(request.url).pathname,
            request_id: requestId,
            after_state: { method: request.method, status: response.status },
          });
      }
      return withRequestId(response, requestId);
    } catch (error) {
      const status = authErrorStatus(error);
      if (status === 500)
        logError("authenticated_route_failed", {
          requestId,
          route: requestPathname(request),
          workspaceId: actor?.workspaceId,
          userId: actor?.userId,
        });
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: authErrorCode(error),
            message:
              status === 500
                ? "Não foi possível concluir a solicitação."
                : (error as Error).message,
            ...(error instanceof EntitlementError
              ? { details: { feature: error.feature } }
              : {}),
          },
          requestId,
        },
        { status, headers: { "x-request-id": requestId } },
      );
    }
  };
}
