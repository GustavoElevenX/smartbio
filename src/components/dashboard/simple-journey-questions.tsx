import { Input, Label } from "@/components/ui/field";
import { buildIntentCollectionPlan, type VisitorIntent } from "@/features/qualification/intent-collection-plan";
import { addJourneyQuestion, editJourneyQuestion, editableQuestionStepForGoal, editableQuestionsForGoal, removeJourneyQuestion } from "@/features/simple-settings/journey-questions";
import type { Project } from "@/types";

export function SimpleJourneyQuestions({ project, onChange }: { project: Project; onChange(project: Project): void }) {
  const goals = (project.conversionGoals || []).filter((goal) => goal.isActive).toSorted((a, b) => a.order - b.order);
  return <div className="space-y-4">
    <p className="text-sm text-[#526171]">O que a SOBE vai descobrir antes de encaminhar. Caminhos diretos continuam sem formulário.</p>
    {goals.map((goal) => {
      const questions = editableQuestionsForGoal(project, goal);
      const questionStepId = editableQuestionStepForGoal(project, goal);
      const intent: VisitorIntent = ({ buy: "buy", request_quote: "quote", schedule: "schedule", contact: "contact" } as Record<string, VisitorIntent>)[goal.kind] || "other";
      const plan = buildIntentCollectionPlan({ intent, fields: questions.map((item) => item.field), answers: {}, hasCatalogItems: Boolean(project.commercialConfig?.catalogItems?.length) });
      return <section key={goal.id} className="rounded-xl border border-[#e2e8ef] p-4">
        <h3 className="font-bold text-[#07172f]">{goal.name}</h3>
        {questions.length ? <div className="mt-3 space-y-3">{questions.map(({ stepId, field }) => {
          const decision = plan.questions.find((item) => item.field.id === field.id)?.decision;
          return <div key={`${stepId}:${field.id}`} className="rounded-lg bg-[#f7f8fa] p-3">
            <Label htmlFor={`simple-journey-${goal.id}-${field.id}`}>Pergunta ao visitante</Label>
            <Input id={`simple-journey-${goal.id}-${field.id}`} value={field.label} maxLength={120} onChange={(event) => onChange(editJourneyQuestion(project, stepId, field.id, { label: event.target.value, handoffLabel: event.target.value }))} />
            {decision ? <p className="mt-1 text-xs text-[#526171]">Por quê: {decision}</p> : null}
            <div className="mt-2 flex flex-wrap gap-4 text-sm"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={field.required} onChange={(event) => onChange(editJourneyQuestion(project, stepId, field.id, { required: event.target.checked }))} />Obrigatória</label><button type="button" className="min-h-11 font-bold text-[#0054fc]" onClick={() => onChange(removeJourneyQuestion(project, stepId, field.id))}>Remover</button></div>
          </div>;
        })}</div> : <p className="mt-2 text-sm text-[#526171]">Esta intenção segue diretamente para o destino configurado ou usa apenas dados de contato.</p>}
        {questionStepId && questions.length < 4 ? <button type="button" className="mt-3 min-h-11 text-sm font-bold text-[#0054fc]" onClick={() => onChange(addJourneyQuestion(project, questionStepId))}>Adicionar pergunta</button> : null}
        {plan.reviewRequired ? <p className="mt-2 text-xs text-[#9a6700]">Revise se cada pergunta muda a próxima ação comercial.</p> : null}
      </section>;
    })}
  </div>;
}
