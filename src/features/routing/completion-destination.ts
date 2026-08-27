import { validateSetupPhone } from "@/features/ai-setup/setup-phone";
import type { CommercialArchitecture, JourneyCompletionType } from "@/features/ai-setup/ai-setup.schema";
import type { RoutingDestination } from "@/types";

type Blueprint = CommercialArchitecture["journeyBlueprints"][number];
type CommercialChannel = CommercialArchitecture["channels"][number];

export type CompletionDestinationResolution =
  | { status: "resolved"; channel: CommercialChannel; reason: string }
  | { status: "native"; reason: string }
  | { status: "incomplete" | "ambiguous"; reason: string };

export function validCommercialChannel(channel: CommercialChannel | undefined) {
  if (!channel?.value) return false;
  if (channel.type === "external_url") {
    try { return ["http:", "https:"].includes(new URL(channel.value).protocol); } catch { return false; }
  }
  if (channel.type === "whatsapp" || channel.type === "phone") return validateSetupPhone(channel.value).valid;
  if (channel.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(channel.value);
  return channel.type === "native";
}

export function routingDestinationTypeForCompletion(type: JourneyCompletionType): RoutingDestination["type"] | null {
  if (type === "external_url") return "url";
  if (type === "native") return null;
  return type;
}

export function destinationMatchesCompletion(destination: RoutingDestination | undefined, type: JourneyCompletionType) {
  const expected = routingDestinationTypeForCompletion(type);
  return Boolean(destination && expected && destination.type === expected && destination.value);
}

export function semanticJourneyRouteKey(blueprintId: string, locationId: string) {
  return `${blueprintId}:${locationId}`;
}

export function resolveCompletionDestination(input: {
  architecture: CommercialArchitecture;
  blueprint: Blueprint;
  selectedLocationId?: string;
}): CompletionDestinationResolution {
  const { architecture, blueprint, selectedLocationId } = input;
  const completion = blueprint.completion;
  if (completion.type === "native") {
    return completion.destinationStrategy === "native"
      ? { status: "native", reason: "A jornada conclui em um mecanismo nativo configurado." }
      : { status: "incomplete", reason: "Uma conclusão nativa não pode resolver um destination externo." };
  }
  if (completion.destinationStrategy === "native") return { status: "incomplete", reason: "A estratégia nativa não aceita um destination externo." };

  if (completion.destinationStrategy === "by_location") {
    if (!selectedLocationId) return { status: "incomplete", reason: "A jornada exige uma unidade selecionada." };
    const allowedLocationIds = [...new Set(blueprint.steps.flatMap((step) => step.usesLocations))];
    if (allowedLocationIds.length && !allowedLocationIds.includes(selectedLocationId)) return { status: "incomplete", reason: "A unidade selecionada não pertence a esta jornada." };
    const location = architecture.locations.find((item) => item.id === selectedLocationId);
    if (!location) return { status: "incomplete", reason: "A unidade selecionada não existe na arquitetura." };
    const candidates = [...new Set(location.channelIds)]
      .map((channelId) => architecture.channels.find((channel) => channel.id === channelId))
      .filter((channel): channel is CommercialChannel => channel?.type === completion.type && validCommercialChannel(channel));
    const explicitlySelected = completion.channelId ? candidates.find((channel) => channel.id === completion.channelId) : undefined;
    if (explicitlySelected) return { status: "resolved", channel: explicitlySelected, reason: `Destination ${completion.type} explicitamente associado à jornada e à unidade.` };
    if (candidates.length === 1) return { status: "resolved", channel: candidates[0], reason: `Único destination ${completion.type} compatível com a unidade selecionada.` };
    if (!candidates.length) return { status: "incomplete", reason: `A unidade selecionada não possui destination ${completion.type} confirmado.` };
    return { status: "ambiguous", reason: `A unidade selecionada possui mais de um destination ${completion.type}; a jornada precisa indicar qual usar.` };
  }

  if (completion.destinationStrategy === "by_answer") return { status: "incomplete", reason: "A regra que transforma respostas em destination ainda não foi materializada." };
  if (!completion.channelId) return { status: "incomplete", reason: `A jornada não indica um destination ${completion.type}.` };
  const channel = architecture.channels.find((item) => item.id === completion.channelId);
  if (channel?.type !== completion.type || !validCommercialChannel(channel)) return { status: "incomplete", reason: `O destination indicado não é compatível com completion.type=${completion.type}.` };
  return { status: "resolved", channel, reason: `Destination explícito compatível com completion.type=${completion.type}.` };
}
