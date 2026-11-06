"use client";

import Link from "next/link";
import { Check, ExternalLink, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { WhatsAppNumbersEditor } from "@/components/dashboard/whatsapp-numbers-editor";
import { primaryWhatsAppDestination, whatsappNumberErrors, projectWhatsAppNumbers } from "@/features/whatsapp/project-whatsapp-numbers";
import type { Project } from "@/types";
import type { ProjectCommercialContext } from "@/features/commercial-context/project-commercial-context.schema";

interface Props {
  project: Project;
  onChange(project: Project): void;
  onSave(): void;
  saved: boolean;
  saveError: string;
  dirty: boolean;
  saving: boolean;
}

const sectionClass = "border-t border-[#dfe6ee] py-7 first:border-t-0 first:pt-0";
const actionClass = "focus-ring inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#0054fc] hover:text-[#0048d9]";

export function SimpleSettings({ project, onChange, onSave, saved, saveError, dirty, saving }: Props) {
  const [context, setContext] = useState<ProjectCommercialContext | null>();
  useEffect(() => {
    let active = true;
    void fetch(`/api/projects/${project.id}/commercial-context`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { data?: ProjectCommercialContext | null } | null) => { if (active) setContext(payload?.data || null); })
      .catch(() => { if (active) setContext(null); });
    return () => { active = false; };
  }, [project.id]);
  const base = `/app/projects/${project.id}`;
  const goals = (project.conversionGoals || []).filter((goal) => goal.isActive).sort((a, b) => a.order - b.order);
  const questions = project.discoveryPlan?.questions || [];
  const primaryNumber = primaryWhatsAppDestination(project);
  const patch = (change: Partial<Project>) => onChange({ ...project, ...change });
  const questionPreview = questions.filter((item) => item.required).slice(0, 3).map((item) => item.question).join(" · ");

  return (
    <div className="mt-7 rounded-2xl border border-[#dfe6ee] bg-white p-5 sm:p-7">
      <section className={sectionClass} aria-labelledby="simple-business">
        <h2 id="simple-business" className="text-xl font-extrabold text-[#07172f]">Meu negócio</h2>
        <p className="mt-1 text-sm text-[#526171]">Conte o essencial. Uma lista completa de produtos não é necessária.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="simple-name">Nome do negócio</Label><Input id="simple-name" value={project.name} onChange={(event) => patch({ name: event.target.value })} /></div>
          <div className="sm:col-span-2"><Label htmlFor="simple-description">Breve descrição</Label><Textarea id="simple-description" value={project.description} onChange={(event) => patch({ description: event.target.value })} /></div>
        </div>
        <h3 className="mt-6 font-bold text-[#07172f]">O que seus clientes procuram?</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {goals.length ? goals.map((goal) => <span key={goal.id} className="rounded-lg bg-[#eef4fa] px-3 py-2 text-sm font-semibold text-[#07172f]">{goal.name}</span>) : <span className="text-sm text-[#526171]">Ainda não há intenções configuradas.</span>}
        </div>
        <Link href={`${base}/conversion`} className={`${actionClass} mt-2`}>Ajustar o que os visitantes procuram <ExternalLink size={15} aria-hidden="true" /></Link>
        <div className="mt-5 border-t border-[#e8edf2] pt-5">
          <h3 className="font-bold text-[#07172f]">O que a SOBE entendeu</h3>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <p><strong className="block text-[#087756]">Confirmado</strong>{context?.lastConfirmedAt && context.summary.businessDescription ? context.summary.businessDescription : project.name || "Nenhum fato confirmado ainda"}</p>
            <p><strong className="block text-[#9a6700]">Precisa confirmar</strong>{context?.intentContexts.filter((item) => item.status === "inferred").map((item) => item.label).join(", ") || "Nenhuma sugestão pendente"}</p>
            <p><strong className="block text-[#526171]">Não informado</strong>{project.category ? "Nenhuma categoria ausente" : "Categoria principal"}</p>
          </div>
        </div>
        <Link href={`${base}/sources`} className={`${actionClass} mt-4`}>Atualizar informações com site, texto ou material <ExternalLink size={15} aria-hidden="true" /></Link>
        <Link href={`${base}/data`} className={`${actionClass} ml-0 sm:ml-5`}>Produtos e serviços principais <ExternalLink size={15} aria-hidden="true" /></Link>
      </section>

      <section className={sectionClass} aria-labelledby="simple-service">
        <h2 id="simple-service" className="text-xl font-extrabold text-[#07172f]">Como atender</h2>
        <p className="mt-1 text-sm text-[#526171]">Confirme o canal que receberá os interessados. Destinos por unidade ficam no modo Avançado.</p>
        <div className="mt-5"><WhatsAppNumbersEditor project={project} onChange={onChange} /></div>
        <div className="mt-5 rounded-xl bg-[#f4f8ff] p-4 text-sm text-[#344150]">
          <strong className="block text-[#07172f]">Assim a SOBE encaminha um interessado</strong>
          <p className="mt-1">Exemplo hipotético: depois de entender o pedido, a SOBE prepara o contato{primaryNumber?.value ? ` para ${primaryNumber.label}` : " para o canal configurado"}. A pessoa decide se envia a mensagem.</p>
        </div>
        <Link href={`${base}/operations`} className={`${actionClass} mt-3`}>Configurar outros canais ou unidades <ExternalLink size={15} aria-hidden="true" /></Link>
      </section>

      <section className={sectionClass} aria-labelledby="simple-questions">
        <h2 id="simple-questions" className="text-xl font-extrabold text-[#07172f]">O que perguntar</h2>
        <p className="mt-1 text-sm text-[#526171]">Pergunte apenas o que ajuda a equipe a continuar o atendimento.</p>
        {questions.length ? <ul className="mt-5 divide-y divide-[#e8edf2] border-y border-[#e8edf2]">{questions.slice(0, 3).map((item) => <li key={item.id} className="py-3"><strong className="block text-sm text-[#07172f]">{item.question}</strong><span className="text-xs text-[#526171]">{item.required ? "Essencial para o atendimento" : "Opcional"}</span></li>)}</ul> : <p className="mt-4 text-sm text-[#526171]">Ainda não há perguntas recomendadas para mostrar.</p>}
        <p className="mt-4 rounded-xl bg-[#f7f8fa] p-4 text-sm text-[#344150]"><strong className="block text-[#07172f]">Exemplo do briefing</strong>{questionPreview || "O pedido e as respostas fornecidas pelo visitante aparecem aqui, sem preencher lacunas por suposição."}</p>
        <Link href={`${base}/conversion`} className={`${actionClass} mt-3`}>Revisar perguntas e jornadas <ExternalLink size={15} aria-hidden="true" /></Link>
      </section>

      <section className={sectionClass} aria-labelledby="simple-appearance">
        <h2 id="simple-appearance" className="text-xl font-extrabold text-[#07172f]">Aparência</h2>
        <p className="mt-1 text-sm text-[#526171]">Visual recomendado automaticamente a partir da sua marca.</p>
        <div className="mt-4 flex items-center gap-4 rounded-xl bg-[#f7f8fa] p-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-white text-xl font-extrabold text-[#0054fc]">{project.name.slice(0, 1).toUpperCase() || "S"}</span>
          <div className="min-w-0"><strong className="block truncate text-sm text-[#07172f]">{project.name}</strong><span className="text-xs text-[#526171]">Prévia da identidade do negócio</span></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5"><Link href={`${base}/brand`} className={actionClass}>Alterar logo e cores <ExternalLink size={15} aria-hidden="true" /></Link><Link href={`${base}/media`} className={actionClass}>Escolher imagem ou capa <ExternalLink size={15} aria-hidden="true" /></Link><Link href={`${base}/minha-sobe`} className={actionClass}>Ver minha SOBE <ExternalLink size={15} aria-hidden="true" /></Link></div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-[#dfe6ee] pt-6">
        <Button type="button" onClick={onSave} disabled={saving || !dirty || Boolean(Object.keys(whatsappNumberErrors(projectWhatsAppNumbers(project))).length)}><Save size={16} aria-hidden="true" /> {saving ? "Salvando…" : "Salvar alterações"}</Button>
        <span role="status" className="text-sm text-[#526171]">{saving ? "Salvando alterações" : saved ? <span className="inline-flex items-center gap-1 text-[#087756]"><Check size={15} /> Alterações salvas</span> : dirty ? "Alterações ainda não salvas" : project.status === "published" ? "Publicação atual não foi alterada" : "Rascunho salvo"}</span>
        {saveError ? <p role="alert" className="w-full text-sm font-semibold text-red-600">{saveError}</p> : null}
      </div>
    </div>
  );
}
