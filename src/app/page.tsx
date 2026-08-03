import Link from "next/link";
import { ArrowRight, BarChart3, Check, ChevronRight, MousePointer2, Route, Sparkles, Target, Users, WandSparkles } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/header";

const oldWay = ["Lista de botões", "Visitante decide sozinho", "Poucos dados", "Aparência padronizada"];
const smartWay = ["Entende a intenção", "Conduz uma jornada", "Recomenda o próximo passo", "Qualifica e mede"];

function MiniJourney() {
  return <div className="relative mx-auto w-full max-w-[390px] rounded-[42px] border-[7px] border-[#202026] bg-[#fffdf9] p-3 shadow-[0_50px_110px_rgba(36,26,80,.2)]">
    <div className="relative min-h-[620px] overflow-hidden rounded-[31px] bg-[#fff9f1] p-6">
      <div className="absolute -right-20 -top-16 size-52 rounded-full bg-[#ffd75b]/60 blur-2xl" />
      <div className="absolute -bottom-20 -left-16 size-56 rounded-full bg-[#ff7b66]/30 blur-3xl" />
      <div className="relative flex h-full min-h-[560px] flex-col">
        <div className="flex items-center justify-between"><span className="rounded-full bg-[#e83431] px-3 py-1.5 text-xs font-extrabold text-white">MIX</span><span className="text-xs font-bold text-[#7b5145]">1 de 4</span></div>
        <div className="mt-16"><span className="text-xs font-bold uppercase tracking-[.16em] text-[#e83431]">Seu próximo passo</span><h3 className="mt-3 text-[34px] font-extrabold leading-[1.03] tracking-[-.045em] text-[#321d17]">O que você quer fazer hoje?</h3><p className="mt-3 text-sm leading-6 text-[#785f57]">Escolha uma opção. A gente cuida do caminho.</p></div>
        <div className="mt-8 space-y-3">
          {["Pedir agora", "Ver cardápio", "Encontrar unidade"].map((item, index) => <div key={item} className={`flex items-center justify-between rounded-[20px] border p-4 ${index === 0 ? "border-[#ef8d81] bg-white shadow-[0_12px_30px_rgba(131,47,32,.1)]" : "border-[#f1d8ca] bg-white/70"}`}><span className="font-bold text-[#44271f]">{item}</span><ChevronRight size={18} className="text-[#e83431]" /></div>)}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-6 text-xs font-semibold text-[#91776e]"><Sparkles size={14} /> Feito para você</div>
      </div>
    </div>
  </div>;
}

export default function HomePage() {
  return <main className="overflow-hidden bg-[#f7f7fa]">
    <MarketingHeader />
    <section className="marketing-grid relative pb-24 pt-36 sm:pt-44">
      <div className="absolute left-[8%] top-36 size-64 rounded-full bg-[#ded9ff]/55 blur-3xl" />
      <div className="absolute right-[3%] top-56 size-72 rounded-full bg-[#ffe0d9]/45 blur-3xl" />
      <div className="container-shell relative grid items-center gap-16 lg:grid-cols-[1.08fr_.92fr]">
        <div className="max-w-[670px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dcd8ff] bg-white/80 px-3 py-2 text-xs font-bold text-[#5b4bd6] shadow-sm"><WandSparkles size={14} /> Uma nova categoria de link na bio</div>
          <h1 className="text-balance mt-7 text-[clamp(3.1rem,7vw,6.25rem)] font-extrabold leading-[.94] tracking-[-.065em] text-[#17171c]">Seu link da bio pode fazer <span className="bg-gradient-to-r from-[#6d5ef5] to-[#ee6957] bg-clip-text text-transparent">mais.</span></h1>
          <p className="text-balance mt-7 max-w-[620px] text-lg leading-8 text-[#64646f] sm:text-xl">Crie uma experiência que entende o visitante, recomenda o melhor caminho e conduz até a ação.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="focus-ring inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#17171c] px-6 font-bold text-white shadow-[0_16px_40px_rgba(23,23,28,.18)] transition hover:-translate-y-0.5">Criar minha experiência <ArrowRight size={18} /></Link>
            <Link href="/vertice" className="focus-ring inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#dcdbe3] bg-white px-6 font-bold text-[#35353c] transition hover:border-[#bdbbc8]">Ver demonstração <MousePointer2 size={18} /></Link>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-[#757580]">{["Sem cartão", "Pronto em minutos", "Personalização real"].map((item) => <span key={item} className="flex items-center gap-2"><Check size={15} className="text-[#15966c]" />{item}</span>)}</div>
        </div>
        <div className="relative"><div className="absolute inset-10 rotate-6 rounded-[60px] bg-gradient-to-br from-[#6d5ef5] to-[#ff806c] opacity-20 blur-2xl" /><MiniJourney /></div>
      </div>
    </section>

    <section className="bg-[#17171c] py-24 text-white">
      <div className="container-shell"><p className="text-sm font-bold uppercase tracking-[.18em] text-[#a99fff]">A diferença está na jornada</p><h2 className="text-balance mt-4 max-w-3xl text-4xl font-extrabold tracking-[-.045em] sm:text-5xl">Não mostre seus links. Mostre o próximo passo.</h2>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="rounded-[28px] border border-white/10 bg-white/[.045] p-7 sm:p-9"><p className="text-sm font-bold uppercase tracking-wider text-[#92929b]">Link tradicional</p><div className="mt-7 space-y-4">{oldWay.map((item) => <div key={item} className="flex items-center gap-3 text-[#b9b9bf]"><span className="size-2 rounded-full bg-[#5c5c62]" />{item}</div>)}</div></div>
          <div className="relative overflow-hidden rounded-[28px] border border-[#8579ef]/50 bg-[#24212f] p-7 sm:p-9"><div className="absolute -right-14 -top-14 size-48 rounded-full bg-[#6d5ef5]/35 blur-3xl" /><p className="relative text-sm font-bold uppercase tracking-wider text-[#aea5ff]">SmartBio</p><div className="relative mt-7 space-y-4">{smartWay.map((item) => <div key={item} className="flex items-center gap-3 font-semibold"><span className="grid size-6 place-items-center rounded-full bg-[#6d5ef5]"><Check size={14} /></span>{item}</div>)}</div></div>
        </div>
      </div>
    </section>

    <section id="como-funciona" className="py-24 sm:py-32">
      <div className="container-shell"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[.16em] text-[#6d5ef5]">Simples para criar, impossível de ignorar</p><h2 className="text-balance mt-4 text-4xl font-extrabold tracking-[-.045em] sm:text-5xl">Da descrição do seu negócio à experiência publicada.</h2></div>
        <div className="mt-14 grid gap-4 lg:grid-cols-4">{[
          ["01", "Explique seu negócio", "Conte o que vende, para quem e qual resultado procura.", Users],
          ["02", "Receba uma experiência", "A marca, os textos e a jornada são compostos para você.", WandSparkles],
          ["03", "Personalize e publique", "Ajuste tudo sem código e compartilhe seu link.", Route],
          ["04", "Acompanhe resultados", "Veja decisões, abandono, leads e conversões.", BarChart3],
        ].map(([number, title, text, Icon]) => { const IconComponent = Icon as typeof Users; return <article key={String(number)} className="group rounded-[24px] border border-[#e4e3eb] bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(35,31,65,.09)]"><div className="flex items-center justify-between"><span className="text-sm font-extrabold text-[#8a80e8]">{String(number)}</span><IconComponent size={21} className="text-[#77717f]" /></div><h3 className="mt-12 text-xl font-extrabold tracking-[-.025em]">{String(title)}</h3><p className="mt-3 text-sm leading-6 text-[#71717b]">{String(text)}</p></article>; })}</div>
      </div>
    </section>

    <section id="exemplos" className="bg-white py-24 sm:py-32">
      <div className="container-shell"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[.16em] text-[#e46250]">Composições exclusivas</p><h2 className="text-balance mt-4 text-4xl font-extrabold tracking-[-.045em] sm:text-5xl">Duas marcas. Duas experiências realmente diferentes.</h2></div><p className="max-w-sm text-sm leading-6 text-[#6e6e78]">Os componentes são reutilizáveis. A direção visual, a hierarquia e a jornada pertencem a cada negócio.</p></div>
        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          <Link href="/casadesucosmix" className="group relative min-h-[430px] overflow-hidden rounded-[32px] bg-[#fff1d4] p-8 sm:p-10"><div className="absolute -right-12 -top-12 size-56 rounded-full bg-[#ffd12f]" /><div className="absolute -bottom-20 -left-16 size-64 rounded-full bg-[#ef4438]/30" /><div className="relative flex h-full flex-col"><span className="w-fit rounded-full bg-[#e62e2d] px-3 py-1.5 text-xs font-extrabold text-white">CASA DE SUCOS MIX</span><div className="mt-auto"><p className="font-bold text-[#e62e2d]">Pedidos guiados</p><h3 className="mt-2 text-4xl font-extrabold tracking-[-.045em] text-[#381c14]">Do desejo ao pedido, sem perder o frescor.</h3><span className="mt-6 inline-flex items-center gap-2 font-bold text-[#5a2a20]">Explorar experiência <ArrowRight size={18} className="transition group-hover:translate-x-1" /></span></div></div></Link>
          <Link href="/vertice" className="group relative min-h-[430px] overflow-hidden rounded-[32px] bg-[#0d0d0e] p-8 text-white sm:p-10"><div className="dot-grid absolute inset-0 text-white/[.08]" /><div className="absolute right-4 top-4 size-52 rounded-full bg-[#ff6a00]/20 blur-3xl" /><div className="relative flex h-full flex-col"><span className="w-fit border-l-2 border-[#ff6a00] pl-3 text-xs font-extrabold tracking-[.16em] text-[#ff9a52]">VÉRTICE / B2B</span><div className="mt-auto"><p className="font-bold text-[#ff7b1b]">Qualificação estratégica</p><h3 className="mt-2 text-4xl font-bold tracking-[-.045em]">Transforme intenção em demanda previsível.</h3><span className="mt-6 inline-flex items-center gap-2 font-bold">Explorar experiência <ArrowRight size={18} className="transition group-hover:translate-x-1" /></span></div></div></Link>
        </div>
      </div>
    </section>

    <section className="py-24 sm:py-32"><div className="container-shell"><div className="relative overflow-hidden rounded-[38px] bg-gradient-to-br from-[#6555eb] via-[#735eea] to-[#e46c61] px-6 py-16 text-center text-white shadow-[0_40px_100px_rgba(103,84,231,.26)] sm:px-16 sm:py-24"><div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.25),transparent_34%)]" /><Target className="relative mx-auto" size={34} /><h2 className="text-balance relative mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-[-.05em] sm:text-6xl">Pare de organizar links. Comece a conduzir decisões.</h2><p className="relative mx-auto mt-5 max-w-xl text-white/80">Sua primeira experiência fica pronta em poucos minutos.</p><Link href="/register" className="focus-ring relative mt-8 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-white px-6 font-extrabold text-[#33277d] shadow-xl transition hover:-translate-y-0.5">Criar minha experiência <ArrowRight size={18} /></Link></div></div></section>
    <MarketingFooter />
  </main>;
}
