import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isHealthRelated(session: Pick<AISetupSession, "initialInput" | "extractedProfile">) {
  const text = normalize(
    `${session.initialInput.businessName} ${session.initialInput.description} ${(session.extractedProfile?.offerKinds || []).join(" ")}`,
  );
  return /clinica|saude|medic|odont|fisioter|terapia|nutri|psicolog|estetic|procedimento|botox|preenchimento/.test(text);
}

export function buildQualificationSuggestions(
  session: Pick<AISetupSession, "initialInput" | "extractedProfile" | "visitorActions">,
) {
  const primary = session.visitorActions.find((action) => action.isPrimary) || session.visitorActions[0];
  const nextAction = primary?.label.toLowerCase() || "seguir para o próximo passo";
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
      : `Entender a necessidade do visitante e ajudá-lo a ${nextAction}.`,
    "qualification.questions": questions.join("\n"),
    "qualification.outcome": outcome,
    "qualification.destination": destination,
  } satisfies Record<string, string>;
}
