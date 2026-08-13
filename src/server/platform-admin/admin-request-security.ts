import "server-only";
import { apiError } from "@/server/http/api-response";
import {
  consumeRateLimit,
  rateLimitRules,
} from "@/server/rate-limit/rate-limit";

export async function protectAdminMutation(
  request: Request,
  adminUserId: string,
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return apiError("Origem inválida.", 403, "invalid_origin");
  const result = await consumeRateLimit(
    "admin-sensitive-mutation",
    adminUserId,
    rateLimitRules.adminSensitiveMutation,
    { failClosed: true },
  );
  if (!result.allowed)
    return apiError(
      "Muitas alterações administrativas. Aguarde alguns minutos.",
      429,
      "rate_limited",
    );
  return null;
}
