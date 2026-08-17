export interface PublicCatalogCategory { id: string; name: string }
export interface PublicCatalogItem {
  id: string;
  categoryId?: string;
  categoryName?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  currency: string;
  variants: Array<{ id: string; name: string; priceDelta: number }>;
  isFeatured: boolean;
}
export interface PublicCatalogPage { categories: PublicCatalogCategory[]; items: PublicCatalogItem[]; pageInfo: { nextCursor: string | null; hasMore: boolean; total: number; limit: number } }
