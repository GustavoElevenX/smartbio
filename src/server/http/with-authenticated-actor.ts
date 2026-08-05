import "server-only";

import { NextResponse } from "next/server";
import { authErrorCode, authErrorStatus } from "@/server/auth/auth-errors";
import { requireAuthenticatedActor, type AuthenticatedActor } from "@/server/auth/setup-actor";

export function withAuthenticatedActor<TContext = unknown>(
  handler: (request: Request, context: TContext, actor: AuthenticatedActor) => Promise<Response>,
) {
  return async (request: Request, context: TContext) => {
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
    try {
      const response = await handler(request, context, await requireAuthenticatedActor());
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      const status = authErrorStatus(error);
      if (status === 500) console.error("authenticated_route_failed", { requestId });
      return NextResponse.json(
        { ok: false, error: { code: authErrorCode(error), message: status === 500 ? "Não foi possível concluir a solicitação." : (error as Error).message }, requestId },
        { status, headers: { "x-request-id": requestId } },
      );
    }
  };
}
