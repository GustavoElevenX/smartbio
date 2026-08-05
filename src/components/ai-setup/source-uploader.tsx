import { FileText, Globe2, Upload, X } from "lucide-react";

export function SourceUploader({ sources, onChange, disabled }: { sources: string[]; onChange: (sources: string[]) => void; disabled?: boolean }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#d8d5e5] bg-[#fbfaff] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong className="flex items-center gap-2 text-sm"><Globe2 size={16} className="text-[#6557df]" /> Fontes opcionais</strong>
          <p className="mt-1 text-xs leading-5 text-[#7a7984]">Adicione arquivos de referência; nenhum dado comercial será presumido.</p>
        </div>
        <label className="focus-within:ring-4 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#dedce7] bg-white px-3 text-xs font-bold text-[#575761]">
          <Upload size={15} /> Selecionar arquivos
          <input
            type="file"
            multiple
            disabled={disabled}
            accept=".pdf,.txt,.csv,.doc,.docx,image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => onChange([...new Set([...sources, ...Array.from(event.target.files || []).map((file) => file.name)])].slice(0, 10))}
          />
        </label>
      </div>
      {sources.length ? <div className="mt-3 flex flex-wrap gap-2">{sources.map((source) => (
        <span key={source} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#5f5e68] shadow-sm">
          <FileText size={13} className="text-[#6d5ef5]" /> {source}
          <button type="button" aria-label={`Remover ${source}`} onClick={() => onChange(sources.filter((item) => item !== source))} disabled={disabled}><X size={13} /></button>
        </span>
      ))}</div> : null}
    </div>
  );
}
