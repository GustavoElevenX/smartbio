import type { SetupAnswerContext, SetupAnswerContextAudit } from "@/features/ai-setup/setup-answer-interpretation";
import type { SuggestedSiteStructure } from "@/features/site-composer/site-composer.types";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "");
}

function sectionText(section: SuggestedSiteStructure["pages"][number]["sections"][number]) {
  return normalized([section.title, section.description, JSON.stringify(section.suggestedContent)].filter(Boolean).join(" "));
}

function matchingSectionIndex(suggestion: SuggestedSiteStructure, context: SetupAnswerContext) {
  const candidates = context.facts
    .filter((fact) => fact.kind !== "other")
    .map((fact) => normalized(fact.value))
    .filter((value) => value.length >= 3);
  if (!candidates.length) return undefined;
  let flatIndex = 0;
  for (const page of suggestion.pages) {
    for (const section of page.sections) {
      const content = sectionText(section);
      if (candidates.some((candidate) => content.includes(candidate))) return flatIndex;
      flatIndex += 1;
    }
  }
  return undefined;
}

export function auditAnswerContextCoverage(
  suggestion: SuggestedSiteStructure,
  contexts: SetupAnswerContext[] | undefined,
  generatedAt = new Date().toISOString(),
): { suggestion: SuggestedSiteStructure; audit: SetupAnswerContextAudit } {
  const answerContexts = contexts || [];
  const pages = structuredClone(suggestion.pages);
  const sections = pages.flatMap((page) => page.sections);
  const represented = new Set(sections.flatMap((section) => section.sourceBindings));
  const unrepresented: SetupAnswerContextAudit["unrepresented"] = [];

  for (const context of answerContexts) {
    if (represented.has(context.sourceId)) continue;
    const index = matchingSectionIndex({ ...suggestion, pages }, context);
    if (index != null && sections[index]) {
      sections[index].sourceBindings = [...new Set([...sections[index].sourceBindings, context.sourceId])].slice(0, 30);
      represented.add(context.sourceId);
      continue;
    }
    unrepresented.push({
      sourceId: context.sourceId,
      reason: "A informação foi preservada no contexto, mas não apareceu de forma verificável na primeira versão e precisa de revisão.",
    });
  }

  const warnings = [...suggestion.warnings];
  if (unrepresented.length) warnings.push(`${unrepresented.length} resposta(s) confirmada(s) permaneceram no contexto, mas precisam de revisão porque não foram representadas de forma verificável na página.`);
  const sourceIds = answerContexts.map((context) => context.sourceId);
  const representedSourceIds = sourceIds.filter((sourceId) => represented.has(sourceId));
  return {
    suggestion: { ...suggestion, pages, warnings: warnings.slice(0, 20) },
    audit: {
      status: unrepresented.length ? "needs_review" : "complete",
      sourceIds,
      representedSourceIds,
      unrepresented,
      generatedAt,
    },
  };
}
