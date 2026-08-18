"use client";

import { Check, LoaderCircle, Palette, RefreshCw, Sparkles, Upload } from "lucide-react";
import { useState } from "react";
import type { BrandIdentity } from "@/features/ai-setup/ai-setup.schema";

interface BrandIdentityUploaderProps {
  brand?: BrandIdentity;
  previewUrl?: string;
  businessName: string;
  businessDescription: string;
  disabled?: boolean;
  onChange: (brand: BrandIdentity, previewUrl: string) => void;
}

function readPreview(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível abrir a prévia da logo."));
    reader.readAsDataURL(file);
  });
}

export function BrandIdentityUploader({ brand, previewUrl, businessName, businessDescription, disabled, onChange }: BrandIdentityUploaderProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function analyze(file?: File) {
    if (!file) return;
    setProcessing(true);
    setError("");
    try {
      const preview = await readPreview(file);
      const body = new FormData();
      body.set("logo", file);
      body.set("businessName", businessName);
      body.set("businessDescription", businessDescription);
      const response = await fetch("/api/ai/brand/analyze", { method: "POST", body });
      const payload = await response.json() as { data?: BrandIdentity; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message || "Não foi possível analisar a identidade da marca.");
      onChange(payload.data, preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível analisar a logo.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section aria-labelledby="brand-identity-title" className="overflow-hidden rounded-2xl bg-[#07172f] text-white">
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_210px] sm:p-6">
        <div>
          <div className="flex items-center gap-2 text-[#02e5cd]"><Palette size={17} /><h2 id="brand-identity-title" className="text-sm font-extrabold text-white">Logo e identidade visual</h2></div>
          <p className="mt-2 max-w-[58ch] text-xs leading-5 text-[#c7d2e2]">Envie a logo para a Sobe identificar as cores, verificar contraste e pedir à IA uma direção visual coerente com a marca.</p>
          {brand ? (
            <div className="mt-5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#9ff7e9]"><Check size={15} /> Paleta aplicada à prévia</div>
              <div className="mt-3 flex gap-2" aria-label="Cores extraídas da logo">
                {brand.extractedColors.map((color) => <span key={color} title={color} className="size-9 rounded-xl border border-white/15 shadow-[0_6px_16px_rgba(0,0,0,.2)]" style={{ backgroundColor: color }} />)}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-[#aebed2]">{brand.visualDirection} Você poderá trocar a direção ou editar cada cor depois no Brand Studio.</p>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-2 text-xs text-[#9fb0c6]"><Sparkles size={15} className="text-[#01d2df]" /> A paleta entra automaticamente no primeiro rascunho.</div>
          )}
        </div>
        <label className="focus-within:ring-4 focus-within:ring-[#02e5cd]/25 flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl bg-white p-4 text-center text-[#07172f] shadow-[0_18px_45px_rgba(0,0,0,.22)]">
          {processing ? <LoaderCircle className="animate-spin text-[#0054fc]" /> : previewUrl ? <img src={previewUrl} alt="Prévia da logo enviada" className="max-h-24 max-w-full object-contain" /> : <span className="grid size-11 place-items-center rounded-xl bg-[#eaf3ff] text-[#0054fc]"><Upload size={19} /></span>}
          <strong className="mt-3 text-xs">{processing ? "Analisando logo…" : brand ? "Trocar logo" : "Enviar logo"}</strong>
          <span className="mt-1 text-[10px] leading-4 text-[#697588]">PNG, JPG, WebP ou SVG · até 5 MB</span>
          {brand && !processing ? <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#0054fc]"><RefreshCw size={11} /> Reanalisar</span> : null}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" disabled={disabled || processing} onChange={(event) => { void analyze(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        </label>
      </div>
      {error ? <p role="alert" className="border-t border-[#ff7b72]/25 bg-[#391c28] px-5 py-3 text-xs font-semibold text-[#ffd4d1]">{error} Selecione o arquivo novamente para tentar de novo.</p> : null}
    </section>
  );
}
