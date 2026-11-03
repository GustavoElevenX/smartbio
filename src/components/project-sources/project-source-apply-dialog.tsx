"use client";

import { useState } from "react";
import { ExtractedFactsReview } from "@/components/ai-sources/extracted-facts-review";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ProjectSourceApplyDialog({ projectId, sourceIds }: { projectId: string; sourceIds: string[] }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={!sourceIds.length}>Revisar informações encontradas</Button></DialogTrigger><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Revise antes de incluir na página</DialogTitle><DialogDescription>Confirme somente o que estiver correto. Informações repetidas não serão duplicadas, e nada será publicado automaticamente.</DialogDescription></DialogHeader><ExtractedFactsReview sourceIds={sourceIds} projectId={projectId} /></DialogContent></Dialog>;
}
