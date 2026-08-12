import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import type { Project } from "@/types";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [{ url: base, changeFrequency: "weekly", priority: 1 }];
  const database = createServiceClient();
  if (!database) return [{ url: base, changeFrequency: "weekly", priority: 1 }];
  const { data } = await database.from("projects").select("slug,settings,updated_at").eq("status", "published");
  const pages = (data || []).flatMap((row) => {
    const settings = row.settings && typeof row.settings === "object" ? row.settings as Record<string, unknown> : {};
    const project = settings.publishedPayload as Project | undefined;
    return (project?.presence?.pages || []).filter((page) => page.isActive && page.isIndexable).map((page) => ({ url: page.isHome ? `${base}/${row.slug}` : `${base}/${row.slug}/p/${page.key}`, lastModified: page.updatedAt || String(row.updated_at), changeFrequency: page.type === "landing" ? "monthly" as const : "weekly" as const, priority: page.isHome ? .9 : .7 }));
  });
  return [{ url: base, changeFrequency: "weekly", priority: 1 }, ...pages];
}
