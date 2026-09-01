import "server-only";

export interface ErrorLogContext {
  requestId?: string;
  route: string;
  workspaceId?: string;
  userId?: string;
  code?: string;
  provider?: string;
  providerRequestId?: string;
  statusCode?: number;
}

const requestIds = new WeakMap<Request, string>();

export function getRequestId(request: Request) {
  const cached = requestIds.get(request);
  if (cached) return cached;
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  requestIds.set(request, requestId);
  return requestId;
}

export function withRequestId<T extends Response>(response: T, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

export function requestPathname(request: Request) {
  return new URL(request.url).pathname;
}

export function logError(event: string, context: ErrorLogContext) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "error",
    event,
    ...(context.requestId ? { requestId: context.requestId } : {}),
    route: context.route,
    release:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.NEXT_PUBLIC_APP_VERSION ||
      "dev",
    ...(context.workspaceId ? { workspaceId: context.workspaceId } : {}),
    ...(context.userId ? { userId: context.userId } : {}),
    ...(context.code ? { code: context.code } : {}),
    ...(context.provider ? { provider: context.provider } : {}),
    ...(context.providerRequestId
      ? { providerRequestId: context.providerRequestId }
      : {}),
    ...(context.statusCode ? { statusCode: context.statusCode } : {}),
  }));
}
