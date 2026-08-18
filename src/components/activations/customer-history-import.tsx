"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Database, FileSpreadsheet, Loader2, Upload } from "lucide-react";

interface Source { id: string; name: string; type: string; status: string; extractedData?: { csvPreview?: { headers: string[]; rows: string[][]; ambiguous?: boolean } } }

export function CustomerHistoryImport({ projectId }: { projectId: string }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [mapping, setMapping] = useState({ phoneColumn: "", emailColumn: "", externalIdColumn: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = useMemo(() => sources.find((item) => item.id === selectedId), [selectedId, sources]);
  const preview = selected?.extractedData?.csvPreview;

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/sources`);
    const payload = await response.json() as { data?: Source[] };
    setSources((payload.data || []).filter((item) => item.type === "csv" && item.status === "processed"));
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setMessage("");
    const data = new FormData(); data.set("file", file); data.set("projectId", projectId);
    const response = await fetch("/api/ai/sources/upload", { method: "POST", body: data });
    const payload = await response.json() as { data?: { id: string }; error?: { message?: string } };
    if (!response.ok) setMessage(payload.error?.message || "Não foi possível enviar o CSV.");
    else { await refresh(); setSelectedId(payload.data?.id || ""); setMessage("CSV processado. Agora confirme as colunas."); }
    setBusy(false);
  }

  async function importRows() {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/projects/${projectId}/customer-history/import`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceId: selectedId, ...mapping }) });
    const payload = await response.json() as { data?: { imported: number; skipped: number }; error?: { message?: string } };
    setMessage(response.ok ? `${payload.data?.imported || 0} clientes reconhecidos; ${payload.data?.skipped || 0} linhas ignoradas.` : payload.error?.message || "Não foi possível importar.");
    setBusy(false);
  }

  const options = preview?.headers || [];
  return <div className="grid gap-6 xl:grid-cols-[.82fr_1.18fr]">
    <section className="rounded-[24px] border border-[#e4e2ed] bg-white p-6 shadow-[0_16px_50px_rgba(51,45,84,.06)]">
      <span className="grid size-12 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0054fc]"><Database size={22} /></span>
      <h2 className="mt-5 text-2xl font-extrabold tracking-[-.035em]">Base histórica de clientes</h2>
      <p className="mt-2 text-sm leading-6 text-[#6f6d79]">Use um CSV verificado para reconhecer primeira compra, recorrência e elegibilidade. O arquivo não cria oferta nem comunica clientes.</p>
      <label className="mt-6 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#9fc3ff] bg-[#f7fbff] px-4 font-bold text-[#0054fc]">{busy ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />} Enviar CSV<input className="sr-only" type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} /></label>
      <div className="mt-5 space-y-2">{sources.map((source) => <button key={source.id} type="button" onClick={() => { setSelectedId(source.id); setMapping({ phoneColumn: "", emailColumn: "", externalIdColumn: "" }); }} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left ${selectedId === source.id ? "border-[#0054fc] bg-[#f7fbff]" : "border-[#e5e3eb]"}`}><FileSpreadsheet size={18} /><span className="min-w-0 flex-1 truncate text-sm font-bold">{source.name}</span>{selectedId === source.id ? <CheckCircle2 size={18} className="text-[#0054fc]" /> : null}</button>)}</div>
    </section>
    <section className="rounded-[24px] border border-[#e4e2ed] bg-white p-6 shadow-[0_16px_50px_rgba(51,45,84,.06)]">
      <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#0054fc]">Mapeamento seguro</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-.035em]">Confirme como identificar cada cliente</h2>
      {preview ? <>{preview.ambiguous ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">O CSV tem cabeçalhos ambíguos. Revise o mapeamento antes de importar.</p> : null}<div className="mt-6 grid gap-4 sm:grid-cols-3">{([['phoneColumn','Telefone'],['emailColumn','E-mail'],['externalIdColumn','ID externo']] as const).map(([key,label]) => <label key={key} className="text-sm font-bold">{label}<select value={mapping[key]} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 min-h-12 w-full rounded-xl border border-[#dcd9e7] bg-white px-3 font-normal"><option value="">Não mapear</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>)}</div><div className="mt-6 overflow-x-auto rounded-xl border border-[#e6e4eb]"><table className="min-w-full text-left text-xs"><thead className="bg-[#f5f4f8]"><tr>{options.map((header) => <th key={header} className="px-3 py-3 font-bold">{header}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 5).map((row, index) => <tr key={index} className="border-t border-[#eceaf0]">{row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-48 truncate px-3 py-3 text-[#66646f]">{cell || "—"}</td>)}</tr>)}</tbody></table></div><button type="button" disabled={busy || (!mapping.phoneColumn && !mapping.emailColumn)} onClick={() => void importRows()} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0054fc] px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}Confirmar importação</button></> : <div className="mt-8 rounded-2xl bg-[#f5f4f8] p-8 text-center text-sm text-[#75727d]">Selecione ou envie um CSV para visualizar e mapear as colunas.</div>}
      {message ? <p aria-live="polite" className="mt-4 rounded-xl bg-[#eaf3ff] p-3 text-sm font-semibold text-[#0054fc]">{message}</p> : null}
    </section>
  </div>;
}
