import { profileFromDraft } from "@/features/qualification/offer-intelligence";
import type { Project } from "@/types";
import { contextSignature } from "@/features/qualification/offer-context";

export interface OfferIntelligenceFixture {
  strongClues?: string[];
  supporting?: string[];
  ambiguity?: string[];
  fallbackEligible?: boolean;
  explanation?: string;
  question?: string;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function attachEngineFixtureProfiles(
  project: Project,
  fixtures: Record<string, OfferIntelligenceFixture>,
) {
  const offerings = project.commercialConfig?.serviceOfferings || [];
  const discoveryPlanId = `engine-fixture-plan-${project.id}`;
  const signature = contextSignature(`${project.name} ${project.description} ${offerings.map((item) => item.name).join(" ")}`);
  for (const offering of offerings) {
    const fixture = fixtures[normalize(offering.name)] || {};
    const terms = normalize(offering.name).split(/[^a-z0-9]+/).filter((term) => term.length > 2);
    const question = fixture.question || `Que sinais você percebe para a equipe avaliar ${offering.name.toLocaleLowerCase("pt-BR")}?`;
    const profile = profileFromDraft({
      version: 1,
      offerName: offering.name,
      safeDescription: offering.shortDescription || `${offering.name}: opção real do negócio.`,
      compatibleNeeds: fixture.supporting?.length ? fixture.supporting : [`Contexto relacionado a ${offering.name}.`],
      relatedGoals: [`Entender se ${offering.name} merece ser considerada.`],
      strongSignalGroups: fixture.strongClues && fixture.strongClues.length >= 2 ? [{
        clues: fixture.strongClues,
        minimumMatches: 2,
        rationale: "Dois ou mais sinais observáveis convergem para esta oferta.",
      }] : [],
      supportingSignals: [...new Set([
        offering.name,
        ...terms,
        ...(fixture.supporting || []),
        `Contexto descrito para ${offering.name.toLocaleLowerCase("pt-BR")}`,
      ])],
      ambiguitySignals: fixture.ambiguity || ["contexto insuficiente"],
      exclusions: [],
      discriminatingQuestions: [{
        question,
        purpose: "signal",
        separatesFromOfferNames: offerings.filter((candidate) => candidate.id !== offering.id).map((candidate) => candidate.name),
      }],
      explanationData: [fixture.explanation || "Os sinais observáveis tornam esta oferta uma possibilidade segura para avaliação da equipe."],
      fallbackEligible: fixture.fallbackEligible || false,
    }, {
      offerId: offering.id,
      projectId: project.id,
      businessContext: `${project.name} ${project.description}`,
      contextSignature: signature,
      discoveryPlanId,
      discoveryPlanVersion: 1,
      source: "business_confirmed",
    });
    offering.settings = { ...offering.settings, offerIntelligence: profile };
  }
  project.discoveryPlan = {
    id: discoveryPlanId,
    version: 1,
    setupSessionId: `engine-fixture-session-${project.id}`,
    projectId: project.id,
    contextSignature: signature,
    declaredObjective: project.primaryGoal,
    journeyMode: "assisted_discovery",
    primaryAction: { key: "recommendation", label: project.primaryGoal },
    completionAction: { label: "Conversar com a equipe", destination: project.primaryDestination || "Atendimento" },
    offerings: offerings.map((item) => ({ id: item.id, name: item.name, description: item.shortDescription })),
    offerIntelligenceProfiles: offerings.map((item) => item.settings?.offerIntelligence).filter(Boolean) as NonNullable<Project["discoveryPlan"]>["offerIntelligenceProfiles"],
    questions: [
      { id: "engine-fixture-need", question: "O que você precisa resolver neste momento?", type: "textarea", purpose: "need", required: true },
      { id: "engine-fixture-signal", question: "Que sinais ajudam a diferenciar sua necessidade?", type: "textarea", purpose: "signal", required: true },
    ],
    fallbackStrategy: { kind: "team_handoff", explanation: "Fixture controlada encaminha ambiguidades à equipe." },
    provenance: { source: "business_confirmed", providerOperation: "composeDiscoveryPlan", createdAt: "2026-08-25T00:00:00.000Z" },
    status: "ready",
    issues: [],
  };
  for (const offering of offerings) offering.settings = { ...offering.settings, discoveryPlanId, discoveryPlanVersion: 1, discoveryContextSignature: signature };
  return project;
}
