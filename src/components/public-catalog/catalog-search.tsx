import { Search } from "lucide-react";

export function CatalogSearch({ value, onChange }: { value: string; onChange(value: string): void }) {
  return <label className="relative block flex-1"><span className="sr-only">Buscar no catálogo</span><Search aria-hidden className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-black/45" /><input value={value} onChange={(event) => onChange(event.target.value)} type="search" placeholder="Buscar por nome, categoria ou descrição" className="min-h-12 w-full rounded-2xl border border-black/10 bg-white pl-12 pr-4 text-sm outline-none transition focus:border-[var(--presence-primary)] focus:ring-4 focus:ring-[var(--presence-primary)]/10" /></label>;
}
