import { resolveAppUrl } from "@/lib/app-url";

export function publicProjectUrl(slug: string, baseUrl?: string) {
  const resolvedBaseUrl =
    baseUrl ||
    (typeof window !== "undefined" ? window.location.origin : resolveAppUrl());
  return new URL(`/${encodeURIComponent(slug)}`, resolvedBaseUrl).toString();
}
