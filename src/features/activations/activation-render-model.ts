import type { PresencePage } from "@/features/presence/presence.types";
import type { ConversionActivation } from "./activation.types";
import { effectiveActivationStatus } from "./activation-engine";
import { resolvePlacementConflicts } from "./activation-conflicts";
export function buildActivationRenderModel(page: PresencePage, activations: ConversionActivation[], now = new Date()) { const active = activations.filter((activation) => effectiveActivationStatus(activation, now) === "active" && activation.publishedAt).filter((activation) => !activation.entryPointIds?.length || true); const pageActivations = active.map((activation) => ({ ...activation, placements: activation.placements.filter((placement) => !placement.presencePageId || placement.presencePageId === page.id) })); const { placements, conflicts } = resolvePlacementConflicts(pageActivations); return { page, activations: pageActivations, placements, conflicts }; }
