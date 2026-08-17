import type { PublicCatalogCategory } from "./catalog.types";

export function CatalogCategoryFilter({ categories, value, onChange }: { categories: PublicCatalogCategory[]; value: string; onChange(value: string): void }) {
  return <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por categoria"><button type="button" aria-pressed={!value} onClick={() => onChange("")} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold ${!value ? "border-[var(--presence-primary)] bg-[var(--presence-primary)] text-white" : "border-black/10 bg-white"}`}>Todos</button>{categories.map((category) => <button key={category.id} type="button" aria-pressed={value === category.id} onClick={() => onChange(category.id)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold ${value === category.id ? "border-[var(--presence-primary)] bg-[var(--presence-primary)] text-white" : "border-black/10 bg-white"}`}>{category.name}</button>)}</div>;
}
