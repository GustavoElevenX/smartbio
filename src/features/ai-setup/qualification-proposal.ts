import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import type { StructuredJourneyQuestion } from "@/types";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isHealthRelated(session: Pick<AISetupSession, "initialInput" | "extractedProfile">) {
  const text = normalize(
    `${session.initialInput.businessName} ${session.initialInput.description} ${(session.extractedProfile?.offerKinds || []).join(" ")}`,
  );
  if (/automot|veicul|carro|pintura|farol|oficina/.test(text)) return false;
  return /clinica|saude|medic|odont|fisioter|terapia|nutri|psicolog|estetic|procedimento|botox|preenchimento/.test(text);
}

export function buildQualificationSuggestions(
  session: Pick<AISetupSession, "initialInput" | "extractedProfile" | "visitorActions">,
) {
  const primary = session.visitorActions.find((action) => action.isPrimary) || session.visitorActions[0];
  const primaryIsRecommendation = primary?.key === "recommendation" || primary?.semanticKey === "recommendation";
  const completion = primaryIsRecommendation
    ? session.visitorActions.find((action) => action.key !== "recommendation" && action.semanticKey !== "recommendation")
    : primary;
  const nextAction = completion?.label.toLowerCase() || "conversar com a equipe";
  const healthRelated = isHealthRelated(session);
  const questions = healthRelated
    ? [
        "O que você gostaria de melhorar ou entender?",
        "Qual é seu principal objetivo neste momento?",
        "Você gostaria de solicitar uma avaliação profissional?",
      ]
    : [
        "O que você está buscando neste momento?",
        "Qual é seu principal objetivo?",
        "Como prefere continuar depois desta orientação?",
      ];
  const outcome = healthRelated
    ? "Apresentar possibilidades relevantes com base nas respostas, sem diagnosticar ou indicar um procedimento, e encaminhar para avaliação profissional."
    : `Apresentar os caminhos mais compatíveis com as respostas e encaminhar o visitante para ${nextAction}.`;
  const destination = session.initialInput.phone
    ? "Continuar pelo WhatsApp informado, levando o contexto das respostas."
    : "Enviar os dados pelo formulário da Sobe para o negócio continuar o atendimento.";

  return {
    "qualification.objective": healthRelated
      ? "Entender a necessidade do visitante, orientar possibilidades e encaminhar para uma avaliação profissional."
      : primaryIsRecommendation
        ? "Entender a necessidade do visitante e indicar uma opção adequada ao que ele procura."
        : `Entender a necessidade do visitante e ajudá-lo a ${nextAction}.`,
    "qualification.questions": questions.join("\n"),
    "qualification.outcome": outcome,
    "qualification.destination": destination,
  } satisfies Record<string, string>;
}

export function buildQualificationQuestionPlan(
  session: Pick<AISetupSession, "initialInput" | "extractedProfile" | "visitorActions">,
): StructuredJourneyQuestion[] {
  const healthRelated = isHealthRelated(session);
  return [
    {
      id: "qualification-need",
      question: healthRelated
        ? "O que você gostaria de melhorar ou entender?"
        : "O que você mais gostaria de resolver neste momento?",
      type: "textarea",
      purpose: "need",
      required: true,
    },
    {
      id: "qualification-signal",
      question: healthRelated
        ? "Qual é o seu principal objetivo com uma avaliação profissional?"
        : "Que resultado seria mais importante para você?",
      type: "textarea",
      purpose: "signal",
      required: true,
    },
    {
      id: "qualification-context",
      question: healthRelated
        ? "Existe algum contexto importante para a equipe considerar na avaliação?"
        : "Existe algum detalhe ou restrição importante para essa escolha?",
      type: "textarea",
      purpose: healthRelated ? "context" : "constraint",
      required: false,
    },
  ];
}
