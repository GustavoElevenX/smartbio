import Link from "next/link";
import { BarChart3, Route, Sparkles } from "lucide-react";
import { Brand } from "@/components/ui/brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-16">
        <Brand />
        <div className="mx-auto my-auto w-full max-w-[430px] py-12">
          {children}
        </div>
        <p className="text-center text-xs text-[#6d7280]">
          Ao continuar, você concorda com os{" "}
          <Link
            href="/terms"
            className="font-medium text-[#667286] underline decoration-[#c2cad5] underline-offset-2 transition hover:text-[#0054fc] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8eb0ff]"
          >
            termos
          </Link>{" "}
          e a{" "}
          <Link
            href="/privacy"
            className="font-medium text-[#667286] underline decoration-[#c2cad5] underline-offset-2 transition hover:text-[#0054fc] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8eb0ff]"
          >
            política de privacidade
          </Link>
          .
        </p>
      </section>
      <section className="relative hidden overflow-hidden bg-[#07172f] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="sobe-gradient-rule absolute inset-x-0 top-0" />
        <div className="dot-grid absolute inset-0 text-white/[.055]" />
        <div className="sobe-gradient absolute -right-20 top-10 size-80 rounded-full opacity-30 blur-3xl" />
        <div className="absolute -bottom-32 left-10 size-96 rounded-full bg-[#02e5cd]/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-2 text-xs font-bold text-[#02e5cd]">
            <Sparkles size={14} /> A bio que entende, recomenda e vende
          </span>
          <blockquote className="mt-12 max-w-xl text-5xl font-extrabold leading-[1.04] tracking-[-.055em]">
            “Nosso link deixou de ser uma lista e virou a melhor conversa antes
            da conversa.”
          </blockquote>
        </div>
        <div className="relative grid grid-cols-2 gap-4">
          <div className="rounded-[22px] border border-white/10 bg-white/[.055] p-5">
            <Route className="text-[#02e5cd]" />
            <strong className="mt-7 block text-xl">Estrutura guiada</strong>
            <span className="mt-1 block text-sm text-white/55">da intenção ao próximo passo</span>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/[.055] p-5">
            <BarChart3 className="text-[#01d2df]" />
            <strong className="mt-7 block text-xl">Resultado observado</strong>
            <span className="mt-1 block text-sm text-white/55">com conversão confirmada</span>
          </div>
        </div>
        <Link
          href="/"
          className="relative mt-10 text-sm font-semibold text-white/55 hover:text-white"
        >
          ← Voltar ao início
        </Link>
      </section>
    </main>
  );
}
