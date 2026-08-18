"use client";
import { AlertCircle, FileText, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { ExtractedFactsReview } from "@/components/ai-sources/extracted-facts-review";
import { SourceList } from "@/components/ai-sources/source-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { SourceReference } from "@/features/ai-setup/ai-setup.schema";

interface SourceUploaderProps { sources: SourceReference[]; setupSessionId?: string; projectId?: string; onChange: (sources: SourceReference[]) => void; disabled?: boolean }
export function SourceUploader({ sources, setupSessionId, projectId, onChange, disabled }: SourceUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [website, setWebsite] = useState("");
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setError("");
    try {
      const uploaded: SourceReference[] = [];
      for (const file of Array.from(files).slice(0, Math.max(0, 10 - sources.length))) {
        const body = new FormData(); body.set("file", file); if (setupSessionId) body.set("setupSessionId", setupSessionId); if (projectId) body.set("projectId", projectId);
        const response = await fetch("/api/ai/sources/upload", { method: "POST", body });
        const payload = await response.json() as { data?: SourceReference; error?: string | { message?: string } };
        if (!response.ok || !payload.data) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message || `Falha ao enviar ${file.name}.`);
        uploaded.push(payload.data);
      }
      onChange([...sources, ...uploaded].slice(0, 10));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível enviar o material."); }
    finally { setUploading(false); }
  }
  async function importSite() { if (!website.trim()) return; setUploading(true); setError(""); try { const response = await fetch("/api/ai/sources/website", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: website.trim(), setupSessionId, projectId }) }); const payload = await response.json() as { data?: SourceReference; error?: string | { message?: string } }; if (!response.ok || !payload.data) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message || "Não foi possível importar o site."); onChange([...sources, payload.data].slice(0, 10)); setWebsite(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível importar o site."); } finally { setUploading(false); } }
  return <div className="rounded-2xl border border-dashed border-[#d8d5e5] bg-[#f7fbff] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="flex items-center gap-2 text-sm"><FileText size={16} className="text-[#0054fc]" /> Materiais do negócio</strong><p className="mt-1 text-xs leading-5 text-[#6d7480]">Cardápios, apresentações, PDFs, imagens e planilhas ajudam a IA a entender a operação. A logo é enviada separadamente acima.</p></div><label className="focus-within:ring-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#dedce7] bg-white px-3 text-xs font-bold text-[#575761]">{uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {uploading ? "Processando materiais" : "Adicionar materiais"}<input type="file" multiple disabled={disabled || uploading} accept="application/pdf,text/plain,text/csv,image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { void upload(event.target.files); event.currentTarget.value = ""; }} /></label></div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><Input type="url" aria-label="Site para importar" placeholder="https://site-do-negocio.com.br" value={website} onChange={(event) => setWebsite(event.target.value)} disabled={disabled || uploading} /><Button type="button" variant="secondary" disabled={!website.trim() || disabled || uploading} onClick={() => void importSite()}>Importar site</Button></div>{error ? <p role="alert" className="mt-3 flex items-center gap-2 text-xs font-semibold text-red-600"><AlertCircle size={14} />{error}</p> : null}{sources.length ? <div className="mt-3"><SourceList sources={sources} onRemove={(id) => onChange(sources.filter((item) => item.id !== id))} disabled={disabled} /><ExtractedFactsReview sourceIds={sources.filter((source) => source.status === "processed").map((source) => source.id)} projectId={projectId} /></div> : null}</div>;
}
