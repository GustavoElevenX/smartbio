"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  FileText,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import styles from "./virou-landing.module.css";

const intents = [
  {
    label: "Pedir orçamento",
    description: "Conte o que precisa para solicitar uma avaliação.",
    icon: FileText,
    stepTitle: "O que precisa ser avaliado?",
    context: ["Serviço", "Prazo", "Contato"],
    resultTitle: "Solicitação pronta para enviar.",
    resultDetail: "Necessidade e contexto seguem organizados.",
  },
  {
    label: "Escolher um horário",
    description: "Consulte os horários configurados pelo negócio.",
    icon: CalendarDays,
    stepTitle: "Qual horário funciona melhor?",
    context: ["Serviço", "Data", "Horário"],
    resultTitle: "Agendamento pronto para confirmar.",
    resultDetail: "Serviço e disponibilidade chegam no mesmo fluxo.",
  },
  {
    label: "Ver produtos",
    description: "Explore o catálogo e avance até o pedido.",
    icon: ShoppingBag,
    stepTitle: "Como deseja continuar?",
    context: ["Itens", "Quantidade", "Entrega"],
    resultTitle: "Pedido pronto para continuar.",
    resultDetail: "Escolha e logística permanecem conectadas.",
  },
] as const;

type Phase = 0 | 1 | 2 | 3;

const phaseDurations = [900, 650, 1450] as const;

export function JourneySimulation() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>(0);
  const [intentIndex, setIntentIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const intent = intents[intentIndex];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.42 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!inView || reduceMotion || phase === 3 || !pageVisible) return;
    const timeout = window.setTimeout(
      () => setPhase((current) => Math.min(current + 1, 3) as Phase),
      phaseDurations[phase],
    );
    return () => window.clearTimeout(timeout);
  }, [inView, pageVisible, phase, reduceMotion]);

  function chooseIntent(index: number) {
    setIntentIndex(index);
    setPhase(reduceMotion ? 2 : 1);
  }

  function advance() {
    if (phase === 3) {
      setIntentIndex((current) => (current + 1) % intents.length);
      setPhase(0);
      return;
    }
    setPhase((current) => Math.min(current + 1, 3) as Phase);
  }

  return (
    <div
      className={styles.simulation}
      ref={rootRef}
      aria-label="Simulação da jornada: intenção, contexto e ação"
    >
      <div className={styles.simulationHeader}>
        <span>Fluxo funcional</span>
        <div className={styles.simulationProgress} aria-label={`Etapa ${phase <= 1 ? 1 : phase} de 3`}>
          {[0, 1, 2].map((step) => (
            <i key={step} className={phase >= step + 1 ? styles.progressComplete : ""} />
          ))}
        </div>
      </div>

      <div className={styles.incomingSignals} data-active={phase > 0} aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>

      <div className={styles.simulationViewport}>
        <div className={styles.simulationScreen} key={`${intentIndex}-${phase}`}>
          {phase <= 1 && (
            <>
              <span className={styles.simulationStep}>Intenção</span>
              <strong className={styles.simulationTitle}>Como podemos ajudar?</strong>
              <div className={styles.intentOptions}>
                {intents.map(({ label, description, icon: Icon }, index) => (
                  <button
                    type="button"
                    key={label}
                    className={phase === 1 && index === intentIndex ? styles.selectedIntent : ""}
                    onClick={() => chooseIntent(index)}
                    aria-pressed={phase === 1 && index === intentIndex}
                  >
                    <Icon aria-hidden="true" />
                    <span><b>{label}</b><small>{description}</small></span>
                  </button>
                ))}
              </div>
            </>
          )}

          {phase === 2 && (
            <>
              <span className={styles.simulationStep}>Contexto</span>
              <strong className={styles.simulationTitle}>{intent.stepTitle}</strong>
              <div className={styles.contextRoute}>
                {intent.context.map((item, index) => (
                  <span key={item}><i>{index + 1}</i>{item}</span>
                ))}
              </div>
            </>
          )}

          {phase === 3 && (
            <div className={styles.simulationResult}>
              <span><Check aria-hidden="true" /></span>
              <div>
                <small>Pronto para o próximo passo?</small>
                <strong>{intent.resultTitle}</strong>
                <p>{intent.resultDetail}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className={styles.actionNode}
        onClick={advance}
        aria-label={phase === 3 ? "Repetir com outra intenção" : "Avançar simulação"}
      >
        {phase === 3 ? <RotateCcw aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
      </button>
    </div>
  );
}
