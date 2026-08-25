export interface ActivationPreflightFeature {
  enabled: boolean;
  limit?: number;
  used?: number;
  remaining?: number;
}

export interface ActivationPreflightProject {
  id: string;
  name: string;
  status: "draft" | "published";
}

export interface ActivationPreflightInput {
  plan: {
    key: string;
    name: string;
    status: "active" | "suspended" | "expired";
  };
  features: Record<string, ActivationPreflightFeature | undefined>;
  projects: ActivationPreflightProject[];
}

export interface ActivationPreflight {
  allowed: boolean;
  plan: ActivationPreflightInput["plan"];
  checks: {
    canCreateProject: boolean;
    canGenerateInitialVersion: boolean;
    canPublish: boolean;
  };
  existingProject?: ActivationPreflightProject;
  blockedReason?: string;
  actionLabel?: string;
  actionPath?: string;
}

function hasCapacity(feature?: ActivationPreflightFeature) {
  if (!feature?.enabled) return false;
  if (feature.limit == null) return true;
  return (feature.used || 0) < feature.limit;
}

export function evaluateActivationPreflight(
  input: ActivationPreflightInput,
): ActivationPreflight {
  const activePlan = input.plan.status === "active";
  const canCreateProject = activePlan && hasCapacity(input.features.projects);
  const canGenerateInitialVersion =
    activePlan &&
    Boolean(input.features.ai_business_analysis?.enabled) &&
    Boolean(input.features.ai_journey?.enabled) &&
    Boolean(input.features.ai_presence?.enabled) &&
    hasCapacity(input.features.ai_generations_month);
  const canPublish =
    activePlan &&
    Boolean(input.features.presence?.enabled) &&
    hasCapacity(input.features.presence_pages);
  const allowed = canCreateProject && canGenerateInitialVersion && canPublish;
  const existingProject = input.projects[0];

  if (allowed) return { allowed, plan: input.plan, checks: { canCreateProject, canGenerateInitialVersion, canPublish } };

  if (!activePlan) {
    return {
      allowed,
      plan: input.plan,
      checks: { canCreateProject, canGenerateInitialVersion, canPublish },
      existingProject,
      blockedReason: "Seu acesso precisa estar ativo antes de criar uma nova Sobe.",
      actionLabel: "Ver meu plano",
      actionPath: "/app/settings/billing",
    };
  }

  if (!canCreateProject && existingProject) {
    return {
      allowed,
      plan: input.plan,
      checks: { canCreateProject, canGenerateInitialVersion, canPublish },
      existingProject,
      blockedReason: "Este plano já está usando o negócio incluído. Continue nele para não perder o trabalho que já foi criado.",
      actionLabel: "Abrir minha Sobe",
      actionPath: `/app/projects/${existingProject.id}`,
    };
  }

  if (!canCreateProject) {
    return {
      allowed,
      plan: input.plan,
      checks: { canCreateProject, canGenerateInitialVersion, canPublish },
      blockedReason: "Seu plano não permite iniciar outro negócio agora.",
      actionLabel: "Ver meu plano",
      actionPath: "/app/settings/billing",
    };
  }

  if (!canGenerateInitialVersion) {
    return {
      allowed,
      plan: input.plan,
      checks: { canCreateProject, canGenerateInitialVersion, canPublish },
      blockedReason: "As ações com IA necessárias para criar a primeira versão não estão disponíveis neste plano agora.",
      actionLabel: "Ver meu plano",
      actionPath: "/app/settings/billing",
    };
  }

  return {
    allowed,
    plan: input.plan,
    checks: { canCreateProject, canGenerateInitialVersion, canPublish },
    blockedReason: "A publicação da primeira página não está disponível neste plano.",
    actionLabel: "Ver meu plano",
    actionPath: "/app/settings/billing",
  };
}
