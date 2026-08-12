"use client";

import Image from "next/image";
import { useState } from "react";
import { X } from "lucide-react";

export function GalleryLightbox({ images }: { images: Array<{ url: string; alt: string }> }) {
  const [active, setActive] = useState<number>();
  return <><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{images.map((image, index) => <button data-presence-media type="button" key={image.url} onClick={() => setActive(index)} className="relative aspect-[4/3] overflow-hidden bg-black/5"><Image src={image.url} alt={image.alt} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover transition duration-500 hover:scale-105" /></button>)}</div>{active !== undefined ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/90 p-5"><button type="button" onClick={() => setActive(undefined)} aria-label="Fechar galeria" className="absolute right-5 top-5 grid size-11 place-items-center rounded-full bg-white text-black"><X /></button><div className="relative h-[80dvh] w-full max-w-6xl"><Image src={images[active].url} alt={images[active].alt} fill sizes="100vw" className="object-contain" /></div></div> : null}</>;
}
