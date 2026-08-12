"use client";

import { ArrowRight, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PresenceAction, PresenceLaunchContext } from "@/features/presence/presence.types";
import { useConversionLauncher } from "./conversion-launcher";

const styles = {
  primary: "bg-[var(--presence-primary)] text-white shadow-lg shadow-black/10 hover:-translate-y-0.5",
  secondary: "border border-black/15 bg-white/85 text-[var(--presence-fg)] hover:border-black/30",
  ghost: "bg-black/5 text-[var(--presence-fg)] hover:bg-black/10",
  link: "px-0 text-[var(--presence-primary)] underline-offset-4 hover:underline",
};

export function PresenceActionButton({ action, context, pageHref, className = "" }: { action: PresenceAction; context: PresenceLaunchContext; pageHref?: string; className?: string }) {
  const launcher = useConversionLauncher();
  const router = useRouter();
  function act() {
    launcher.track("presence_cta_clicked", { ...context, label: action.analyticsLabel || action.label, actionType: action.type });
    if (action.type === "start_conversion_goal") return launcher.open({ ...context, goalId: action.conversionGoalId });
    if (action.type === "scroll_to_section" && action.anchor) return document.getElementById(action.anchor)?.scrollIntoView({ behavior: "smooth" });
    if (action.type === "go_to_presence_page" && pageHref) return router.push(pageHref);
    if (action.type === "open_url" && action.url) return window.open(action.url, "_blank", "noopener,noreferrer");
    if (action.type === "open_whatsapp" && action.whatsappPhone) {
      const phone = action.whatsappPhone.replace(/\D/g, "");
      return window.open(`https://wa.me/${phone}?text=${encodeURIComponent(action.whatsappMessage || "")}`, "_blank", "noopener,noreferrer");
    }
  }
  const Icon = action.type === "open_whatsapp" ? MessageCircle : ArrowRight;
  return <button type="button" onClick={act} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--presence-primary)]/25 ${styles[action.style || "primary"]} ${className}`}>{action.label}<Icon size={17} aria-hidden /></button>;
}
