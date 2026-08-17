import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { canUseLocalStore } from "@/lib/runtime-mode";

const MAX_LIMIT = 48;

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  if (!features.nativeCatalogOrders) return apiError("Catálogo nativo desativado.", 404, "feature_disabled");
  const { projectId } = await params;
  const database = canUseLocalStore() ? null : createServiceClient();
  const project = await getPublicProjectById(database, projectId);
  if (!project) return apiError("Catálogo não encontrado.", 404, "catalog_not_found");
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLocaleLowerCase("pt-BR").slice(0, 120);
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "24", 10) || 24));
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("cursor") || "0", 10) || 0);
  if (database) {
    const { data: projectRow } = await database.from("projects").select("id").eq("id", projectId).eq("status", "published").maybeSingle();
    if (!projectRow) return apiError("Catálogo não encontrado.", 404, "catalog_not_found");
    const { data: categoryRows, error: categoryError } = await database.from("catalog_categories").select("id,name,category_order").eq("project_id", projectId).eq("is_active", true).order("category_order", { ascending: true });
    if (categoryError) return apiError("Não foi possível carregar as categorias.", 500, "catalog_query_failed");
    let itemQuery = database.from("catalog_items").select("id,category_id,name,description,image_asset_id,price,currency,variants,metadata,media_assets(alt_text,original_name,metadata)", { count: "exact" }).eq("project_id", projectId).eq("is_available", true);
    if (categoryId) itemQuery = itemQuery.eq("category_id", categoryId);
    const safeQuery = q.replace(/[,()%_]/g, " ").trim();
    if (safeQuery) itemQuery = itemQuery.or(`name.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`);
    const { data: itemRows, count, error } = await itemQuery.order("name", { ascending: true }).range(offset, offset + limit - 1);
    if (error) return apiError("Não foi possível carregar o catálogo.", 500, "catalog_query_failed");
    const categoryNames = new Map((categoryRows || []).map((category) => [category.id, category.name]));
    const items = (itemRows || []).map((item) => {
      const media = Array.isArray(item.media_assets) ? item.media_assets[0] : item.media_assets;
      const metadata = (media?.metadata || {}) as Record<string, unknown>;
      return { id: item.id, categoryId: item.category_id || undefined, categoryName: item.category_id ? categoryNames.get(item.category_id) : undefined, name: item.name, description: item.description || undefined, imageUrl: typeof metadata.publicUrl === "string" ? metadata.publicUrl : typeof metadata.signedUrl === "string" ? metadata.signedUrl : undefined, price: item.price == null ? undefined : Number(item.price), currency: item.currency, variants: (Array.isArray(item.variants) ? item.variants : []).filter((variant: { isAvailable?: boolean }) => variant.isAvailable).map((variant: { id: string; name: string; priceDelta?: number }) => ({ id: variant.id, name: variant.name, priceDelta: Number(variant.priceDelta || 0) })), isFeatured: Boolean((item.metadata as Record<string, unknown> | null)?.isFeatured) };
    });
    const total = count || 0;
    const nextOffset = offset + items.length;
    return apiSuccess({ categories: (categoryRows || []).map(({ id, name }) => ({ id, name })), items, pageInfo: { nextCursor: nextOffset < total ? String(nextOffset) : null, hasMore: nextOffset < total, total, limit } });
  }
  const categories = (project.commercialConfig?.catalogCategories || []).filter((category) => category.isActive).toSorted((a, b) => a.order - b.order);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const filtered = (project.commercialConfig?.catalogItems || [])
    .filter((item) => item.isAvailable)
    .filter((item) => !categoryId || item.categoryId === categoryId)
    .filter((item) => {
      if (!q) return true;
      const tags = Array.isArray(item.metadata.tags) ? item.metadata.tags.join(" ") : "";
      return `${item.name} ${item.description || ""} ${item.categoryId ? categoryNames.get(item.categoryId) || "" : ""} ${tags}`.toLocaleLowerCase("pt-BR").includes(q);
    })
    .toSorted((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) || (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "pt-BR") || (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER));
  const items = filtered.slice(offset, offset + limit).map((item) => ({
    id: item.id,
    categoryId: item.categoryId,
    categoryName: item.categoryId ? categoryNames.get(item.categoryId) : undefined,
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl,
    price: item.price,
    currency: item.currency,
    variants: item.variants.filter((variant) => variant.isAvailable).map((variant) => ({ id: variant.id, name: variant.name, priceDelta: variant.priceDelta })),
    isFeatured: Boolean(item.isFeatured),
  }));
  const nextOffset = offset + items.length;
  return apiSuccess({ categories: categories.map(({ id, name }) => ({ id, name })), items, pageInfo: { nextCursor: nextOffset < filtered.length ? String(nextOffset) : null, hasMore: nextOffset < filtered.length, total: filtered.length, limit } });
}
