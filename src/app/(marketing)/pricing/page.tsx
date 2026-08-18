import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/header";
import { MarketingAnalytics } from "@/components/marketing/marketing-analytics";
import { SOBE_BRAND_PROMISE, SOBE_POSITIONING, SOBE_PRO, SOBE_TRIAL } from "@/lib/sobe-pro";

export const metadata: Metadata = {
  title: "SOBE Pro — preço",
  description: `${SOBE_PRO.formattedPrice}/mês. Teste por ${SOBE_TRIAL.days} dias sem cartão.`,
};

const benefits = [
  "Até 5 páginas publicadas",
  "Jornadas focadas em conversão",
  "Formulários e captação de oportunidades",
  "Orçamentos e agendamentos",
  "Catálogo, direcionamentos e multiunidades",
  "Analytics para entender o que acontece depois do clique",
  "Até 50 ações com IA por mês",
  "Identidade visual criada a partir da sua marca",
  "Extração automática das cores da sua logo",
  "Até 3 membros na equipe",
  "Sem a marca SOBE nas suas páginas",
] as const;

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <MarketingAnalytics pageViewEvent="pricing_viewed" />
      <MarketingHeader />
      <section className="overflow-hidden pb-24 pt-36 sm:pb-32 sm:pt-44">
        <div className="container-shell">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-5xl font-extrabold tracking-[-.04em] text-[#07172f] sm:text-6xl">
              Um plano. Tudo que você precisa para começar.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#536178]">
              Pare de montar sua presença digital juntando uma ferramenta diferente para cada necessidade.
            </p>
          </div>

          <article className="relative mx-auto mt-14 max-w-[760px] overflow-hidden rounded-2xl bg-[#07172f] text-white shadow-[0_30px_80px_rgba(7,23,47,.24)]">
            <div className="sobe-gradient-rule absolute inset-x-0 top-0" />
            <div className="grid gap-10 p-7 sm:p-10 lg:grid-cols-[.8fr_1.2fr] lg:p-12">
              <div>
                <h2 className="text-2xl font-extrabold">{SOBE_PRO.name}</h2>
                <div className="mt-7 flex items-end gap-2">
                  <strong className="text-5xl tracking-[-.04em] tabular-nums">{SOBE_PRO.formattedPrice}</strong>
                  <span className="pb-1 text-white/65">/mês</span>
                </div>
                <p className="mt-3 text-sm font-bold text-[#02e5cd]">{SOBE_PRO.launchLabel}</p>
                <p className="mt-6 text-sm leading-6 text-white/70">1 negócio · 5 páginas · 3 membros · 50 ações com IA/mês</p>
                <Link href="/register?next=/app/onboarding" data-track="pricing_create_sobe" className="focus-ring mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 font-bold text-[#07172f] transition hover:bg-[#e9fffc]">
                  Começar {SOBE_TRIAL.days} dias grátis <ArrowRight size={17} />
                </Link>
                <p className="mt-3 text-center text-xs text-white/60">Não precisa de cartão de crédito.</p>
              </div>
              <ul className="grid content-start gap-3">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-3 text-sm leading-6 text-white/85">
                    <Check className="mt-1 size-4 shrink-0 text-[#02e5cd]" aria-hidden="true" />{benefit}
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <div className="mx-auto mt-20 max-w-4xl border-y border-[#cbd3dc] py-14 text-center sm:py-20">
            <h2 className="text-balance text-4xl font-extrabold tracking-[-.035em] text-[#07172f] sm:text-6xl">{SOBE_BRAND_PROMISE}</h2>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-[#536178]">
              Envie sua logo, conte um pouco sobre o seu negócio e deixe a SOBE transformar essas informações em uma estrutura pronta para levar quem chega das suas redes sociais para a próxima ação.
            </p>
          </div>
          <p className="mx-auto mt-14 max-w-3xl text-center text-lg leading-8 text-[#405064]">
            {SOBE_POSITIONING} O link da bio é um ponto de entrada para essa estrutura — não o produto inteiro.
          </p>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
