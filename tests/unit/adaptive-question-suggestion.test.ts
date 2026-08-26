import { describe, expect, it } from "vitest";

import type { SetupQuestion } from "@/features/ai-setup/ai-setup.schema";
import { adaptiveQuestionSuggestion } from "@/features/ai-setup/adaptive-question-suggestion";
import { extractExplicitOfferNames } from "@/features/qualification/offer-context";

describe("sugestão estruturada da pergunta adaptativa", () => {
  it("deriva o texto visível e a submissão do mesmo DiscoveryPlan", () => {
    const structuredAnswer: NonNullable<SetupQuestion["structuredAnswer"]> = [
      { id: "light", question: "Como você quer controlar a entrada de luz ao longo do dia?", type: "textarea", purpose: "need", required: true },
      { id: "privacy", question: "Em quais momentos a privacidade é mais importante nesse ambiente?", type: "textarea", purpose: "context", required: true },
      { id: "style", question: "Que tipo de acabamento você imagina para combinar com o ambiente?", type: "textarea", purpose: "signal", required: true },
    ];
    const question: SetupQuestion = {
      id: "qualification-questions",
      key: "qualification.questions",
      title: "Perguntas iniciais sugeridas pela Sobe",
      type: "textarea",
      required: true,
      reason: "Confirme as perguntas.",
      priority: 100,
      suggestedAnswer: "Uma proposta determinística antiga que não pode aparecer.",
      structuredAnswer,
    };

    const suggestion = adaptiveQuestionSuggestion(question)!;
    expect(suggestion.structured).toBe(true);
    expect(suggestion.visibleLines).toEqual(structuredAnswer.map((item) => item.question));
    expect((suggestion.submission as typeof structuredAnswer).map((item) => item.question)).toEqual(suggestion.visibleLines);
    expect(suggestion.displayText).not.toContain("determinística antiga");
  });
});

describe("ofertas explícitas da Activation autônoma", () => {
  it("extrai a lista separada por vírgulas e 'e' sem incorporar a instrução seguinte", () => {
    const description = "A Casa Clara vende persianas e ajuda clientes que não sabem qual modelo escolher. Serviços: Persiana Rolô Blackout, Persiana Romana e Persiana Double Vision. O visitante deve explicar necessidade de luz, privacidade e estilo, receber uma orientação e depois continuar pelo WhatsApp.";
    expect(extractExplicitOfferNames(description)).toEqual([
      "Persiana Rolô Blackout",
      "Persiana Romana",
      "Persiana Double Vision",
    ]);
  });

  it("extrai produtos inline e encerra a lista antes do objetivo do negócio", () => {
    const description = "A Lumina Persianas atende ambientes residenciais e comerciais. Nossos produtos são: Persiana Rolô Blackout, Persiana Double Vision, Persiana Romana, Persiana Vertical e Cortina Rolô Tela Solar. Queremos que o visitante receba orientação e continue pelo WhatsApp.";
    expect(extractExplicitOfferNames(description)).toEqual([
      "Persiana Rolô Blackout",
      "Persiana Double Vision",
      "Persiana Romana",
      "Persiana Vertical",
      "Cortina Rolô Tela Solar",
    ]);
  });
});
