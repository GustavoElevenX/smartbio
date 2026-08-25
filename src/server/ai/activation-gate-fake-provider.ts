import "server-only";

import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import type { DiscoveryPlanDraft } from "@/features/qualification/discovery-plan";
import type { OfferIntelligenceDraft } from "@/features/qualification/offer-intelligence";
import type { BusinessAnalysisInput, DiscoveryPlanningInput, VirouAIProvider } from "@/server/ai/ai-provider";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function contextualProfile(name: string, allNames: string[], description: string): OfferIntelligenceDraft {
  const lower = normalize(name);
  const competitors = allNames.filter((candidate) => normalize(candidate) !== lower);
  const isBlackout = lower.includes("blackout");
  const isRomana = lower.includes("romana");
  const isDouble = lower.includes("double") || lower.includes("double vision");
  const clues = isBlackout
    ? ["precisa bloquear a entrada de luz", "busca mais privacidade no ambiente"]
    : isRomana
      ? ["prefere tecido com dobras marcadas", "valoriza acabamento decorativo acolhedor"]
      : isDouble
        ? ["quer alternar transparência e privacidade", "prefere controle de luz em faixas"]
        : [`menciona características específicas de ${name}`, "descreve o efeito desejado no ambiente"];
  return {
    version: 1,
    offerName: name,
    safeDescription: `${name} é uma opção real da ${description.includes("Casa Clara") ? "Casa Clara Persianas" : "empresa"}; a adequação depende das necessidades descritas e da confirmação da equipe.`,
    subjectLabel: "ambiente",
    compatibleNeeds: clues,
    relatedGoals: [`Comparar ${name} com as demais opções reais para o ambiente informado.`],
    strongSignalGroups: [{ clues, minimumMatches: 2, rationale: "Os dois sinais aparecem juntos e diferenciam esta opção das alternativas confirmadas." }],
    supportingSignals: [...clues, name],
    ambiguitySignals: ["quero uma persiana bonita", "preciso melhorar o ambiente"],
    exclusions: ["Não afirmar adequação sem medidas e confirmação da equipe."],
    discriminatingQuestions: [{
      question: isBlackout
        ? "Quanto bloquear a entrada de luz e aumentar a privacidade pesa na sua decisão?"
        : isRomana
          ? "Você prefere um acabamento de tecido com dobras mais decorativas?"
          : "Você precisa alternar transparência e privacidade ao longo do dia?",
      purpose: "signal",
      separatesFromOfferNames: competitors,
    }],
    explanationData: [`A comparação considera sinais observáveis do ambiente e as diferenças entre ${name} e ${competitors.join(", ")}.`],
    fallbackEligible: false,
  };
}

export class ActivationGateFakeProvider implements VirouAIProvider {
  async analyzeBusiness(input: BusinessAnalysisInput) {
    return {
      profile: new RuleBasedBusinessAnalyzer().analyze(input.input),
      confirmedFacts: [],
      inferences: [],
      missingInformation: [],
      inconsistencies: [],
      requirements: [],
    };
  }

  async generateMissingQuestions() { return []; }

  async composeDiscoveryPlan(input: DiscoveryPlanningInput): Promise<DiscoveryPlanDraft> {
    return {
      offerIntelligenceProfiles: input.offeringNames.map((name) => contextualProfile(name, input.offeringNames, `${input.businessName} ${input.businessDescription}`)),
      questions: [
        { id: "casa-clara-light", question: "Como você quer controlar a entrada de luz ao longo do dia?", type: "textarea", purpose: "need", required: true },
        { id: "casa-clara-privacy", question: "Em quais momentos a privacidade é mais importante nesse ambiente?", type: "textarea", purpose: "context", required: true },
        { id: "casa-clara-style", question: "Que tipo de acabamento você imagina para combinar com o ambiente?", type: "textarea", purpose: "signal", required: true },
      ],
      fallbackStrategy: { kind: "team_handoff", explanation: "Se os sinais não diferenciarem as opções, encaminhar respostas e medidas para confirmação da equipe." },
    };
  }

  async composeJourney(): Promise<never> { throw new Error("Activation gate usa composição determinística ao redor do DiscoveryPlan."); }
  async composePresence(): Promise<never> { throw new Error("Não usado pelo activation gate."); }
  async composeSiteStructure(): Promise<never> { throw new Error("Não usado pelo activation gate."); }
  async explainOptimization(): Promise<never> { throw new Error("Não usado pelo activation gate."); }
  async composeActivation(): Promise<never> { throw new Error("Não usado pelo activation gate."); }
  async generateCopy(): Promise<never> { throw new Error("Não usado pelo activation gate."); }
  async extractSource(): Promise<never> { throw new Error("Não usado pelo activation gate."); }
}
