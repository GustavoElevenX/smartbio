const DEFAULT_NEXT = "/app";

export function safeNextPath(value: string | null | undefined, fallback = DEFAULT_NEXT) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const parsed = new URL(value, "https://smartbio.local");
    if (parsed.origin !== "https://smartbio.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
