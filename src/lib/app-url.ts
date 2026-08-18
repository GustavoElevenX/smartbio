function normalizedUrl(value?: string) {
  const configured = value?.trim();
  if (!configured) return undefined;
  const withProtocol = /^https?:\/\//i.test(configured)
    ? configured
    : `https://${configured}`;
  return withProtocol.replace(/\/$/, "");
}

export function resolveAppUrl(
  source: Record<string, string | undefined> = process.env,
) {
  const configured =
    normalizedUrl(source.NEXT_PUBLIC_PUBLIC_BASE_URL) ||
    normalizedUrl(source.NEXT_PUBLIC_APP_URL);
  if (configured) return configured;

  const vercelUrl =
    normalizedUrl(source.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizedUrl(source.VERCEL_URL);
  return vercelUrl || "http://localhost:3000";
}
