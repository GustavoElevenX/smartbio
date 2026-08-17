"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PublicActivation } from "@/features/activations/activation.types";
import { useConversionLauncher } from "@/components/public-presence/conversion-launcher";
import { ActivationAnnouncementBar } from "./activation-announcement-bar";
import { ActivationFloatingCta } from "./activation-floating-cta";
import { ActivationClaimDialog } from "./activation-claim-dialog";

interface RuntimeValue {
  startActivation: (activationId: string) => void;
  activations: PublicActivation[];
  claim?: { id: string; code: string; benefitLabel: string; expiresAt?: string };
}

const Context = createContext<RuntimeValue | null>(null);
export const useActivationRuntime = () => useContext(Context);

function runtimeId(projectId: string) {
  const key = `virou:session:${projectId}`;
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  sessionStorage.setItem(key, next);
  return next;
}

export function ActivationRuntimeProvider({ projectId, pageId, activations, children }: { projectId: string; pageId: string; activations: PublicActivation[]; children: ReactNode }) {
  const launcher = useConversionLauncher();
  const [pending, setPending] = useState<PublicActivation>();
  const [claim, setClaim] = useState<RuntimeValue["claim"]>();

  useEffect(() => {
    for (const activation of activations) {
      const key = `virou:activation-viewed:${runtimeId(projectId)}:${pageId}:${activation.id}`;
      if (sessionStorage.getItem(key)) continue;
      sessionStorage.setItem(key, "1");
      launcher.track("activation_viewed", { activationId: activation.id, pageId, placementTypes: activation.placements.map((item) => item.placementType) });
    }
  }, [activations, launcher, pageId, projectId]);

  const startActivation = useCallback((activationId: string) => {
    const activation = activations.find((item) => item.id === activationId);
    if (!activation) return;
    launcher.track("activation_cta_clicked", { activationId, pageId });
    launcher.track("activation_started", { activationId, pageId });
    if (activation.requiresIdentity) {
      setPending(activation);
      return;
    }
    launcher.open({ goalId: activation.conversionGoalId, activationId, pageId });
  }, [activations, launcher, pageId]);

  const value = useMemo(() => ({ startActivation, activations, claim }), [startActivation, activations, claim]);
  const placements = activations.flatMap((activation) => activation.placements.map((placement) => ({ activation, placement })));
  const announcement = placements.filter((item) => item.placement.placementType === "announcement_bar").toSorted((a, b) => b.placement.priority - a.placement.priority)[0];
  const floating = placements.filter((item) => item.placement.placementType === "floating_cta").toSorted((a, b) => b.placement.priority - a.placement.priority)[0];

  return <Context.Provider value={value}>
    {announcement ? <ActivationAnnouncementBar activation={announcement.activation} content={announcement.placement.content} onClick={() => startActivation(announcement.activation.id)} /> : null}
    {children}
    {floating ? <ActivationFloatingCta activation={floating.activation} content={floating.placement.content} onClick={() => startActivation(floating.activation.id)} /> : null}
    {pending ? <ActivationClaimDialog activation={pending} projectId={projectId} sessionId={runtimeId(projectId)} pageId={pageId} onClose={() => setPending(undefined)} onContinueWithoutBenefit={() => { const activation = pending; setPending(undefined); launcher.open({ goalId: activation.conversionGoalId, activationId: activation.id, pageId }); }} onSuccess={(next) => { setClaim(next); setPending(undefined); launcher.open({ goalId: pending.conversionGoalId, activationId: pending.id, benefitClaimId: next.id, benefitClaimCode: next.code, pageId }); }} /> : null}
  </Context.Provider>;
}
