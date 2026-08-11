export function publicProjectUrl(slug: string, baseUrl = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") {
  return new URL(`/${encodeURIComponent(slug)}`, baseUrl).toString();
}
