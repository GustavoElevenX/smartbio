import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";

const MAX_LIMIT = 48;

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  if (!features.nativeCatalogOrders) return apiError("Catálogo nativo desativado.", 404, "feature_disabled");
  const { projectId } = await params;
  const project = await getPublicProjectById(createServiceClient(), projectId);
  if (!project) return apiError("Catálogo não encontrado.", 404, "catalog_not_found");
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLocaleLowerCase("pt-BR").slice(0, 120);
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "24", 10) || 24));
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("cursor") || "0", 10) || 0);
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
