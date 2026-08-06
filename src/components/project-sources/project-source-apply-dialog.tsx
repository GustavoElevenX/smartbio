"use client";

import { useState } from "react";
import { ExtractedFactsReview } from "@/components/ai-sources/extracted-facts-review";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ProjectSourceApplyDialog({ projectId, sourceIds }: { projectId: string; sourceIds: string[] }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={!sourceIds.length}>Revisar e aplicar fatos</Button></DialogTrigger><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Revisar fatos antes de aplicar</DialogTitle><DialogDescription>Confirme apenas evidências corretas. A aplicação é idempotente e não publica o projeto.</DialogDescription></DialogHeader><ExtractedFactsReview sourceIds={sourceIds} projectId={projectId} /></DialogContent></Dialog>;
}
