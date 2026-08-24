"use client";

import { useEffect } from "react";

export type ProductSurface = "analytics" | "optimization" | "publish_readiness" | "paywall" | "public_preview";

export function SurfaceViewMarker({ surface, projectId }: { surface: ProductSurface; projectId?: string }) {
  useEffect(() => {
    void fetch("/api/product-state/surface", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface, projectId }),
    });
  }, [projectId, surface]);
  return null;
}
