"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectExtractedFacts } from "@/components/project-sources/project-extracted-facts";
import { ProjectFactsSummary } from "@/components/project-sources/project-facts-summary";
import { ProjectSourceDetails } from "@/components/project-sources/project-source-details";
import { ProjectSourceList } from "@/components/project-sources/project-source-list";
import { ProjectSourceUploader } from "@/components/project-sources/project-source-uploader";
import type { BusinessSource } from "@/types";

export function ProjectSourcesShell({ projectId }: { projectId: string }) {
  const [sources, setSources] = useState<BusinessSource[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/sources`, { cache: "no-store" });
    const payload = await response.json() as { data?: BusinessSource[]; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || "Não foi possível carregar as fontes.");
    setSources(payload.data || []);
    setSelectedId((current) => payload.data?.some((source) => source.id === current) ? current : payload.data?.[0]?.id);
  }, [projectId]);
  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Falha ao carregar.")); }, [load]);
  const selected = sources.find((source) => source.id === selectedId);
  return <div className="flex flex-col gap-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-primary">Materiais e importações</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight">Informações do negócio</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Adicione materiais, confira as informações que a Sobe encontrou e escolha o que deve entrar na página.</p></div><ProjectExtractedFacts projectId={projectId} sources={sources} /></header><ProjectFactsSummary sources={sources} />{error ? <Alert variant="destructive"><AlertTitle>Não foi possível continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}<Card><CardHeader><CardTitle>Adicionar novo material</CardTitle><CardDescription>O material ficará vinculado somente a este negócio.</CardDescription></CardHeader><CardContent><ProjectSourceUploader projectId={projectId} onUploaded={() => void load()} /></CardContent></Card><div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]"><Card><CardHeader><CardTitle>Materiais adicionados</CardTitle></CardHeader><CardContent><ProjectSourceList sources={sources} selectedId={selectedId} onSelect={(source) => setSelectedId(source.id)} /></CardContent></Card>{selected ? <ProjectSourceDetails projectId={projectId} source={selected} onChanged={() => void load()} /> : <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Selecione um material para ver os detalhes.</CardContent></Card>}</div></div>;
}
