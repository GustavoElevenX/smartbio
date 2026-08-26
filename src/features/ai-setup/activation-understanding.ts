import {
  activationUnderstandingSchema,
  type ActivationUnderstanding,
} from "@/features/ai-setup/ai-setup.schema";
import {
  defaultVisitorActions,
  visitorActionDefinition,
  type VisitorActionSelection,
} from "@/features/ai-setup/visitor-actions";
import { extractExplicitOfferNames } from "@/features/qualification/offer-context";
import type { BusinessCapabilityProfile } from "@/types";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function uniqueOfferings(offerings: ActivationUnderstanding["offerings"]) {
  const seen = new Set<string>();
  return offerings.filter((offering) => {
    const key = normalize(offering.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeActivationUnderstanding(input: ActivationUnderstanding) {
  const parsed = activationUnderstandingSchema.parse(input);
  const offerings = uniqueOfferings(parsed.offerings);
  const issues = [...parsed.issues];
  let primaryAction = parsed.primaryAction;
  let secondaryActions = parsed.secondaryActions.filter((action) => action.key !== primaryAction.key);

  if (parsed.needsAssistedDiscovery && offerings.length >= 2 && primaryAction.key !== "recommendation") {
    issues.push("A descoberta assistida exige recomendação como ação principal antes do destino final.");
    secondaryActions = [
      { ...primaryAction },
      ...secondaryActions.filter((action) => action.key !== "recommendation"),
    ];
    primaryAction = {
      key: "recommendation",
      label: visitorActionDefinition("recommendation")?.label || "Receber uma recomendação",
      confidence: Math.max(parsed.confidence, 0.8),
      evidence: [parsed.declaredObjective],
      source: parsed.source,
    };
  }

  if (offerings.some((offering) => offering.confidence < 0.7)) {
    issues.push("Uma ou mais opções contextuais precisam de confirmação do empresário.");
  }

  return activationUnderstandingSchema.parse({
    ...parsed,
    status: parsed.status === "ready" && parsed.confidence < 0.7 ? "needs_confirmation" : parsed.status,
    primaryAction,
    secondaryActions: secondaryActions.slice(0, 7),
    offerings,
    issues: [...new Set(issues)],
  });
}

export function actionsFromActivationUnderstanding(
  understanding: ActivationUnderstanding,
): VisitorActionSelection[] {
  const normalized = normalizeActivationUnderstanding(understanding);
  const completionKey = ["whatsapp", "email", "phone"].includes(normalized.completionAction.destination)
    ? "contact" as const
    : undefined;
  const candidates = [
    normalized.primaryAction,
    ...normalized.secondaryActions.map((action) => ({ ...action, evidence: [] as string[] })),
    ...(completionKey && normalized.primaryAction.key !== completionKey
      ? [{
          key: completionKey,
          label: visitorActionDefinition(completionKey)?.label || normalized.completionAction.label,
          confidence: normalized.completionAction.confidence,
          source: normalized.completionAction.source,
          evidence: [] as string[],
        }]
      : []),
  ];
  const seen = new Set<string>();
  return candidates.flatMap((action, index) => {
    if (seen.has(action.key)) return [];
    seen.add(action.key);
    return [{
      key: action.key,
      label: action.label,
      isPrimary: index === 0,
      source: action.source,
      confidence: action.confidence,
      evidence: action.evidence,
      confirmedByBusiness: false,
    } satisfies VisitorActionSelection];
  }).slice(0, 8);
}

export function deterministicActivationUnderstanding(input: {
  profile: BusinessCapabilityProfile;
  businessDescription: string;
  phone?: string;
  websiteUrl?: string;
}): ActivationUnderstanding {
  const actions = defaultVisitorActions(input.profile, input.businessDescription);
  const primary = actions.find((action) => action.isPrimary) || actions[0] || {
    key: "contact" as const,
    label: "Falar com a equipe",
    isPrimary: true,
  };
  const offerings = extractExplicitOfferNames(input.businessDescription);
  return normalizeActivationUnderstanding({
    status: "degraded",
    source: "deterministic_fallback",
    declaredObjective: input.businessDescription.slice(0, 600),
    primaryAction: {
      key: primary.key,
      label: primary.label,
      confidence: 0.45,
      evidence: ["Inferência determinística conservadora a partir da descrição."],
      source: "deterministic_fallback",
    },
    secondaryActions: actions.filter((action) => action.key !== primary.key).map((action) => ({
      key: action.key,
      label: action.label,
      confidence: 0.4,
      source: "deterministic_fallback" as const,
    })),
    completionAction: {
      key: input.phone ? "contact" : "native",
      label: input.phone ? "Continuar pelo WhatsApp" : input.websiteUrl ? "Continuar no site" : "Enviar para a equipe",
      destination: input.phone ? "whatsapp" : input.websiteUrl ? "external_url" : "native",
      confidence: input.phone || input.websiteUrl ? 0.9 : 0.5,
      source: "deterministic_fallback",
    },
    offerings: offerings.map((name) => ({
      name,
      kind: "other" as const,
      evidence: name,
      confidence: 0.55,
      source: "deterministic_fallback" as const,
    })),
    needsAssistedDiscovery: primary.key === "recommendation",
    confidence: 0.45,
    issues: ["O provider contextual não estava disponível; confirme a estratégia antes de publicar."],
  });
}

export function markActionsConfirmed(
  understanding: ActivationUnderstanding,
  actions: VisitorActionSelection[],
) {
  const current = actionsFromActivationUnderstanding(understanding);
  const unchanged = current.length === actions.length && current.every((action, index) => (
    action.key === actions[index]?.key && action.isPrimary === actions[index]?.isPrimary
  ));
  const selected = actions.map((action) => ({
    ...action,
    source: unchanged ? (current.find((item) => item.key === action.key)?.source || understanding.source) : "business_confirmed" as const,
    confidence: unchanged ? current.find((item) => item.key === action.key)?.confidence : 1,
    evidence: unchanged ? current.find((item) => item.key === action.key)?.evidence : ["Ação ajustada pelo empresário no onboarding."],
    confirmedByBusiness: true,
  }));
  const primary = selected.find((action) => action.isPrimary) || selected[0];
  if (!primary) return { understanding, actions: selected };
  const next = normalizeActivationUnderstanding({
    ...understanding,
    status: understanding.status === "degraded" ? "degraded" : "ready",
    source: unchanged ? understanding.source : "business_confirmed",
    primaryAction: {
      key: primary.key,
      label: primary.label,
      confidence: primary.confidence || 1,
      evidence: primary.evidence || ["Ação confirmada pelo empresário."],
      source: primary.source || "business_confirmed",
    },
    secondaryActions: selected.filter((action) => action.key !== primary.key).map((action) => ({
      key: action.key,
      label: action.label,
      confidence: action.confidence || 1,
      source: action.source || "business_confirmed",
    })),
    needsAssistedDiscovery: primary.key === "recommendation" || primary.semanticKey === "recommendation",
  });
  return { understanding: next, actions: selected };
}

export function markOfferingsConfirmed(
  understanding: ActivationUnderstanding,
  names: string[],
) {
  const existing = new Map(understanding.offerings.map((offering) => [normalize(offering.name), offering]));
  return normalizeActivationUnderstanding({
    ...understanding,
    offerings: names.map((name) => ({
      ...(existing.get(normalize(name)) || {
        name,
        kind: "other" as const,
        evidence: "Opção informada pelo empresário durante o onboarding.",
      }),
      name,
      confidence: 1,
      source: "business_confirmed" as const,
    })),
  });
}

export function understandingOfferingNames(understanding?: ActivationUnderstanding) {
  return understanding?.offerings.map((offering) => offering.name) || [];
}
