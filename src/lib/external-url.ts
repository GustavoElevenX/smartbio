const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeExternalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function safeExternalUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = normalizeExternalUrl(value);
  if (!normalized || normalized.length > 2048) return undefined;
  try {
    const parsed = new URL(normalized);
    if (!HTTP_PROTOCOLS.has(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

export function isExternalUrl(value: unknown) {
  return Boolean(safeExternalUrl(value));
}
