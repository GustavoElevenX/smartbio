import "server-only";

import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import type { DiscoveryPlanDraft } from "@/features/qualification/discovery-plan";
import type { OfferIntelligenceDraft } from "@/features/qualification/offer-intelligence";
import type { ActivationUnderstandingInput, BusinessAnalysisInput, DiscoveryPlanningInput, VirouAIProvider } from "@/server/ai/ai-provider";
import { extractExplicitOfferNames } from "@/features/qualification/offer-context";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function contractOfferings(description: string) {
  const bulletItems = description
    .split(/\r?\n/)
    .filter((line) => /^\s*[-*•]\s+/.test(line))
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((line) => line.length >= 3 && line.length <= 160);
  return bulletItems.length >= 2 ? bulletItems : extractExplicitOfferNames(description);
}
function contextualProfile(name: string, allNames: string[]): OfferIntelligenceDraft {
  const lower = normalize(name);
  const competitors = allNames.filter((candidate) => normalize(candidate) !== lower);
  const clues = [`menciona características específicas de ${name}`, `descreve um contexto que diferencia ${name} das outras opções`];
  return {
    version: 1,
    offerName: name,
    safeDescription: `${name} é uma opção real informada pela empresa; a adequação depende das necessidades descritas e da confirmação da equipe.`,
    subjectLabel: "necessidade",
    compatibleNeeds: clues,
    relatedGoals: [`Comparar ${name} com as demais opções reais para a necessidade informada.`],
    strongSignalGroups: [{ clues, minimumMatches: 2, rationale: "Os dois sinais aparecem juntos e diferenciam esta opção das alternativas confirmadas." }],
    supportingSignals: [...clues, name],
    ambiguitySignals: ["quero entender as opções", "preciso de ajuda para escolher"],
    exclusions: ["Não afirmar adequação sem confirmação da equipe."],
    discriminatingQuestions: [{
      question: `Qual característica de ${name} mais ajudaria a diferenciar esta opção?`,
      purpose: "signal",
      separatesFromOfferNames: competitors,
    }],
    explanationData: [`A comparação considera a necessidade descrita e as diferenças entre ${name} e ${competitors.join(", ")}.`],
    fallbackEligible: false,
  };
}

/** Simula o contrato estruturado para provar plumbing; não mede qualidade semântica do modelo online. */
export class ContractActivationProvider implements VirouAIProvider {
  async analyzeBusiness(input: BusinessAnalysisInput) {
    const profile = new RuleBasedBusinessAnalyzer().analyze(input.input);
    return {
      profile,
      confirmedFacts: [],
      inferences: [],
      missingInformation: [],
      inconsistencies: [],
      requirements: [],
    };
  }

  async analyzeActivationUnderstanding(input: ActivationUnderstandingInput) {
    const offeringNames = contractOfferings(input.input.businessDescription);
    const assisted = offeringNames.length >= 2;
    const destination = input.input.phone ? "whatsapp" as const : input.input.websiteUrl ? "external_url" as const : "native" as const;
    return {
        status: "ready" as const,
        source: "contextual_ai" as const,
        declaredObjective: input.input.businessDescription.slice(0, 600),
        primaryAction: {
          key: assisted ? "recommendation" as const : "contact" as const,
          label: assisted ? "Receber uma recomendação" : "Falar com a equipe",
          confidence: 0.96,
          evidence: [input.input.businessDescription.slice(0, 500)],
          source: "contextual_ai" as const,
        },
        secondaryActions: assisted ? [{ key: "contact" as const, label: "Falar com a equipe", confidence: 0.94, source: "contextual_ai" as const }] : [],
        completionAction: {
          key: "contact",
          label: destination === "whatsapp" ? "Continuar pelo WhatsApp" : "Continuar com a equipe",
          destination,
          confidence: 0.98,
          source: "contextual_ai" as const,
        },
        offerings: offeringNames.map((name) => ({
          name,
          kind: "other" as const,
          evidence: name,
          confidence: 0.98,
          source: "contextual_ai" as const,
        })),
        needsAssistedDiscovery: assisted,
        confidence: 0.96,
        issues: [],
    };
  }

  async generateMissingQuestions() { return []; }

  async composeDiscoveryPlan(input: DiscoveryPlanningInput): Promise<DiscoveryPlanDraft> {
    return {
      offerIntelligenceProfiles: input.offeringNames.map((name) => contextualProfile(name, input.offeringNames)),
      questions: [
        { id: "contract-primary-need", question: "O que você precisa resolver com esta escolha?", type: "textarea", purpose: "need", required: true },
        { id: "contract-context", question: "Qual contexto ou restrição deve ser considerado?", type: "textarea", purpose: "context", required: true },
        { id: "contract-signal", question: "Que resultado ajudaria a diferenciar as opções?", type: "textarea", purpose: "signal", required: true },
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

/** @deprecated Use ContractActivationProvider em gates novos. */
export class ActivationGateFakeProvider extends ContractActivationProvider {}
