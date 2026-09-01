import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  FileText,
  MapPin,
  Menu,
  MessageCircle,
  ShoppingBag,
} from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { SOBE_BRAND_PROMISE, SOBE_PRO, SOBE_TRIAL } from "@/lib/sobe-pro";
import { JourneySimulation } from "./journey-simulation";
import { MarketingAnalytics } from "./marketing-analytics";
import styles from "./virou-landing.module.css";

const capabilities = [
  { icon: ShoppingBag, label: "Pedidos", detail: "Da escolha ao pedido organizado." },
  { icon: FileText, label: "Orçamentos", detail: "A necessidade chega com contexto." },
  { icon: CalendarDays, label: "Agendamentos", detail: "Serviço, data e próximo passo." },
  { icon: MessageCircle, label: "Atendimento", detail: "A conversa começa mais preparada." },
  { icon: MapPin, label: "Unidades", detail: "Cada pessoa encontra o lugar certo." },
  { icon: BarChart3, label: "Jornada", detail: "Você acompanha avanços e abandonos." },
] as const;

const faqs = [
  [
    "É apenas uma página com links?",
    "Não. A SOBE organiza uma jornada: entende o que a pessoa procura e mostra o próximo passo adequado para chegar a uma ação.",
  ],
  [
    "Preciso trocar as ferramentas que já uso?",
    "Não. A jornada pode encaminhar para os canais que já fazem parte da sua operação, como WhatsApp, agenda, site ou atendimento humano.",
  ],
  [
    "Serve para negócios de qualquer tamanho?",
    "Sim. O roteiro se adapta à forma como cada negócio vende, desde uma conversão rápida até um atendimento que exige mais contexto.",
  ],
  [
    "Preciso saber programar?",
    "Não. Você descreve o negócio, escolhe a ação que deseja gerar e a SOBE organiza o primeiro roteiro para você ajustar.",
  ],
] as const;

function Header() {
  return (
    <header className={styles.header}>
      <Link className={styles.brandLink} href="/" aria-label="SOBE — página inicial">
        <Brand tone="light" preload asLink={false} />
      </Link>
      <nav className={styles.desktopNav} aria-label="Navegação principal">
        <a href="#como-funciona">Como funciona</a>
        <a href="#possibilidades">Possibilidades</a>
        <a href="#preco">Preço</a>
        <a href="#duvidas">Dúvidas</a>
      </nav>
      <Link className={styles.headerCta} href="/register?next=/app/onboarding" data-track="header_register">
        Começar 7 dias grátis <ArrowRight aria-hidden="true" />
      </Link>
      <details className={styles.mobileMenu}>
        <summary aria-label="Abrir menu"><Menu aria-hidden="true" /></summary>
        <nav aria-label="Navegação mobile">
          <a href="#como-funciona">Como funciona</a>
          <a href="#possibilidades">Possibilidades</a>
          <a href="#preco">Preço</a>
          <a href="#duvidas">Dúvidas</a>
          <Link href="/register?next=/app/onboarding" data-track="header_register">Começar 7 dias grátis</Link>
        </nav>
      </details>
    </header>
  );
}

function Hero() {
  return (
    <section className={styles.hero}>
      <Header />
      <div className={styles.heroArtwork} aria-hidden="true">
        <Image
          src="/visuals/attention-gate.png"
          alt=""
          fill
          sizes="(max-width: 760px) 150vw, 72vw"
          preload
        />
      </div>
      <div className={styles.heroShade} aria-hidden="true" />
      <div className={styles.heroContent}>
        <h1>Transforme<br />atração em <span>ação.</span></h1>
        <p>
          A SOBE transforma a atenção que sua empresa gera nas redes em uma estrutura digital preparada para levar cada cliente à próxima ação.
        </p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryButton} href="/register?next=/app/onboarding" data-track="hero_create_sobe">
            Começar 7 dias grátis <ArrowRight aria-hidden="true" />
          </Link>
          <a className={styles.textButton} href="#como-funciona" data-track="hero_see_how_it_works">
            Ver como funciona <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className={styles.heroRoute} aria-label="Da atração à ação">
        <div><span>Atração</span><small>A pessoa chega pelas suas redes.</small></div>
        <i aria-hidden="true" />
        <div><span>Intenção</span><small>A SOBE entende o que ela procura.</small></div>
        <i aria-hidden="true" />
        <div className={styles.routeAction}><span>Ação</span><small>O próximo passo fica claro.</small></div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className={styles.problem}>
      <div className={styles.sectionHeading}>
        <h2>Sua presença digital não precisa ser uma lista de saídas.</h2>
        <p>Quando cada destino compete pela atenção, a decisão fica por conta do visitante. A SOBE organiza a escolha e conduz o movimento.</p>
      </div>
      <div className={styles.problemStage}>
        <div className={styles.scattered} aria-label="Atenção dispersa">
          <svg className={styles.scatterRoutes} viewBox="0 0 560 430" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="attention-route-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#02E5CD" stopOpacity="0.18" />
                <stop offset="0.38" stopColor="#01D2DF" stopOpacity="0.62" />
                <stop offset="0.72" stopColor="#0186FC" stopOpacity="0.82" />
                <stop offset="1" stopColor="#0054FC" stopOpacity="0.96" />
              </linearGradient>
            </defs>
            <g className={styles.desktopScatterRoutes}>
              <path d="M146 121 C234 118 330 163 560 215" />
              <path d="M414 106 C466 126 505 176 560 215" />
              <path d="M112 224 C224 228 348 205 560 215" />
              <path d="M401 207 C463 205 508 211 560 215" />
              <path d="M171 337 C284 328 396 263 560 215" />
              <path d="M447 335 C491 302 529 253 560 215" />
              <circle className={styles.scatterJunction} cx="485" cy="226" r="3" />
              <circle className={styles.scatterConvergence} cx="553" cy="215" r="5" />
            </g>
            <g className={styles.mobileScatterRoutes}>
              <path d="M108 121 C184 132 236 274 280 430" />
              <path d="M446 111 C378 132 328 276 280 430" />
              <path d="M92 224 C166 232 226 318 280 430" />
              <path d="M432 208 C374 220 326 320 280 430" />
              <path d="M126 348 C188 354 238 390 280 430" />
              <path d="M448 341 C382 350 330 392 280 430" />
              <circle className={styles.scatterJunction} cx="280" cy="390" r="3" />
              <circle className={styles.scatterConvergence} cx="280" cy="424" r="5" />
            </g>
          </svg>
          <span className={`${styles.scatterTag} ${styles.scatterCatalog}`}><i aria-hidden="true" />Catálogo</span>
          <span className={`${styles.scatterTag} ${styles.scatterWhatsapp}`}><i aria-hidden="true" />WhatsApp</span>
          <span className={`${styles.scatterTag} ${styles.scatterServices}`}><i aria-hidden="true" />Serviços</span>
          <span className={`${styles.scatterTag} ${styles.scatterAgenda}`}><i aria-hidden="true" />Agenda</span>
          <span className={`${styles.scatterTag} ${styles.scatterLocation}`}><i aria-hidden="true" />Localização</span>
          <span className={`${styles.scatterTag} ${styles.scatterBudget}`}><i aria-hidden="true" />Orçamento</span>
        </div>
        <div className={styles.aperture} aria-hidden="true"><i /><i /><i /></div>
        <div className={styles.focused}>
          <small>Próximo passo</small>
          <strong>Uma ação adequada para cada intenção.</strong>
          <span><Check aria-hidden="true" /> Decisão guiada</span>
        </div>
      </div>
    </section>
  );
}

function Mechanism() {
  return (
    <section className={styles.mechanism} id="como-funciona">
      <div className={styles.mechanismIntro}>
        <h2>Uma arquitetura para conduzir decisões.</h2>
        <p>A SOBE corta o ruído, organiza o contexto e revela a ação que faz sentido para o visitante e para o negócio.</p>
      </div>
      <div className={styles.mechanismBody}>
        <ol className={styles.steps}>
          <li>
            <span>01</span>
            <div><strong>Entende a intenção</strong><p>A pessoa escolhe o que procura em vez de decifrar uma lista de destinos.</p></div>
          </li>
          <li>
            <span>02</span>
            <div><strong>Organiza o caminho</strong><p>A jornada apresenta somente as informações necessárias para avançar.</p></div>
          </li>
          <li>
            <span>03</span>
            <div><strong>Entrega a ação</strong><p>O visitante chega ao canal certo com mais clareza e contexto.</p></div>
          </li>
        </ol>
        <div className={styles.routeCanvas} aria-label="Fluxo funcional da SOBE">
          <JourneySimulation />
        </div>
      </div>
    </section>
  );
}

function Possibilities() {
  return (
    <section className={styles.possibilities} id="possibilidades">
      <div className={styles.sectionHeading}>
        <h2>A jornada se adapta à forma como você vende.</h2>
        <p>Qualificação entra apenas quando ajuda. Conversão rápida continua rápida. Cada roteiro respeita a operação que já existe.</p>
      </div>
      <div className={styles.capabilityRail}>
        {capabilities.map(({ icon: Icon, label, detail }) => (
          <article key={label}>
            <Icon aria-hidden="true" />
            <strong>{label}</strong>
            <p>{detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function BuildRoute() {
  return (
    <section className={styles.buildRoute}>
      <div>
        <h2>Seu primeiro roteiro começa com três decisões.</h2>
        <p>Envie sua logo, conte como o negócio funciona e deixe a SOBE preparar a primeira estrutura com a identidade da sua marca.</p>
        <Link className={styles.primaryButton} href="/register?next=/app/onboarding" data-track="build_create_sobe">
          Começar 7 dias grátis <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <ol>
        <li><span>1</span><strong>Como você vende</strong><p>Conte o que oferece e para quem.</p></li>
        <li><span>2</span><strong>Qual ação importa</strong><p>Defina o resultado que sua presença deve gerar.</p></li>
        <li><span>3</span><strong>Como a pessoa avança</strong><p>Revise o caminho até o próximo passo.</p></li>
      </ol>
    </section>
  );
}

const pricingBenefits = [
  "Até 5 páginas publicadas",
  "Jornadas, formulários e oportunidades",
  "Orçamentos, agendamentos e multiunidades",
  "Analytics e 50 ações com IA por mês",
  "Identidade visual criada a partir da sua logo",
  "Até 3 membros e nenhuma marca SOBE nas páginas",
] as const;

function Pricing() {
  return (
    <section className={styles.pricing} id="preco">
      <div className={styles.pricingIntro}>
        <h2>Um plano. Tudo que você precisa para começar.</h2>
        <p>Pare de montar sua presença digital juntando uma ferramenta diferente para cada necessidade.</p>
      </div>
      <article className={styles.pricingOffer}>
        <div className={styles.pricingSummary}>
          <h3>{SOBE_PRO.name}</h3>
          <div><strong>{SOBE_PRO.formattedPrice}</strong><span>/mês</span></div>
          <p>{SOBE_PRO.launchLabel}</p>
          <small>1 negócio · 5 páginas · 3 membros · 50 ações com IA/mês</small>
          <Link className={styles.pricingButton} href="/register?next=/app/onboarding" data-track="pricing_create_sobe">
            Começar {SOBE_TRIAL.days} dias grátis <ArrowRight aria-hidden="true" />
          </Link>
          <em>Não precisa de cartão de crédito.</em>
        </div>
        <ul>
          {pricingBenefits.map((benefit) => <li key={benefit}><Check aria-hidden="true" />{benefit}</li>)}
        </ul>
      </article>
      <div className={styles.brandPromise}>
        <h3>{SOBE_BRAND_PROMISE}</h3>
        <p>Envie sua logo, conte um pouco sobre o seu negócio e deixe a SOBE transformar essas informações em uma estrutura pronta para levar quem chega das suas redes sociais para a próxima ação.</p>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className={styles.faq} id="duvidas">
      <h2>O que você precisa saber.</h2>
      <div>
        {faqs.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}<span aria-hidden="true">+</span></summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={styles.finalCta}>
      <div className={styles.finalPortal} aria-hidden="true"><i /><i /></div>
      <div>
        <h2>A atenção já chegou.<br />Agora faça ela <span>avançar.</span></h2>
        <p>Transforme a atenção das suas redes em uma estrutura clara até a próxima ação.</p>
        <Link className={styles.primaryButton} href="/register?next=/app/onboarding" data-track="final_create_sobe">
          Começar 7 dias grátis <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export function SobeLanding() {
  return (
    <main className={styles.page}>
      <MarketingAnalytics />
      <Hero />
      <Problem />
      <Mechanism />
      <Possibilities />
      <BuildRoute />
      <Pricing />
      <Faq />
      <FinalCta />
      <footer className={styles.footer}>
        <Brand tone="light" asLink={false} />
        <div className={styles.footerLegal}>
          <p>© 2026 SOBE. Da atenção à próxima ação.</p>
          <nav aria-label="Links legais">
            <Link href="/terms">Termos</Link>
            <Link href="/privacy">Privacidade</Link>
          </nav>
        </div>
        <Link href="/register?next=/app/onboarding" data-track="footer_register">Começar grátis <ArrowRight aria-hidden="true" /></Link>
      </footer>
    </main>
  );
}
