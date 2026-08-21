export interface ApiClientPayload<T> {
  data?: T;
  error?: string | { message?: string };
  ok?: boolean;
  requestId?: string;
}

function nonJsonResponseMessage(response: Response, fallbackMessage: string) {
  const pathname = (() => {
    try {
      return new URL(response.url).pathname;
    } catch {
      return "";
    }
  })();

  if (response.redirected && pathname.startsWith("/login")) {
    return "Sua sessão expirou. Entre novamente e repita a importação.";
  }
  if ([408, 502, 503, 504].includes(response.status)) {
    return "A importação demorou mais que o esperado. Tente novamente em instantes.";
  }
  if (response.status === 404) {
    return "O serviço de importação não está disponível neste ambiente.";
  }
  return fallbackMessage;
}

export async function readApiPayload<T>(
  response: Response,
  fallbackMessage: string,
): Promise<ApiClientPayload<T>> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("json")) {
    throw new Error(nonJsonResponseMessage(response, fallbackMessage));
  }

  try {
    return JSON.parse(await response.text()) as ApiClientPayload<T>;
  } catch {
    throw new Error(fallbackMessage);
  }
}

export function apiPayloadError(
  payload: ApiClientPayload<unknown>,
  fallbackMessage: string,
) {
  return typeof payload.error === "string"
    ? payload.error
    : payload.error?.message || fallbackMessage;
}
