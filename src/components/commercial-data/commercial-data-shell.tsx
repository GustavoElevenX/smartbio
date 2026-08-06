"use client";

import { AlertTriangle, Check, Loader2, Plus, Save, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CatalogPanel } from "@/components/commercial-data/catalog/catalog-panel";
import { DestinationsPanel } from "@/components/commercial-data/destinations/destinations-panel";
import { IntegrityPanel } from "@/components/commercial-data/integrity/integrity-panel";
import { LocationsPanel } from "@/components/commercial-data/locations/locations-panel";
import { PoliciesPanel } from "@/components/commercial-data/policies/policies-panel";
import { QuoteConfigPanel } from "@/components/commercial-data/quotes/quote-config-panel";
import { ReservationsPanel } from "@/components/commercial-data/reservations/reservations-panel";
import { SchedulingPanel } from "@/components/commercial-data/scheduling/scheduling-panel";
import { ServicesPanel } from "@/components/commercial-data/services/services-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { capabilityRegistry, createCapability } from "@/features/capabilities/capability-registry";
import { canUseLocalStore } from "@/lib/runtime-mode";
import { projectRepository } from "@/lib/repositories/project-repository";
import type { CapabilityKey, Project, QuoteDefinition } from "@/types";

type TabKey = "services" | "quotes" | "scheduling" | "catalog" | "reservations" | "locations" | "destinations" | "policies" | "integrity";

const tabDefinitions: Array<{ key: TabKey; label: string; capabilities?: CapabilityKey[] }> = [
  { key: "services", label: "Serviços" },
  { key: "quotes", label: "Orçamentos", capabilities: ["quote"] },
  { key: "scheduling", label: "Agenda", capabilities: ["scheduling"] },
  { key: "catalog", label: "Produtos", capabilities: ["catalog_order"] },
  { key: "reservations", label: "Reservas", capabilities: ["reservation"] },
  { key: "locations", label: "Unidades e roteamento", capabilities: ["routing"] },
  { key: "destinations", label: "Destinos e pagamentos", capabilities: ["routing", "payment"] },
  { key: "policies", label: "Políticas" },
  { key: "integrity", label: "Integridade dos dados" },
];

function defaultQuote(projectId: string): QuoteDefinition {
  return { id: crypto.randomUUID(), projectId, title: "Orçamento", currency: "BRL", estimationMode: "manual", questions: [], rules: [], completionChannel: "native", isActive: true };
}

export function CommercialDataShell({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>();
  const [activeTab, setActiveTab] = useState<TabKey>("services");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const baselineIds = useRef<ReturnType<typeof collectDeletableIds> | null>(null);

  useEffect(() => {
    let current = true;
    projectRepository.getProject(projectId).then((result) => { if (current) { setProject(result || null); baselineIds.current = result ? collectDeletableIds(result) : null; } }).catch((error) => { if (current) { setProject(null); setStatus({ kind: "error", message: error instanceof Error ? error.message : "Não foi possível carregar os dados." }); } });
    return () => { current = false; };
  }, [projectId]);

  const enabled = useMemo(() => new Set(project?.capabilities?.filter((item) => item.enabled).map((item) => item.key)), [project]);
  const tabs = useMemo(() => tabDefinitions.filter((tab) => !tab.capabilities || tab.capabilities.some((key) => enabled.has(key))), [enabled]);

  if (project === undefined) return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="animate-spin text-[#6658d9]" /></div>;
  if (!project) return <Alert variant="destructive"><AlertTriangle /><AlertTitle>Projeto não encontrado</AlertTitle><AlertDescription>{status?.message || "Verifique se o projeto pertence ao seu workspace."}</AlertDescription></Alert>;

  const config = project.commercialConfig || {};
  const patchConfig = (next: Partial<NonNullable<Project["commercialConfig"]>>) => setProject((current) => current ? ({ ...current, commercialConfig: { ...current.commercialConfig, ...next }, updatedAt: new Date().toISOString() }) : current);
  const activate = (key: CapabilityKey) => setProject((current) => {
    if (!current) return current;
    const capabilities = current.capabilities || [];
    const existing = capabilities.find((item) => item.key === key);
    return { ...current, capabilities: existing ? capabilities.map((item) => item.key === key ? { ...item, enabled: true, source: "user" } : item) : [...capabilities, { ...createCapability(key, "user"), enabled: true }] };
  });

  async function save() {
    if (!project) return;
    setSaving(true); setStatus(null);
    try {
      if (canUseLocalStore()) await projectRepository.saveProject(project);
      else {
        const currentIds = collectDeletableIds(project);
        const deleted = Object.fromEntries(Object.entries(baselineIds.current || currentIds).map(([key, ids]) => [key, ids.filter((id) => !(currentIds[key as keyof typeof currentIds] as string[]).includes(id))]));
        const response = await fetch(`/api/projects/${project.id}/commercial-data`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: project.commercialConfig || {}, capabilities: project.capabilities || [], dataRequirements: project.dataRequirements || [], deleted, expectedProjectVersion: project.version }) });
        const payload = await response.json().catch(() => ({})) as { data?: Project; error?: string | { message?: string } };
        if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : payload.error?.message || "Não foi possível salvar os dados comerciais.");
        if (payload.data) { setProject(payload.data); baselineIds.current = collectDeletableIds(payload.data); }
      }
      setStatus({ kind: "ok", message: "Dados comerciais salvos e auditados." });
    } catch (error) { setStatus({ kind: "error", message: error instanceof Error ? error.message : "Não foi possível salvar." }); }
    finally { setSaving(false); }
  }

  const inactive = (Object.keys(capabilityRegistry) as CapabilityKey[]).filter((key) => !enabled.has(key));
  return <div className="flex flex-col gap-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#6658d9]">Fonte de verdade operacional</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Dados comerciais</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#70707a]">Configure o que o negócio realmente oferece e como opera. A IA pode melhorar a apresentação, mas não altera fatos confirmados.</p></div><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}{saving ? "Salvando" : "Salvar alterações"}</Button></header>
    {status ? <Alert variant={status.kind === "error" ? "destructive" : "default"}>{status.kind === "ok" ? <Check /> : <AlertTriangle />}<AlertTitle>{status.kind === "ok" ? "Tudo certo" : "Atenção"}</AlertTitle><AlertDescription>{status.message}</AlertDescription></Alert> : null}
    {inactive.length ? <section className="rounded-[20px] border border-[#e4e2ef] bg-[#f8f7ff] p-4"><div className="flex items-center gap-2"><Plus size={16} className="text-[#6658d9]" /><h2 className="text-sm font-extrabold">Ativar outra capacidade</h2></div><div className="mt-3 flex flex-wrap gap-2">{inactive.map((key) => <Button key={key} size="sm" variant="secondary" onClick={() => activate(key)}>{capabilityRegistry[key].label}</Button>)}</div></section> : null}
    <div className="rounded-[24px] border border-[#e4e3ea] bg-white p-3 shadow-[0_18px_60px_rgba(29,28,35,.06)] sm:p-5"><Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}><TabsList className="h-auto w-full justify-start overflow-x-auto bg-[#f3f2f7] p-1.5">{tabs.map((tab) => <TabsTrigger key={tab.key} value={tab.key} className="min-h-10 shrink-0 px-4">{tab.label}</TabsTrigger>)}</TabsList>
      <div className="p-2 pt-7 sm:p-4 sm:pt-8">
        <TabsContent value="services"><ServicesPanel projectId={project.id} services={config.serviceOfferings || []} destinations={config.routingDestinations || []} quoteDefinition={config.quoteDefinition} schedulableServices={config.schedulableServices || []} onChange={(serviceOfferings) => patchConfig({ serviceOfferings })} /></TabsContent>
        <TabsContent value="quotes"><QuoteConfigPanel value={config.quoteDefinition || defaultQuote(project.id)} onChange={(quoteDefinition) => patchConfig({ quoteDefinition })} /></TabsContent>
        <TabsContent value="scheduling"><SchedulingPanel projectId={project.id} services={config.schedulableServices || []} serviceOfferings={config.serviceOfferings || []} resources={config.resources || []} availabilityRules={config.availabilityRules || []} exceptions={config.availabilityExceptions || []} onChange={patchConfig} /></TabsContent>
        <TabsContent value="catalog"><CatalogPanel projectId={project.id} categories={config.catalogCategories || []} items={config.catalogItems || []} onChange={patchConfig} /></TabsContent>
        <TabsContent value="reservations"><ReservationsPanel projectId={project.id} units={config.reservableUnits || []} blocks={config.reservationBlocks || []} policies={config.policies || []} onChange={patchConfig} /></TabsContent>
        <TabsContent value="locations"><LocationsPanel projectId={project.id} locations={config.locations || []} destinations={config.routingDestinations || []} onChange={patchConfig} /></TabsContent>
        <TabsContent value="destinations"><DestinationsPanel destinations={config.routingDestinations || []} paymentUrl={config.paymentUrl} onChange={patchConfig} /></TabsContent>
        <TabsContent value="policies"><PoliciesPanel projectId={project.id} policies={config.policies || []} onChange={(policies) => patchConfig({ policies })} /></TabsContent>
        <TabsContent value="integrity"><IntegrityPanel project={project} onNavigate={(path) => { const match = path.match(/tab=([^&]+)/); if (match?.[1] && tabDefinitions.some((tab) => tab.key === match[1])) setActiveTab(match[1] as TabKey); }} /></TabsContent>
      </div>
    </Tabs></div>
    <div className="flex items-center gap-2 text-xs text-[#72727c]"><ShieldCheck size={15} className="text-emerald-600" />Valores confirmados são protegidos em regenerações de IA.</div>
  </div>;
}

function collectDeletableIds(project: Project) {
  const config = project.commercialConfig || {};
  return {
    serviceOfferingIds: (config.serviceOfferings || []).map((item) => item.id),
    quoteQuestionIds: (config.quoteDefinition?.questions || []).map((item) => item.id),
    catalogItemIds: (config.catalogItems || []).map((item) => item.id),
    catalogCategoryIds: (config.catalogCategories || []).map((item) => item.id),
    resourceIds: (config.resources || []).map((item) => item.id),
    locationIds: (config.locations || []).map((item) => item.id),
    policyIds: (config.policies || []).map((item) => item.id),
  };
}
