import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { discoveryPlanIsReady } from "@/features/qualification/discovery-plan";
import type { DataRequirement } from "@/types";

export interface SetupReadiness {
  progress: number;
  verified: number;
  total: number;
  blocking: number;
  readyToGenerate: boolean;
}

export interface SetupProgressStage {
  key: "business" | "conversion" | "requirements" | "generate";
  label: string;
  status: "complete" | "current" | "pending";
  detail: string;
}

export function calculateSetupReadiness(
  requirements: DataRequirement[],
  session?: Pick<AISetupSession, "initialInput"> & Partial<Pick<AISetupSession, "actionsConfirmed" | "extractedProfile" | "activationUnderstanding" | "visitorActions" | "discoveryPlan" | "answers">>,
): SetupReadiness {
  const businessReady = Boolean(
    session?.initialInput.businessName && session.initialInput.description.length >= 15,
  );
  const verified = requirements.filter((item) => item.status === "verified").length;
  const blocking = requirements.filter(
    (item) => item.severity === "blocking" && item.status !== "verified",
  ).length;
  const baseCompleted = Number(businessReady) + Number(Boolean(session?.extractedProfile)) + Number(Boolean(session?.actionsConfirmed));
  const total = requirements.length + 3;
  const primary = session?.visitorActions?.find((action) => action.isPrimary) || session?.visitorActions?.[0];
  const recommendation = primary?.key === "recommendation" || primary?.semanticKey === "recommendation";
  const contextualReady = session?.activationUnderstanding?.status !== "degraded";
  const discoveryReady = !recommendation || Boolean(
    session?.discoveryPlan
    && discoveryPlanIsReady(session.discoveryPlan)
    && session.answers?.["qualification.questions"] != null,
  );
  return {
    progress: total ? Math.round(((verified + baseCompleted) / total) * 100) : 0,
    verified,
    total: requirements.length,
    blocking,
    readyToGenerate: businessReady && Boolean(session?.actionsConfirmed) && blocking === 0 && contextualReady && discoveryReady,
  };
}

export function buildSetupProgressStages(session?: AISetupSession | null): SetupProgressStage[] {
  const readiness = calculateSetupReadiness(session?.missingRequirements || [], session || undefined);
  const analyzed = Boolean(session?.extractedProfile);
  const actionsConfirmed = Boolean(session?.actionsConfirmed);
  const requirementsComplete = actionsConfirmed && readiness.blocking === 0;
  const blockingLabel = readiness.blocking === 1
    ? "1 informação necessária"
    : `${readiness.blocking} informações necessárias`;

  return [
    {
      key: "business",
      label: "Seu negócio",
      status: analyzed ? "complete" : "current",
      detail: analyzed ? "Entendido" : "Conte o que você faz",
    },
    {
      key: "conversion",
      label: "Objetivo do visitante",
      status: actionsConfirmed ? "complete" : analyzed ? "current" : "pending",
      detail: actionsConfirmed ? "Definido" : analyzed ? "Confirme a sugestão" : "Aguardando análise",
    },
    {
      key: "requirements",
      label: "Informações necessárias",
      status: requirementsComplete ? "complete" : actionsConfirmed ? "current" : "pending",
      detail: requirementsComplete ? "Tudo confirmado" : actionsConfirmed ? blockingLabel : "Aguardando objetivo",
    },
    {
      key: "generate",
      label: "Pronto para criar",
      status: readiness.readyToGenerate ? "complete" : requirementsComplete ? "current" : "pending",
      detail: readiness.readyToGenerate ? "Pode criar a primeira versão" : "Quase lá",
    },
  ];
}
