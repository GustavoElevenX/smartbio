"use client";

import Image from "next/image";
import { useState } from "react";
import { X } from "lucide-react";

export function GalleryLightbox({ images, layout = "grid", columns = 3 }: { images: Array<{ url: string; alt: string }>; layout?: "grid" | "masonry" | "carousel"; columns?: 2 | 3 | 4 }) {
  const [active, setActive] = useState<number>();
  const layoutClass = layout === "carousel" ? "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3" : layout === "masonry" ? "columns-2 gap-3 md:columns-3" : `grid grid-cols-2 gap-3 ${columns === 2 ? "md:grid-cols-2" : columns === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`;
  return <><div className={layoutClass}>{images.map((image, index) => <button data-presence-media type="button" key={image.url} onClick={() => setActive(index)} className={`relative overflow-hidden bg-black/5 ${layout === "carousel" ? "aspect-[4/3] w-[82%] shrink-0 snap-center md:w-[42%]" : layout === "masonry" ? `mb-3 block w-full ${index % 3 === 1 ? "aspect-[3/4]" : "aspect-[4/3]"}` : "aspect-[4/3]"}`}><Image src={image.url} alt={image.alt} fill sizes="(max-width: 768px) 82vw, 33vw" className="object-cover transition duration-500 hover:scale-105" /></button>)}</div>{active !== undefined ? <div role="dialog" aria-modal="true" aria-label="Imagem ampliada" className="fixed inset-0 z-[70] grid place-items-center bg-black/90 p-5"><button type="button" onClick={() => setActive(undefined)} aria-label="Fechar galeria" className="absolute right-5 top-5 grid size-11 place-items-center rounded-full bg-white text-black"><X /></button><div className="relative h-[80dvh] w-full max-w-6xl"><Image src={images[active].url} alt={images[active].alt} fill sizes="100vw" className="object-contain" /></div></div> : null}</>;
}
