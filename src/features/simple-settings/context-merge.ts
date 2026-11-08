import type { ProjectCommercialContext } from "@/features/commercial-context/project-commercial-context.schema";

/** Only fields editable in Simple are merged. Everything else comes from the newer revision. */
export function mergeSimpleContextReview(base: ProjectCommercialContext, draft: ProjectCommercialContext, latest: ProjectCommercialContext) {
  const conflicts: string[] = [];
  const changedSummary = draft.summary.whatItSells !== base.summary.whatItSells;
  if (changedSummary && latest.summary.whatItSells !== base.summary.whatItSells && latest.summary.whatItSells !== draft.summary.whatItSells) conflicts.push("Produtos ou serviços principais");
  const priorIntent = new Map(base.intentContexts.map((item) => [item.id, item]));
  const editedIntent = new Map(draft.intentContexts.map((item) => [item.id, item]));
  const intentContexts = latest.intentContexts.map((item) => {
    const previous = priorIntent.get(item.id);
    const edited = editedIntent.get(item.id);
    if (!previous || !edited || previous.status === edited.status) return item;
    if (item.status !== previous.status && item.status !== edited.status) conflicts.push(item.label);
    return { ...item, status: edited.status, confidence: edited.status === "confirmed" ? 1 : item.confidence };
  });
  return {
    context: {
      ...latest,
      summary: changedSummary ? { ...latest.summary, whatItSells: draft.summary.whatItSells } : latest.summary,
      intentContexts,
    },
    conflicts,
  };
}
