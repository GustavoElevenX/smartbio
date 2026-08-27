import {
  type ArchitectureResolutionTarget,
  type CommercialArchitecture,
} from "@/features/ai-setup/ai-setup.schema";
import { normalizeCommercialArchitecture } from "@/features/ai-setup/commercial-architecture";
import { validateSetupPhone } from "@/features/ai-setup/setup-phone";
import { resolveCompletionDestination, validCommercialChannel } from "@/features/routing/completion-destination";
import type { Project } from "@/types";

type RequiredFact = CommercialArchitecture["journeyBlueprints"][number]["requiredFacts"][number];
type Blueprint = CommercialArchitecture["journeyBlueprints"][number];

function validHttpUrl(value: unknown) {
  try {
    return ["http:", "https:"].includes(new URL(String(value || "").trim()).protocol);
  } catch {
    return false;
  }
}

function compatibilityTarget(
  architecture: CommercialArchitecture,
  blueprint: Blueprint,
  fact: RequiredFact,
): ArchitectureResolutionTarget | null {
  if (fact.resolutionTarget) return fact.resolutionTarget;
  const suffix = fact.key.split(".").at(-1);
  if (suffix === "url") return { type: "external_url", blueprintId: blueprint.id, intentId: blueprint.intentId };
  if (suffix === "destination") {
    return { type: "channel_value", channelId: blueprint.completion.channelId, intentId: blueprint.intentId, channelType: blueprint.completion.type === "native" ? "whatsapp" : blueprint.completion.type };
  }
  if (suffix === "location_channels") {
    const used = [...new Set(blueprint.steps.flatMap((step) => step.usesLocations))];
    return { type: "location_channel_mapping", intentId: blueprint.intentId, locationIds: used.length ? used : architecture.locations.map((location) => location.id), channelType: blueprint.completion.type === "native" ? "whatsapp" : blueprint.completion.type };
  }
  if (suffix === "completion") {
    return { type: "completion_strategy", blueprintId: blueprint.id, acceptedStrategies: ["fixed", "by_location", "external_url", "native"] };
  }
  return null;
}

function targetFor(architecture: CommercialArchitecture, fact: RequiredFact) {
  const blueprint = architecture.journeyBlueprints.find((item) => item.requiredFacts.some((candidate) => candidate.key === fact.key));
  return blueprint ? compatibilityTarget(architecture, blueprint, fact) : fact.resolutionTarget;
}

function blueprintForTarget(architecture: CommercialArchitecture, target: ArchitectureResolutionTarget) {
  if ("blueprintId" in target) return architecture.journeyBlueprints.find((item) => item.id === target.blueprintId);
  return architecture.journeyBlueprints.find((item) => item.intentId === target.intentId);
}

export function isRequiredFactResolved(architecture: CommercialArchitecture, fact: RequiredFact): boolean {
  const target = targetFor(architecture, fact);
  if (!target) return false;
  const blueprint = blueprintForTarget(architecture, target);
  if (!blueprint) return false;
  if (target.type === "channel_value" || target.type === "external_url") {
    const channel = architecture.channels.find((item) => item.id === blueprint.completion.channelId);
    const expectedType = target.type === "external_url" ? "external_url" : target.channelType;
    return channel?.type === expectedType && validCommercialChannel(channel);
  }
  if (target.type === "location_channel_mapping") {
    const ids = target.locationIds.length ? target.locationIds : architecture.locations.map((location) => location.id);
    return blueprint.completion.type === target.channelType && ids.length > 0 && ids.every((selectedLocationId) => {
      const resolution = resolveCompletionDestination({ architecture, blueprint, selectedLocationId });
      return resolution.status === "resolved" && resolution.channel.type === target.channelType;
    });
  }
  if (target.type === "completion_strategy") {
    if (!target.acceptedStrategies.includes(blueprint.completion.destinationStrategy)) return false;
    if (blueprint.completion.destinationStrategy === "fixed" || blueprint.completion.destinationStrategy === "external_url") {
      const channel = architecture.channels.find((item) => item.id === blueprint.completion.channelId);
      return channel?.type === blueprint.completion.type && validCommercialChannel(channel);
    }
    if (blueprint.completion.destinationStrategy === "by_location") {
      const locationTarget: ArchitectureResolutionTarget = {
        type: "location_channel_mapping",
        intentId: blueprint.intentId,
        locationIds: [...new Set(blueprint.steps.flatMap((step) => step.usesLocations))],
        channelType: blueprint.completion.type === "native" ? "whatsapp" : blueprint.completion.type,
      };
      return isRequiredFactResolved(architecture, { ...fact, resolutionTarget: locationTarget });
    }
    if (blueprint.completion.destinationStrategy === "by_answer") return false;
    return blueprint.steps.some((step) => step.expectedCapability === "scheduling" || step.expectedCapability === "reservation");
  }
  return blueprint.steps.some((step) => step.collects.some((field) => field === target.fieldKey));
}

function structuralFacts(architecture: CommercialArchitecture, blueprint: Blueprint): RequiredFact[] {
  const intent = architecture.intents.find((item) => item.id === blueprint.intentId);
  const affects = intent?.label || blueprint.objective;
  const channel = architecture.channels.find((item) => item.id === blueprint.completion.channelId);
  if (blueprint.completion.destinationStrategy === "external_url" && (blueprint.completion.type !== "external_url" || channel?.type !== "external_url" || !validCommercialChannel(channel))) {
    return [{ key: `architecture.${blueprint.intentId}.url`, label: `Link para ${affects}`, reason: "O caminho direto precisa de uma URL real.", affects, severity: "blocking", resolutionTarget: { type: "external_url", blueprintId: blueprint.id, intentId: blueprint.intentId } }];
  }
  if (blueprint.completion.destinationStrategy === "fixed" && (blueprint.completion.type === "native" || channel?.type !== blueprint.completion.type || !validCommercialChannel(channel))) {
    const channelType = blueprint.completion.type === "native" ? "whatsapp" : blueprint.completion.type;
    return [{ key: `architecture.${blueprint.intentId}.destination`, label: `Destino de ${affects}`, reason: `Precisamos de um canal ${channelType} real e compatível com esta jornada.`, affects, severity: "blocking", resolutionTarget: { type: "channel_value", channelId: blueprint.completion.channelId, intentId: blueprint.intentId, channelType } }];
  }
  if (blueprint.completion.destinationStrategy === "by_location") {
    const locationIds = [...new Set(blueprint.steps.flatMap((step) => step.usesLocations))];
    const channelType = blueprint.completion.type === "native" ? "whatsapp" : blueprint.completion.type;
    const target = { type: "location_channel_mapping", intentId: blueprint.intentId, locationIds: locationIds.length ? locationIds : architecture.locations.map((location) => location.id), channelType } as const;
    const fact: RequiredFact = { key: `architecture.${blueprint.intentId}.location_channels`, label: `Destino ${channelType} de cada unidade`, reason: `Cada unidade usada por esta jornada precisa ter exatamente um destino ${channelType} compatível.`, affects, severity: "blocking", resolutionTarget: target };
    if (!isRequiredFactResolved(architecture, fact)) return [fact];
  }
  if (blueprint.completion.destinationStrategy === "by_answer") {
    return [{ key: `architecture.${blueprint.intentId}.completion`, label: `Regra de destino de ${affects}`, reason: "A jornada precisa de uma regra explícita que transforme respostas em destino.", affects, severity: "blocking", resolutionTarget: { type: "completion_strategy", blueprintId: blueprint.id, acceptedStrategies: ["fixed", "by_location", "external_url", "native"] } }];
  }
  return [];
}

export function deriveRequiredFacts(architecture: CommercialArchitecture) {
  return architecture.journeyBlueprints.flatMap((blueprint) => {
    const existing = blueprint.requiredFacts
      .map((fact) => ({ ...fact, resolutionTarget: compatibilityTarget(architecture, blueprint, fact) }))
      .filter((fact) => !isRequiredFactResolved(architecture, fact));
    const structural = structuralFacts(architecture, blueprint);
    return [...new Map([...existing, ...structural].map((fact) => [fact.key, fact])).values()];
  });
}

export function reconcileCommercialArchitectureRequirements(input: CommercialArchitecture) {
  const normalized = normalizeCommercialArchitecture(input);
  const facts = deriveRequiredFacts(normalized);
  const byIntent = new Map(normalized.journeyBlueprints.map((blueprint) => [blueprint.intentId, blueprint]));
  const journeyBlueprints = normalized.journeyBlueprints.map((blueprint) => ({
    ...blueprint,
    requiredFacts: facts.filter((fact) => {
      const target = fact.resolutionTarget;
      return target && blueprintForTarget(normalized, target)?.id === byIntent.get(blueprint.intentId)?.id;
    }),
  }));
  const blocking = facts.some((fact) => fact.severity === "blocking");
  return normalizeCommercialArchitecture({
    ...normalized,
    status: blocking ? "needs_confirmation" : normalized.status === "degraded" ? "degraded" : "ready",
    journeyBlueprints,
  });
}

function answerString(answer: unknown) {
  return typeof answer === "string" ? answer.trim() : "";
}

function mappingAnswers(architecture: CommercialArchitecture, target: Extract<ArchitectureResolutionTarget, { type: "location_channel_mapping" }>, answer: unknown) {
  const entries: Array<{ locationId: string; value: string }> = [];
  if (Array.isArray(answer)) {
    for (const item of answer) if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      if (typeof row.locationId === "string" && typeof (row.value ?? row.phone ?? row.url) === "string") entries.push({ locationId: row.locationId, value: String(row.value ?? row.phone ?? row.url) });
    }
  } else if (answer && typeof answer === "object") {
    for (const [locationId, value] of Object.entries(answer as Record<string, unknown>)) if (typeof value === "string") entries.push({ locationId, value });
  } else if (typeof answer === "string") {
    for (const line of answer.split(/\r?\n/)) {
      const [label, ...rest] = line.split(/[:=]/);
      const location = architecture.locations.find((item) => item.id === label.trim() || item.label.toLowerCase() === label.trim().toLowerCase());
      if (location && rest.join(":").trim()) entries.push({ locationId: location.id, value: rest.join(":").trim() });
    }
  }
  return entries.filter((entry) => target.locationIds.length === 0 || target.locationIds.includes(entry.locationId));
}

export function resolveArchitectureRequirement(input: {
  architecture: CommercialArchitecture;
  requirement: RequiredFact;
  answer: unknown;
  existingProjectData?: Project["commercialConfig"];
  sourceId?: string;
}): { architecture: CommercialArchitecture; resolved: boolean; warnings: string[] } {
  const architecture = normalizeCommercialArchitecture(input.architecture);
  const target = targetFor(architecture, input.requirement);
  if (!target) return { architecture, resolved: false, warnings: ["O blocker não possui um destino semântico reconhecido."] };
  const blueprint = blueprintForTarget(architecture, target);
  if (!blueprint) return { architecture, resolved: false, warnings: ["A jornada ligada ao blocker não existe mais."] };
  const evidence = { sourceId: input.sourceId || "activation-answer", origin: "user" as const, excerpt: "Informação confirmada durante a Activation.", confidence: 1 };
  let patched = architecture;
  const warnings: string[] = [];

  if (target.type === "channel_value" || target.type === "external_url") {
    const value = answerString(input.answer);
    const channelType = target.type === "external_url" ? "external_url" : target.channelType;
    const normalizedValue = channelType === "whatsapp" || channelType === "phone" ? validateSetupPhone(value).normalized : value;
    const valid = channelType === "external_url" ? validHttpUrl(value)
      : channelType === "whatsapp" || channelType === "phone" ? Boolean(validateSetupPhone(value).valid && normalizedValue)
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!valid) return { architecture, resolved: false, warnings: [channelType === "external_url" ? "Informe uma URL completa iniciada por http:// ou https://." : "Informe um destino válido."] };
    const channelId = target.type === "channel_value" && target.channelId
      ? target.channelId
      : blueprint.completion.channelId || `channel-${channelType}-${blueprint.intentId}`;
    const existing = architecture.channels.find((item) => item.id === channelId);
    const channel = { id: channelId, type: channelType, label: existing?.label || (channelType === "external_url" ? `Link de ${blueprint.objective}` : `Contato de ${blueprint.objective}`), value: normalizedValue || value, purpose: existing?.purpose || blueprint.objective, isFallback: existing?.isFallback || false, evidence: [...(existing?.evidence || []), evidence], confidence: 1 };
    patched = {
      ...architecture,
      channels: [...architecture.channels.filter((item) => item.id !== channelId), channel],
      journeyBlueprints: architecture.journeyBlueprints.map((item) => item.id === blueprint.id ? { ...item, completion: { ...item.completion, type: channelType, channelId, destinationStrategy: channelType === "external_url" ? "external_url" : "fixed" } } : item),
    };
  } else if (target.type === "location_channel_mapping") {
    const mappings = mappingAnswers(architecture, target, input.answer);
    if (!mappings.length) return { architecture, resolved: false, warnings: ["Associe cada unidade ao seu destino usando o ID ou nome da unidade."] };
    const channels = [...architecture.channels];
    const locations = architecture.locations.map((location) => {
      const mapping = mappings.find((item) => item.locationId === location.id);
      if (!mapping) return location;
      const value = target.channelType === "external_url" || target.channelType === "email" ? mapping.value.trim() : validateSetupPhone(mapping.value).normalized;
      const valid = target.channelType === "external_url" ? validHttpUrl(value) : target.channelType === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "") : Boolean(validateSetupPhone(mapping.value).valid && value);
      if (!valid) { warnings.push(`O destino de ${location.label} é inválido.`); return location; }
      const channelId = `channel-${target.channelType}-${location.id}`;
      const channel = { id: channelId, type: target.channelType, label: `${target.channelType === "external_url" ? "Link" : target.channelType === "whatsapp" ? "WhatsApp" : target.channelType === "phone" ? "Telefone" : "E-mail"} · ${location.label}`, value: value || mapping.value, purpose: `Atendimento da unidade ${location.label}`, isFallback: false, evidence: [...location.evidence, evidence], confidence: 1 };
      const index = channels.findIndex((item) => item.id === channelId);
      if (index >= 0) channels[index] = channel; else channels.push(channel);
      return { ...location, channelIds: [...new Set([...location.channelIds.filter((id) => id !== channelId), channelId])], evidence: [...location.evidence, evidence], confidence: 1 };
    });
    patched = { ...architecture, channels, locations, journeyBlueprints: architecture.journeyBlueprints.map((item) => item.id === blueprint.id ? { ...item, completion: { ...item.completion, type: target.channelType } } : item) };
  } else if (target.type === "completion_strategy") {
    const strategy = answerString(input.answer) as Blueprint["completion"]["destinationStrategy"];
    if (!target.acceptedStrategies.includes(strategy)) return { architecture, resolved: false, warnings: ["Escolha uma estratégia de conclusão aceita para esta jornada."] };
    patched = { ...architecture, journeyBlueprints: architecture.journeyBlueprints.map((item) => item.id === blueprint.id ? { ...item, completion: { ...item.completion, type: strategy === "native" ? "native" : item.completion.type, destinationStrategy: strategy } } : item) };
  } else if (target.type === "required_field") {
    if (!answerString(input.answer)) return { architecture, resolved: false, warnings: ["Informe o campo necessário para continuar."] };
    patched = { ...architecture, journeyBlueprints: architecture.journeyBlueprints.map((item) => item.id === blueprint.id ? { ...item, steps: item.steps.map((step, index) => index === 0 ? { ...step, collects: [...new Set([...step.collects, target.fieldKey])] } : step) } : item) };
  }

  const reconciled = reconcileCommercialArchitectureRequirements(patched);
  return { architecture: reconciled, resolved: isRequiredFactResolved(reconciled, { ...input.requirement, resolutionTarget: target }), warnings };
}

export interface ArchitectureMaterializationIssue { code: string; message: string; blueprintId?: string }

export function validateCommercialArchitectureForMaterialization(architecture: CommercialArchitecture, projectData?: Project["commercialConfig"]) {
  const normalized = normalizeCommercialArchitecture(architecture);
  const issues: ArchitectureMaterializationIssue[] = [];
  const blueprintIntentIds = new Set(normalized.journeyBlueprints.map((item) => item.intentId));
  for (const intent of normalized.intents.filter((item) => item.visibleOnEntry)) if (!blueprintIntentIds.has(intent.id)) issues.push({ code: "intent_without_blueprint", message: `O caminho “${intent.label}” ainda não possui uma jornada.` });
  for (const blueprint of normalized.journeyBlueprints) {
    const channel = normalized.channels.find((item) => item.id === blueprint.completion.channelId);
    if (blueprint.completion.destinationStrategy === "fixed" && (channel?.type !== blueprint.completion.type || !validCommercialChannel(channel))) issues.push({ code: "invalid_fixed_destination", blueprintId: blueprint.id, message: `O destino de “${blueprint.objective}” não é compatível com completion.type=${blueprint.completion.type}.` });
    if (blueprint.completion.destinationStrategy === "external_url" && (blueprint.completion.type !== "external_url" || channel?.type !== "external_url" || !validCommercialChannel(channel))) issues.push({ code: "invalid_external_url", blueprintId: blueprint.id, message: `O link de “${blueprint.objective}” ainda não é válido.` });
    if (blueprint.completion.destinationStrategy === "by_location") {
      const locationIds = [...new Set(blueprint.steps.flatMap((step) => step.usesLocations))];
      const usedLocationIds = locationIds.length ? locationIds : normalized.locations.map((item) => item.id);
      const unresolved = usedLocationIds.map((selectedLocationId) => resolveCompletionDestination({ architecture: normalized, blueprint, selectedLocationId })).find((result) => result.status !== "resolved");
      if (unresolved) issues.push({ code: "incomplete_location_mapping", blueprintId: blueprint.id, message: `${unresolved.reason} Corrija “${blueprint.objective}” antes de materializar.` });
    }
    if (blueprint.completion.destinationStrategy === "by_answer") issues.push({ code: "missing_answer_routing", blueprintId: blueprint.id, message: `A regra que decide o destino de “${blueprint.objective}” ainda não foi materializada.` });
    const hasHandoffContext = blueprint.steps.some((step) => step.collects.length || ["catalog_order", "qualification", "quote", "routing"].includes(step.expectedCapability || ""));
    if (blueprint.completion.handoffSummary && !hasHandoffContext) issues.push({ code: "handoff_without_fields", blueprintId: blueprint.id, message: `“${blueprint.objective}” pede resumo, mas não coleta informações para o handoff.` });
    if (["scheduling", "reservation"].includes(blueprint.mode) && blueprint.completion.destinationStrategy === "native") {
      const backed = blueprint.mode === "scheduling"
        ? Boolean(projectData?.schedulableServices?.some((item) => item.isActive) && projectData?.availabilityRules?.length)
        : Boolean(projectData?.reservableUnits?.some((item) => item.isActive) && projectData?.availabilityRules?.length);
      if (projectData && !backed) issues.push({ code: "unbacked_availability", blueprintId: blueprint.id, message: `“${blueprint.objective}” não possui dados confiáveis de disponibilidade.` });
    }
  }
  for (const fact of deriveRequiredFacts(normalized).filter((item) => item.severity === "blocking")) issues.push({ code: "blocking_fact", message: fact.reason });
  return { valid: issues.length === 0, issues: [...new Map(issues.map((issue) => [`${issue.code}:${issue.blueprintId || issue.message}`, issue])).values()] };
}
