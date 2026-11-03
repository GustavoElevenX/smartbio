"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { normalizeExternalUrl, safeExternalUrl } from "@/lib/external-url";

const inputClassName =
  "mt-1 min-h-11 w-full rounded-xl border border-[#d7e1ec] bg-white px-3 text-base outline-none focus:border-[#0054fc] focus:ring-4 focus:ring-[#0054fc]/10 sm:text-sm";

export function ExternalLinkField({ id, value, onChange, className = "" }: { id: string; value?: string; onChange(value?: string): void; className?: string }) {
  const [touched, setTouched] = useState(false);
  const safeUrl = safeExternalUrl(value);
  const invalid = touched && Boolean(value?.trim()) && !safeUrl;

  return <div className={className}>
    <label htmlFor={id} className="block text-xs font-extrabold text-[#536178]">Link de destino</label>
    <input
      id={id}
      className={`${inputClassName} ${invalid ? "border-red-500 focus:border-red-500 focus:ring-red-500/10" : ""}`}
      type="url"
      inputMode="url"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      placeholder="exemplo.com/cardapio"
      value={value || ""}
      aria-invalid={invalid}
      aria-describedby={`${id}-hint`}
      onChange={(event) => onChange(event.target.value || undefined)}
      onBlur={(event) => {
        setTouched(true);
        const normalized = normalizeExternalUrl(event.target.value);
        if (normalized !== event.target.value) onChange(normalized || undefined);
      }}
    />
    <div id={`${id}-hint`} className="mt-1.5 flex min-w-0 items-start justify-between gap-3 text-[11px] font-semibold leading-5">
      <span className={invalid ? "text-red-600" : "text-[#6c7480]"}>{invalid ? "Use um link válido, como exemplo.com ou https://exemplo.com." : "A página será aberta em uma nova aba."}</span>
      {safeUrl ? <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[#0054fc] underline decoration-[#9fc3ff] underline-offset-4">Testar <ExternalLink size={12} aria-hidden /></a> : null}
    </div>
  </div>;
}
