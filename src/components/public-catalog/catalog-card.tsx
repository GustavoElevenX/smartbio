import Image from "next/image";
import type { PublicCatalogItem } from "./catalog.types";

const money = (value: number | undefined, currency: string) => value == null ? "Sob consulta" : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

export function CatalogCard({ item, onOpen, onChoose }: { item: PublicCatalogItem; onOpen(): void; onChoose(): void }) {
  return <article className="group overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><button type="button" onClick={onOpen} className="block w-full text-left"><div className="relative aspect-square overflow-hidden bg-black/[.04]">{item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill unoptimized sizes="(max-width: 700px) 50vw, 25vw" className="object-cover transition duration-300 group-hover:scale-[1.03]" /> : <span className="grid h-full place-items-center text-sm text-black/45">Sem imagem</span>}</div><div className="p-4 pb-2">{item.categoryName ? <p className="text-xs font-bold text-black/50">{item.categoryName}</p> : null}<h3 className="mt-1 line-clamp-2 font-black">{item.name}</h3><p className="mt-2 font-extrabold text-[var(--presence-primary)]">{money(item.price, item.currency)}</p></div></button><div className="p-4 pt-2"><button type="button" onClick={onChoose} className="min-h-11 w-full rounded-2xl bg-[var(--presence-primary)] px-4 text-sm font-extrabold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--presence-primary)]/25">Escolher</button></div></article>;
}
