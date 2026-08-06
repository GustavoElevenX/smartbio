import "server-only";

export interface PublicRequestIdentity {
  ip: string;
  projectId?: string;
  sessionId?: string;
  objectId?: string;
}

const platformIpHeaders = [
  "cf-connecting-ip",
  "fly-client-ip",
  "x-vercel-forwarded-for",
  "x-real-ip",
] as const;

function firstAddress(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

export function publicRequestIp(request: Request) {
  for (const header of platformIpHeaders) {
    const address = firstAddress(request.headers.get(header));
    if (address) return address;
  }
  return firstAddress(request.headers.get("x-forwarded-for")) || "unknown";
}

export function publicRateLimitIdentifier(
  request: Request,
  input: Omit<PublicRequestIdentity, "ip">,
) {
  return [input.projectId, input.sessionId || input.objectId, publicRequestIp(request)]
    .filter((value): value is string => Boolean(value))
    .join(":");
}
