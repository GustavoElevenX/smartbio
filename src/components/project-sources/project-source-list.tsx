"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BusinessSource } from "@/types";

export function ProjectSourceList({ sources, selectedId, onSelect }: { sources: BusinessSource[]; selectedId?: string; onSelect: (source: BusinessSource) => void }) {
  if (!sources.length) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma fonte vinculada a este projeto.</p>;
  return <div className="flex flex-col gap-2">{sources.map((source) => <Button key={source.id} type="button" variant={source.id === selectedId ? "secondary" : "ghost"} className="h-auto justify-start gap-3 p-3 text-left" onClick={() => onSelect(source)}><FileText /><span className="min-w-0 flex-1"><strong className="block truncate">{source.name}</strong><small className="text-muted-foreground">{source.type} · {new Date(source.createdAt).toLocaleDateString("pt-BR")}</small></span><Badge variant={source.status === "processed" ? "default" : "secondary"}>{source.status}</Badge></Button>)}</div>;
}
