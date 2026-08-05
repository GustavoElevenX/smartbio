export class SmartBioAIError extends Error {
  constructor(message: string, readonly code: string, readonly retryable = false, options?: ErrorOptions) {
    super(message, options);
    this.name = "SmartBioAIError";
  }
}

export class AIConfigurationError extends SmartBioAIError {
  constructor(message = "A IA está ativada, mas a chave do provider não foi configurada.") {
    super(message, "ai_not_configured", false);
    this.name = "AIConfigurationError";
  }
}

export function normalizeAIError(error: unknown) {
  if (error instanceof SmartBioAIError) return error;
  const value = error as { status?: number; code?: string; name?: string; message?: string };
  const status = value?.status;
  const retryable = status === 408 || status === 409 || status === 429 || Boolean(status && status >= 500) || value?.name === "AbortError";
  const code = value?.code || (value?.name === "AbortError" ? "timeout" : "provider_error");
  return new SmartBioAIError(value?.message || "Falha temporária ao usar a IA.", code, retryable, { cause: error });
}
