"use client";

import { useEffect, useRef } from "react";
import type { PlatformEventName } from "@/server/platform-acquisition/platform-acquisition";

export function trackMarketingEvent(
  eventName: PlatformEventName,
  input: { elementKey?: string; metadata?: Record<string, string | number | boolean>; idempotencyKey?: string } = {},
) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  void fetch("/api/platform/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      eventName,
      path: `${window.location.pathname}${window.location.search}`.slice(0, 500),
      elementKey: input.elementKey,
      metadata: input.metadata,
      idempotencyKey: input.idempotencyKey,
      referrer: document.referrer || "",
      utm: {
        source: params.get("utm_source") || undefined,
        medium: params.get("utm_medium") || undefined,
        campaign: params.get("utm_campaign") || undefined,
        content: params.get("utm_content") || undefined,
        term: params.get("utm_term") || undefined,
      },
    }),
  }).catch(() => undefined);
}

export function MarketingAnalytics({ pageViewEvent = "marketing_page_viewed" }: { pageViewEvent?: PlatformEventName }) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    const pageKey = `sobe:page:${pageViewEvent}:${location.pathname}:${location.search}`;
    if (!sessionStorage.getItem(pageKey)) {
      sessionStorage.setItem(pageKey, "1");
      trackMarketingEvent(pageViewEvent, { idempotencyKey: crypto.randomUUID() });
    }
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-track]") : null;
      const elementKey = target?.dataset.track;
      if (elementKey) trackMarketingEvent("marketing_cta_clicked", { elementKey, idempotencyKey: crypto.randomUUID() });
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [pageViewEvent]);
  return null;
}
