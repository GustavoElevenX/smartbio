import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { discoveryPlanIsReady } from "@/features/qualification/discovery-plan";

function normalizedNames(values: string[]) {
  return values.map((value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()).toSorted();
}

export function activationStateInvariantIssues(session: AISetupSession) {
  const issues: string[] = [];
  const missingQuestions = session.missingRequirements.find((requirement) => (
    requirement.key === "qualification.questions"
    && requirement.severity === "blocking"
    && requirement.status !== "verified"
  ));
  const visibleQuestions = session.questions.some((question) => question.key === "qualification.questions");
  const systemResolving = ["analyzing", "generating"].includes(session.status);
  const recoverableError = session.discoveryPlan?.status === "degraded" || Boolean(session.lastError);

  if (missingQuestions && !visibleQuestions && !systemResolving && !recoverableError) {
    issues.push("qualification.questions está bloqueante sem pergunta visível, resolução automática ou erro recuperável.");
  }
  if (session.discoveryPlan?.status === "ready" && session.answers["qualification.questions"] == null && !visibleQuestions) {
    issues.push("DiscoveryPlan pronto sem perguntas visíveis para confirmação.");
  }
  if (session.activationUnderstanding?.needsAssistedDiscovery && session.activationUnderstanding.offerings.length >= 2) {
    const primary = session.visitorActions.find((action) => action.isPrimary) || session.visitorActions[0];
    if (primary && primary.key !== "recommendation" && primary.semanticKey !== "recommendation") {
      issues.push("Descoberta assistida com múltiplas ofertas sem recommendation como ação principal.");
    }
  }
  if (session.discoveryPlan && session.activationUnderstanding?.offerings.length) {
    const understood = normalizedNames(session.activationUnderstanding.offerings.map((offering) => offering.name));
    const planned = normalizedNames(session.discoveryPlan.offerings.map((offering) => offering.name));
    if (JSON.stringify(understood) !== JSON.stringify(planned)) {
      issues.push("Uma oferta do ActivationUnderstanding desapareceu ou mudou no DiscoveryPlan.");
    }
  }
  if (session.discoveryPlan?.status === "degraded" && discoveryPlanIsReady(session.discoveryPlan)) {
    issues.push("DiscoveryPlan degradado foi tratado como pronto.");
  }
  return issues;
}

export function assertActivationStateInvariants(session: AISetupSession) {
  const issues = activationStateInvariantIssues(session);
  if (issues.length) throw new Error(`Estado inválido da Activation: ${issues.join(" ")}`);
  return session;
}
