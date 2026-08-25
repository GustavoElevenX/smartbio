import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { offerNamesFromSetup } from "@/features/qualification/offer-context";
import { inferRecommendationSignals, inferRecommendationSubject, inferStrongRecommendationSignals } from "@/features/qualification/recommendation-engine";
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
  session: Pick<AISetupSession, "initialInput" | "extractedProfile" | "visitorActions"> & Partial<Pick<AISetupSession, "answers">>,
) {
  const primary = session.visitorActions.find((action) => action.isPrimary) || session.visitorActions[0];
  const primaryIsRecommendation = primary?.key === "recommendation" || primary?.semanticKey === "recommendation";
  const completion = primaryIsRecommendation
    ? session.visitorActions.find((action) => action.key !== "recommendation" && action.semanticKey !== "recommendation")
    : primary;
  const nextAction = completion?.label.toLowerCase() || "conversar com a equipe";
  const healthRelated = isHealthRelated(session);
  const questionPlan = buildQualificationQuestionPlan(session);
  const extractedOfferings = offerNamesFromSetup(session.initialInput.description, session.answers?.["qualification.offerings"]);
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
    "qualification.questions": questionPlan.map((question) => question.question).join("\n"),
    "qualification.outcome": outcome,
    "qualification.destination": destination,
    ...(extractedOfferings.length ? { "qualification.offerings": extractedOfferings.join("\n") } : {}),
  } satisfies Record<string, string>;
}

export function buildQualificationQuestionPlan(
  session: Pick<AISetupSession, "initialInput" | "extractedProfile" | "visitorActions"> & Partial<Pick<AISetupSession, "answers">>,
): StructuredJourneyQuestion[] {
  const healthRelated = isHealthRelated(session);
  if (healthRelated) return [
    { id: "qualification-need", question: "O que você gostaria de melhorar ou entender?", type: "textarea", purpose: "need", required: true },
    { id: "qualification-signal", question: "Qual é o seu principal objetivo com uma avaliação profissional?", type: "textarea", purpose: "signal", required: true },
    { id: "qualification-context", question: "Existe algum contexto importante para a equipe considerar na avaliação?", type: "textarea", purpose: "context", required: false },
  ];
  const offerNames = offerNamesFromSetup(session.initialInput.description, session.answers?.["qualification.offerings"]);
  const context = `${session.initialInput.businessName} ${session.initialInput.description} ${offerNames.join(" ")}`;
  const options = offerNames.flatMap((name) => {
    const candidates = [
      ...inferStrongRecommendationSignals(name, "", context),
      ...inferRecommendationSignals(name, "", context),
    ];
    const signal = candidates.find((candidate) => candidate.split(/\s+/).length >= 3 && normalize(candidate) !== normalize(name));
    return signal ? [signal.charAt(0).toLocaleUpperCase("pt-BR") + signal.slice(1)] : [];
  });
  const uniqueOptions = [...new Set(options)].slice(0, 6);
  const subject = inferRecommendationSubject(context);
  if (uniqueOptions.length >= 2) return [
    {
      id: "qualification-need",
      question: subject ? `O que está acontecendo com ${subject}?` : "O que está acontecendo e o que você precisa resolver?",
      type: "textarea",
      purpose: "need",
      required: true,
    },
    {
      id: "qualification-differentiator",
      question: "Qual destas situações mais se aproxima do que você precisa?",
      type: "radio",
      options: uniqueOptions,
      purpose: "signal",
      required: true,
    },
  ];
  return [
    {
      id: "qualification-need",
      question: "O que você mais gostaria de resolver neste momento?",
      type: "textarea",
      purpose: "need",
      required: true,
    },
    {
      id: "qualification-signal",
      question: "Que resultado seria mais importante para você?",
      type: "textarea",
      purpose: "signal",
      required: true,
    },
    {
      id: "qualification-context",
      question: "Existe algum detalhe ou restrição importante para essa escolha?",
      type: "textarea",
      purpose: "constraint",
      required: false,
    },
  ];
}
