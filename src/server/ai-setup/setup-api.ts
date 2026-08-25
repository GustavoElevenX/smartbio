import "server-only";

import { ZodError } from "zod";
import { AISetupNotFoundError } from "@/server/ai-setup/ai-setup-service";
import { ActivationPreflightError } from "@/server/ai-setup/activation-preflight";
import { apiError, validationError } from "@/server/http/api-response";

export function setupApiError(error: unknown) {
  if (error instanceof ZodError) return validationError(error);
  if (error instanceof AISetupNotFoundError) return apiError(error.message, 404, "not_found");
  if (error instanceof ActivationPreflightError)
    return apiError(error.message, error.status, "activation_preflight_blocked");
  return apiError(error instanceof Error ? error.message : "Não foi possível concluir a operação.", 400, "setup_error");
}
