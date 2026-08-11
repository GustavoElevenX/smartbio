import type { EntryPoint } from "@/types";
import { publicProjectUrl } from "@/lib/public-url";

export function entryPointUrl(slug: string, entry: EntryPoint, baseUrl?: string) {
  const url = new URL(publicProjectUrl(slug, baseUrl));
  url.searchParams.set("entry", entry.key);
  return url.toString();
}
