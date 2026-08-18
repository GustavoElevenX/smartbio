"use client";

import { ArrowDown, ArrowUp, Copy, GripVertical, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { formFieldIssues, formFieldKey } from "@/features/forms/form-field-utils";
import type { FormField, JourneyStep, Project } from "@/types";

const fieldTypes: Array<{ value: FormField["type"]; label: string }> = [
  { value: "text", label: "Texto curto" }, { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone / WhatsApp" }, { value: "number", label: "Número" },
  { value: "textarea", label: "Texto longo" }, { value: "select", label: "Lista de seleção" },
  { value: "radio", label: "Escolha única" }, { value: "checkbox", label: "Caixa de confirmação" },
  { value: "date", label: "Data" }, { value: "time", label: "Horário" },
  { value: "url", label: "Link" }, { value: "file", label: "Arquivo" },
];

function supportsFiles(project: Project) {
  return project.mediaAssets !== undefined;
}

function newField(fields: FormField[]): FormField {
  return { id: crypto.randomUUID(), label: "Novo campo", key: formFieldKey("novo campo", fields.map((field) => field.key)), type: "text", required: false, includeInHandoff: false };
}

export function FormBuilder({ project, step, onChange }: { project: Project; step: JourneyStep; onChange(step: JourneyStep): void }) {
  const fields = step.formFields || [];
  const [expandedId, setExpandedId] = useState<string | undefined>(fields[0]?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<FormField[]>();
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const availableTypes = useMemo(() => fieldTypes.filter((item) => item.value !== "file" || supportsFiles(project)), [project]);
  const replace = (next: FormField[]) => onChange({ ...step, formFields: next });
  const patch = (id: string, value: Partial<FormField>) => replace(fields.map((field) => field.id === id ? { ...field, ...value } : field));
  const move = (id: string, direction: -1 | 1) => {
    const index = fields.findIndex((field) => field.id === id);
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields]; [next[index], next[target]] = [next[target], next[index]]; replace(next);
  };
  async function suggest() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/ai/projects/${project.id}/steps/${step.id}/regenerate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ instruction: "Sugira somente os campos mínimos, úteis e não sensíveis para este formulário. Preserve o restante da etapa.", projectSnapshot: project }) });
      const payload = await response.json() as { after?: JourneyStep; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível sugerir campos.");
      const used = new Set(fields.map((field) => field.key));
      const proposed = (payload.after?.formFields || []).filter((field) => !used.has(field.key)).map((field) => ({ ...field, id: crypto.randomUUID(), includeInHandoff: field.includeInHandoff ?? false }));
      if (!proposed.length) throw new Error("A proposta não encontrou campos adicionais necessários.");
      setSuggestions(proposed); setSelectedSuggestions(new Set(proposed.map((field) => field.id)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível sugerir campos."); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 border-t border-[#e5e4eb] pt-6" aria-labelledby="form-builder-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="form-builder-title" className="text-sm font-extrabold">Campos do formulário</h3><p className="mt-1 text-xs leading-5 text-[#74747e]">Edite, ordene e escolha o que segue para o atendimento.</p></div><Button size="sm" variant="secondary" disabled={busy} onClick={() => void suggest()}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}Sugerir campos com IA</Button></div>
    {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p> : null}
    <div className="mt-4 space-y-3">
      {fields.map((field, index) => {
        const issues = formFieldIssues(field, fields); const expanded = expandedId === field.id;
        return <article key={field.id} className="rounded-2xl border border-[#e2e1e8] bg-white">
          <div className="flex items-center gap-2 p-3"><GripVertical size={16} className="shrink-0 text-[#aaa8b3]" aria-hidden="true" /><button type="button" className="min-w-0 flex-1 text-left" onClick={() => setExpandedId(expanded ? undefined : field.id)} aria-expanded={expanded}><strong className="block truncate text-sm">{field.label || "Campo sem rótulo"}</strong><span className="text-[11px] text-[#7b7984]">{fieldTypes.find((item) => item.value === field.type)?.label} · {field.required ? "obrigatório" : "opcional"}</span></button><Button size="icon" variant="ghost" aria-label="Mover campo para cima" disabled={index === 0} onClick={() => move(field.id, -1)}><ArrowUp size={14} /></Button><Button size="icon" variant="ghost" aria-label="Mover campo para baixo" disabled={index === fields.length - 1} onClick={() => move(field.id, 1)}><ArrowDown size={14} /></Button></div>
          {expanded ? <div className="grid gap-4 border-t border-[#ecebf0] p-4">
            <div><Label htmlFor={`field-label-${field.id}`}>Rótulo</Label><Input id={`field-label-${field.id}`} value={field.label} onChange={(event) => patch(field.id, { label: event.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor={`field-type-${field.id}`}>Tipo</Label><Select id={`field-type-${field.id}`} value={field.type} onChange={(event) => patch(field.id, { type: event.target.value as FormField["type"], options: ["select", "radio"].includes(event.target.value) ? field.options || ["Opção 1"] : undefined })}>{availableTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div><div><Label htmlFor={`field-key-${field.id}`}>Chave estável</Label><Input id={`field-key-${field.id}`} value={field.key} onChange={(event) => patch(field.id, { key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} /></div></div>
            <div><Label htmlFor={`field-placeholder-${field.id}`}>{field.type === "checkbox" ? "Texto da confirmação" : "Texto de exemplo"}</Label><Input id={`field-placeholder-${field.id}`} value={field.placeholder || ""} onChange={(event) => patch(field.id, { placeholder: event.target.value || undefined })} /></div>
            {field.type === "select" || field.type === "radio" ? <OptionEditor options={field.options || []} onChange={(options) => patch(field.id, { options })} /> : null}
            <Toggle label="Campo obrigatório" checked={field.required} onChange={(required) => patch(field.id, { required })} />
            <Toggle label="Incluir no atendimento" description="Envia somente este campo no handoff comercial." checked={field.includeInHandoff ?? false} onChange={(includeInHandoff) => patch(field.id, { includeInHandoff })} />
            {field.includeInHandoff ? <div><Label htmlFor={`handoff-${field.id}`}>Nome no atendimento</Label><Input id={`handoff-${field.id}`} value={field.handoffLabel || ""} placeholder={field.label} onChange={(event) => patch(field.id, { handoffLabel: event.target.value || undefined })} /></div> : null}
            {issues.length ? <ul className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">{issues.map((issue) => <li key={issue}>• {issue}</li>)}</ul> : null}
            <div className="flex flex-wrap justify-between gap-2"><Button size="sm" variant="danger" onClick={() => replace(fields.filter((item) => item.id !== field.id))}><Trash2 size={14} />Excluir</Button><Button size="sm" variant="secondary" onClick={() => { const copy = { ...structuredClone(field), id: crypto.randomUUID(), label: `${field.label} — cópia`, key: formFieldKey(field.key, fields.map((item) => item.key)) }; replace([...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)]); setExpandedId(copy.id); }}><Copy size={14} />Duplicar</Button></div>
          </div> : null}
        </article>;
      })}
    </div>
    <Button className="mt-3 w-full" variant="secondary" onClick={() => { const field = newField(fields); replace([...fields, field]); setExpandedId(field.id); }}><Plus size={15} />Adicionar campo</Button>
    <Dialog open={Boolean(suggestions)} onOpenChange={(open) => { if (!open) setSuggestions(undefined); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Escolha os campos sugeridos</DialogTitle><DialogDescription>Nada será adicionado automaticamente. Revise e marque apenas o que faz sentido.</DialogDescription></DialogHeader><div className="grid max-h-[50vh] gap-2 overflow-y-auto">{suggestions?.map((field) => <label key={field.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e3e1ea] p-3"><input type="checkbox" className="mt-1 accent-[#0054fc]" checked={selectedSuggestions.has(field.id)} onChange={(event) => setSelectedSuggestions((current) => { const next = new Set(current); if (event.target.checked) next.add(field.id); else next.delete(field.id); return next; })} /><span><strong className="block text-sm">{field.label}</strong><small className="text-[#777580]">{fieldTypes.find((item) => item.value === field.type)?.label}</small></span></label>)}</div><DialogFooter><Button variant="ghost" onClick={() => setSuggestions(undefined)}>Cancelar</Button><Button disabled={!selectedSuggestions.size} onClick={() => { replace([...fields, ...(suggestions || []).filter((field) => selectedSuggestions.has(field.id))]); setSuggestions(undefined); }}>Adicionar selecionados</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange(value: boolean): void }) { return <div className="flex items-center justify-between gap-4 rounded-xl border border-[#e7e5ec] p-3"><div><strong className="block text-sm">{label}</strong>{description ? <p className="mt-0.5 text-xs text-[#777580]">{description}</p> : null}</div><Switch checked={checked} onCheckedChange={onChange} aria-label={label} /></div>; }

function OptionEditor({ options, onChange }: { options: string[]; onChange(options: string[]): void }) { return <fieldset><legend className="mb-2 text-sm font-semibold">Opções</legend><div className="space-y-2">{options.map((option, index) => <div key={index} className="grid grid-cols-[1fr_auto] gap-2"><Input aria-label={`Opção ${index + 1}`} value={option} onChange={(event) => onChange(options.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><Button size="icon" variant="ghost" aria-label={`Remover opção ${index + 1}`} onClick={() => onChange(options.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></Button></div>)}</div><Button className="mt-2" size="sm" variant="ghost" onClick={() => onChange([...options, `Opção ${options.length + 1}`])}><Plus size={14} />Adicionar opção</Button></fieldset>; }
