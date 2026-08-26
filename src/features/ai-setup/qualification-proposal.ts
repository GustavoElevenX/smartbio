import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { offerNamesFromSetup } from "@/features/qualification/offer-context";
import { understandingOfferingNames } from "@/features/ai-setup/activation-understanding";
import {
  buildDeterministicOfferIntelligence,
  questionsFromOfferIntelligenceProfiles,
} from "@/features/qualification/offer-intelligence";
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
  session: Pick<AISetupSession, "initialInput" | "extractedProfile" | "visitorActions"> & Partial<Pick<AISetupSession, "answers" | "activationUnderstanding">>,
) {
  const primary = session.visitorActions.find((action) => action.isPrimary) || session.visitorActions[0];
  const primaryIsRecommendation = primary?.key === "recommendation" || primary?.semanticKey === "recommendation";
  const completion = primaryIsRecommendation
    ? session.visitorActions.find((action) => action.key !== "recommendation" && action.semanticKey !== "recommendation")
    : primary;
  const nextAction = session.activationUnderstanding?.completionAction.label.toLowerCase()
    || completion?.label.toLowerCase()
    || "conversar com a equipe";
  const healthRelated = isHealthRelated(session);
  const contextualOfferings = understandingOfferingNames(session.activationUnderstanding);
  const extractedOfferings = session.answers?.["qualification.offerings"] == null && contextualOfferings.length
    ? contextualOfferings
    : offerNamesFromSetup(session.initialInput.description, session.answers?.["qualification.offerings"]);
  const outcome = healthRelated
    ? "Apresentar possibilidades relevantes com base nas respostas, sem diagnosticar ou indicar um procedimento, e encaminhar para avaliação profissional."
    : `Apresentar os caminhos mais compatíveis com as respostas e encaminhar o visitante para ${nextAction}.`;
  const destination = session.initialInput.phone
    ? "Continuar pelo WhatsApp informado, levando o contexto das respostas."
    : "Enviar os dados pelo formulário da Sobe para o negócio continuar o atendimento.";

  return {
    "qualification.objective": session.activationUnderstanding?.declaredObjective || (healthRelated
      ? "Entender a necessidade do visitante, orientar possibilidades e encaminhar para uma avaliação profissional."
      : primaryIsRecommendation
        ? "Entender a necessidade do visitante e indicar uma opção adequada ao que ele procura."
        : `Entender a necessidade do visitante e ajudá-lo a ${nextAction}.`),
    "qualification.outcome": outcome,
    "qualification.destination": destination,
    ...(extractedOfferings.length ? { "qualification.offerings": extractedOfferings.join("\n") } : {}),
  } satisfies Record<string, string>;
}

export function buildQualificationQuestionPlan(
  session: Pick<AISetupSession, "initialInput" | "extractedProfile" | "visitorActions"> & Partial<Pick<AISetupSession, "answers" | "activationUnderstanding">>,
): StructuredJourneyQuestion[] {
  const offerNames = understandingOfferingNames(session.activationUnderstanding).length
    ? understandingOfferingNames(session.activationUnderstanding)
    : offerNamesFromSetup(session.initialInput.description, session.answers?.["qualification.offerings"]);
  const context = `${session.initialInput.businessName} ${session.initialInput.description} ${offerNames.join(" ")}`;
  const profiles = offerNames.map((offerName) => buildDeterministicOfferIntelligence({
    projectId: "setup-draft",
    offerId: `setup-draft:${normalize(offerName)}`,
    offerName,
    businessContext: context,
    competingOfferNames: offerNames,
  }));
  const profileQuestions = questionsFromOfferIntelligenceProfiles(profiles);
  if (profileQuestions.length >= 2) return profileQuestions;
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
