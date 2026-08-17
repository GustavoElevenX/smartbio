import { CatalogCard } from "./catalog-card";
import type { PublicCatalogItem } from "./catalog.types";

export function CatalogGrid({ items, onOpen, onChoose }: { items: PublicCatalogItem[]; onOpen(item: PublicCatalogItem): void; onChoose(item: PublicCatalogItem): void }) {
  return <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{items.map((item) => <CatalogCard key={item.id} item={item} onOpen={() => onOpen(item)} onChoose={() => onChoose(item)} />)}</div>;
}
