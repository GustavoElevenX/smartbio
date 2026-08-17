import type { CatalogItem } from "@/types";

export const fortyProductCatalog: CatalogItem[] = Array.from({ length: 40 }, (_, index) => ({
  id: `product-${index + 1}`,
  projectId: "catalog-project",
  categoryId: `category-${(index % 4) + 1}`,
  name: `Produto ${String(index + 1).padStart(2, "0")}`,
  description: `Descrição pesquisável do produto ${index + 1}`,
  price: 10 + index,
  currency: "BRL",
  isAvailable: true,
  isFeatured: index < 6,
  order: index,
  variants: [],
  metadata: { tags: index % 2 ? ["leve"] : ["premium"] },
}));
