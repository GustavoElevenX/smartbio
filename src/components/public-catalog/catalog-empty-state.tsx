import { PackageSearch } from "lucide-react";

export function CatalogEmptyState() { return <div className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center"><div><PackageSearch className="mx-auto size-10 text-black/35" /><h3 className="mt-4 text-lg font-black">Nenhum item encontrado</h3><p className="mt-2 text-sm text-black/55">Tente outra busca ou escolha uma categoria diferente.</p></div></div>; }
