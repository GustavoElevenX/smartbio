"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useConversionLauncher } from "./conversion-launcher";

export function PresenceSectionTracker({ pageId, sectionId, children }: { pageId: string; sectionId: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const launcher = useConversionLauncher();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      launcher.track("presence_section_viewed", { pageId, sectionId });
      observer.disconnect();
    }, { threshold: .35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [launcher, pageId, sectionId]);
  return <div ref={ref}>{children}</div>;
}
