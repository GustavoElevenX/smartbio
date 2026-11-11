import type { Project } from "@/types";
import type { PublicActivation } from "@/features/activations/activation.types";
import { activationCampaignDraft } from "@/features/activations/activation-campaign-draft";
import { campaignLocalTimeToIso } from "@/features/activations/campaign-timezone";
import { businessCampaignTimezone } from "@/features/activations/business-campaign-timezone";
import { CampaignExperience } from "@/components/public-campaign/campaign-experience";
import type { ActivationBuilderState } from "./activation-builder-types";

export function ActivationCampaignPreview({ project, state }: { project: Project | null; state: ActivationBuilderState }) {
  const surface = activationCampaignDraft({ name: state.name, title: state.title, message: state.message,
    conditions: state.offerDescription, conversionGoalId: state.conversionGoalId, mode: state.surfaceMode });
  if (!project || !surface) return <p className="rounded-xl bg-[#f1f7ff] p-5 text-sm">Escolha um título e uma ação principal para visualizar a página da campanha.</p>;
  const timezone = businessCampaignTimezone(project, state.locationIds);
  let endsAt: string | undefined;
  try { endsAt = state.endsAt ? campaignLocalTimeToIso(state.endsAt, timezone) : undefined; } catch { endsAt = undefined; }
  const hasPercentage = state.offerType === "percentage_discount" && Number(state.percentage) > 0 && Number(state.percentage) <= 100;
  const hasAmount = state.offerType === "fixed_discount" && Number(state.amount) > 0;
  const label = hasPercentage ? `${state.percentage}% OFF` : hasAmount ? `R$ ${state.amount} OFF` : undefined;
  const activation: PublicActivation = {
    id: "preview", activationKey: surface.experienceKey, name: state.name || surface.title,
    title: surface.title, message: surface.message, activationType: state.activationType,
    conversionGoalId: surface.conversionGoalId, defaultDestinationId: state.defaultDestinationId || undefined,
    requiresIdentity: false, identityMode: "none", completionChannel: state.completionChannel,
    timezone, endsAt, placements: [],
    offer: !label ? undefined : { id: "preview-offer", offerType: state.offerType, label,
      description: state.offerDescription, currency: "BRL", scope: {} },
  };
  return <div className="overflow-hidden rounded-2xl border border-[#d7e1ec]"><CampaignExperience project={project} surface={surface} activation={activation} preview /></div>;
}
