import { profileFromDraft } from "@/features/qualification/offer-intelligence";
import type { Project } from "@/types";

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

export function attachTestOfferIntelligence(
  project: Project,
  fixtures: Record<string, OfferIntelligenceFixture>,
) {
  const offerings = project.commercialConfig?.serviceOfferings || [];
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
      source: "ai_composition",
    });
    offering.settings = { ...offering.settings, offerIntelligence: profile };
  }
  return project;
}
