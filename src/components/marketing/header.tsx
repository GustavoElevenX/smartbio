import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/ui/brand";

export function MarketingHeader() {
  return <header className="fixed inset-x-0 top-0 z-50 border-b border-black/[.055] bg-[#f7f7fa]/85 backdrop-blur-xl">
    <div className="container-shell flex h-[72px] items-center justify-between">
      <Brand />
      <nav className="hidden items-center gap-7 text-sm font-medium text-[#5d5d68] md:flex" aria-label="Principal">
        <Link href="/#como-funciona" className="hover:text-[#17171c]">Como funciona</Link>
        <Link href="/#exemplos" className="hover:text-[#17171c]">Exemplos</Link>
        <Link href="/pricing" className="hover:text-[#17171c]">Planos</Link>
      </nav>
      <div className="flex items-center gap-2">
        <Link href="/login" className="focus-ring hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#555560] hover:bg-white sm:inline-flex">Entrar</Link>
        <Link href="/register" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#17171c] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(23,23,28,.16)] transition hover:bg-[#2b2b31]">Começar grátis <ArrowRight size={16} /></Link>
      </div>
    </div>
  </header>;
}

export function MarketingFooter() {
  return <footer className="border-t border-[#e4e3eb] bg-white py-10">
    <div className="container-shell flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <Brand />
      <p className="text-sm text-[#777781]">© 2026 SmartBio. O próximo passo começa aqui.</p>
      <div className="flex gap-5 text-sm font-medium text-[#5e5e68]"><Link href="/pricing">Planos</Link><Link href="/login">Entrar</Link></div>
    </div>
  </footer>;
}
