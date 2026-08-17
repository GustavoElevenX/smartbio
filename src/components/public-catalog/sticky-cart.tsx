import { ShoppingBag } from "lucide-react";

export function StickyCart({ count, onOpen }: { count: number; onOpen(): void }) { return count ? <button type="button" onClick={onOpen} className="fixed bottom-5 right-5 z-40 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#151820] px-5 font-extrabold text-white shadow-2xl"><ShoppingBag aria-hidden size={19} />Seleção <span className="grid size-7 place-items-center rounded-full bg-white text-xs text-black">{count}</span></button> : null; }
