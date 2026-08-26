import type { CommercialArchitecture } from "@/features/ai-setup/ai-setup.schema";
import type { ProjectCommercialContext } from "@/features/commercial-context/project-commercial-context.schema";
import type { Project } from "@/types";

export interface CommercialRuntimeConsistencyIssue {
  code: string;
  message: string;
  referenceId?: string;
}

function validUrl(value: string | null | undefined) {
  try { return ["http:", "https:"].includes(new URL(value || "").protocol); } catch { return false; }
}

export function validateCommercialRuntimeConsistency(input: {
  context: ProjectCommercialContext;
  project: Project;
  architecture?: CommercialArchitecture;
}) {
  const { context, project, architecture } = input;
  const issues: CommercialRuntimeConsistencyIssue[] = [];
  const destinations = project.commercialConfig?.routingDestinations || [];
  const destinationIds = new Set(destinations.map((item) => item.id));
  const locations = project.commercialConfig?.locations || [];
  for (const location of context.locationContexts) for (const destinationId of location.destinationIds) {
    if (!destinationIds.has(destinationId)) issues.push({ code: "missing_location_destination", referenceId: location.locationId, message: `A unidade ${location.locationId} referencia um destino inexistente.` });
  }
  for (const channel of context.channelContexts) {
    if (channel.destinationId && !destinationIds.has(channel.destinationId)) issues.push({ code: "missing_channel_destination", referenceId: channel.id, message: `O canal ${channel.id} referencia um destino inexistente.` });
    if (channel.externalUrl && !validUrl(channel.externalUrl)) issues.push({ code: "invalid_external_url", referenceId: channel.id, message: `O canal ${channel.id} possui uma URL externa inválida.` });
  }
  for (const location of locations) if (location.routingDestinationId && !destinationIds.has(location.routingDestinationId)) issues.push({ code: "missing_runtime_location_destination", referenceId: location.id, message: `A unidade ${location.name} não consegue resolver seu destination.` });

  if (architecture) {
    const channelIds = new Set(architecture.channels.map((item) => item.id));
    const blueprintIds = new Set(architecture.journeyBlueprints.map((item) => item.id));
    const blueprintIntentIds = new Set(architecture.journeyBlueprints.map((item) => item.intentId));
    for (const blueprint of architecture.journeyBlueprints) {
      if (blueprint.completion.channelId && !channelIds.has(blueprint.completion.channelId)) issues.push({ code: "missing_blueprint_channel", referenceId: blueprint.id, message: `A jornada ${blueprint.id} aponta para um canal ausente.` });
      if (blueprint.completion.destinationStrategy === "by_location") {
        const used = [...new Set(blueprint.steps.flatMap((step) => step.usesLocations))];
        const mapped = (used.length ? used : architecture.locations.map((item) => item.id)).every((locationId) => {
          const operational = locations.find((item) => item.id === locationId);
          return Boolean(operational?.routingDestinationId && destinationIds.has(operational.routingDestinationId));
        });
        if (!mapped) issues.push({ code: "incomplete_by_location", referenceId: blueprint.id, message: `A jornada ${blueprint.id} não possui mapping completo por unidade.` });
      }
      const hasHandoffContext = blueprint.steps.some((step) => step.collects.length || ["catalog_order", "qualification", "quote", "routing"].includes(step.expectedCapability || ""));
      if (blueprint.completion.handoffSummary && !hasHandoffContext) issues.push({ code: "handoff_without_collection", referenceId: blueprint.id, message: `A jornada ${blueprint.id} configura handoff sem coletar respostas.` });
      if (blueprint.mode === "scheduling" && blueprint.completion.destinationStrategy === "native" && !(project.commercialConfig?.schedulableServices?.some((item) => item.isActive) && project.commercialConfig?.availabilityRules?.length)) issues.push({ code: "scheduling_without_backing", referenceId: blueprint.id, message: `A jornada ${blueprint.id} afirma scheduling nativo sem disponibilidade confiável.` });
      if (blueprint.mode === "reservation" && blueprint.completion.destinationStrategy === "native" && !(project.commercialConfig?.reservableUnits?.some((item) => item.isActive) && project.commercialConfig?.availabilityRules?.length)) issues.push({ code: "reservation_without_backing", referenceId: blueprint.id, message: `A jornada ${blueprint.id} afirma reserva nativa sem disponibilidade confiável.` });
    }
    for (const intent of architecture.intents) if (!blueprintIntentIds.has(intent.id)) issues.push({ code: "intent_without_blueprint", referenceId: intent.id, message: `A intenção ${intent.label} não possui blueprint.` });
    for (const mechanism of context.purchaseMechanisms) if (mechanism.journeyBlueprintId && !blueprintIds.has(mechanism.journeyBlueprintId)) issues.push({ code: "context_blueprint_missing", referenceId: mechanism.id, message: `O contexto usa uma jornada que não existe mais.` });
  }
  return { valid: issues.length === 0, issues };
}
