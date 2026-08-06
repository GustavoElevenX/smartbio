import Link from "next/link";
import { ArrowRight, Bot, LoaderCircle, MessageSquareText, WandSparkles } from "lucide-react";
import { AdaptiveQuestion } from "@/components/ai-setup/adaptive-question";
import { AIMessage } from "@/components/ai-setup/ai-message";
import { ConfirmExtractedData } from "@/components/ai-setup/confirm-extracted-data";
import { GenerationStatus } from "@/components/ai-setup/generation-status";
import { SourceUploader } from "@/components/ai-setup/source-uploader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/field";
import type { AISetupSession, SourceReference } from "@/features/ai-setup/ai-setup.schema";

export interface InitialSetupForm {
  businessName: string;
  description: string;
  websiteUrl: string;
  phone: string;
}

interface AIConversationProps {
  form: InitialSetupForm;
  sources: SourceReference[];
  session: AISetupSession | null;
  busy: boolean;
  busyQuestion?: string;
  generationStatus: "idle" | "generating" | "ready";
  projectId?: string;
  error?: string;
  onFormChange: (form: InitialSetupForm) => void;
  onSourcesChange: (sources: SourceReference[]) => void;
  onAnalyze: () => Promise<void>;
  onAnswer: (key: string, value: string) => Promise<void>;
  onGenerate: () => Promise<void>;
  onOpenEditor: () => void;
}

export function AIConversation({ form, sources, session, busy, busyQuestion, generationStatus, projectId, error, onFormChange, onSourcesChange, onAnalyze, onAnswer, onGenerate, onOpenEditor }: AIConversationProps) {
  const analyzed = Boolean(session?.extractedProfile);
  const ready = generationStatus === "ready" || session?.status === "completed" || session?.status === "review";
  return (
    <main className="min-w-0 p-5 sm:p-7 xl:p-9">
      <div className="mx-auto max-w-[780px]">
        <div className="flex items-start justify-between gap-4 border-b border-[#eceaf1] pb-6">
          <div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-[#17171c] text-white"><Bot size={20} /></span><div><p className="text-xs font-extrabold uppercase tracking-[.13em] text-[#6d5ef5]">Copiloto de Configuração</p><h1 className="mt-1 text-2xl font-extrabold tracking-[-.04em] sm:text-[28px]">Vamos entender o seu negócio.</h1><p className="mt-2 text-sm leading-6 text-[#73727d]">A conversa muda conforme as capacidades comerciais detectadas.</p></div></div>
          <Link href="/app/onboarding/manual" className="hidden shrink-0 text-xs font-bold text-[#686670] underline decoration-[#c9c5df] underline-offset-4 sm:block">Configuração manual</Link>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          <AIMessage role="assistant"><strong className="text-[#34333a]">Conte o que seu negócio vende e como seus clientes normalmente compram.</strong><br />Vou identificar os caminhos necessários e perguntar apenas o que estiver faltando.</AIMessage>

          <Card className="p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="ai-business-name">Nome do negócio</Label><Input id="ai-business-name" autoComplete="organization" value={form.businessName} onChange={(event) => onFormChange({ ...form, businessName: event.target.value })} placeholder="Ex.: Estúdio Aurora" disabled={analyzed || busy} /></div>
              <div><Label htmlFor="ai-website">Site (opcional)</Label><Input id="ai-website" type="url" value={form.websiteUrl} onChange={(event) => onFormChange({ ...form, websiteUrl: event.target.value })} placeholder="https://seunegocio.com.br" disabled={analyzed || busy} /></div>
            </div>
            <div className="mt-4"><Label htmlFor="ai-description">O que você vende e como atende?</Label><Textarea id="ai-description" className="min-h-32" value={form.description} onChange={(event) => onFormChange({ ...form, description: event.target.value })} placeholder="Descreva serviços ou produtos, tipo de cliente, como o pedido começa e onde o atendimento termina." disabled={analyzed || busy} /></div>
            <div className="mt-4"><Label htmlFor="ai-phone">WhatsApp ou telefone (opcional)</Label><Input id="ai-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => onFormChange({ ...form, phone: event.target.value })} placeholder="5511999999999" disabled={analyzed || busy} /></div>
            <div className="mt-4"><SourceUploader sources={sources} setupSessionId={session?.id} projectId={projectId} onChange={onSourcesChange} disabled={analyzed || busy} /></div>
            {!analyzed ? <Button type="button" size="lg" className="mt-5 w-full sm:w-auto" onClick={() => void onAnalyze()} disabled={busy}>{busy ? <LoaderCircle data-icon size={17} className="animate-spin" /> : <WandSparkles data-icon size={17} />} {busy ? "Analisando o negócio…" : "Analisar meu negócio"}</Button> : null}
          </Card>

          {analyzed && session ? <><AIMessage role="user">{form.description}</AIMessage><AIMessage role="assistant">Encontrei os principais caminhos comerciais. Agora vou confirmar somente os dados que alteram a experiência.</AIMessage><ConfirmExtractedData session={session} /></> : null}

          {session?.questions.length ? <section aria-labelledby="adaptive-questions-title"><div className="mb-3 flex items-center justify-between gap-3"><h2 id="adaptive-questions-title" className="flex items-center gap-2 text-sm font-extrabold"><MessageSquareText size={17} className="text-[#6d5ef5]" /> Perguntas para avançar</h2><span className="rounded-full bg-[#efedff] px-2.5 py-1 text-[10px] font-extrabold text-[#5d50cf]">{session.questions.length} agora</span></div><div className="grid gap-3">{session.questions.map((question) => <AdaptiveQuestion key={question.id} question={question} busy={busyQuestion === question.key} onAnswer={(value) => onAnswer(question.key, value)} />)}</div></section> : analyzed && !ready ? <AIMessage role="assistant">Já tenho contexto suficiente para criar um primeiro rascunho. As informações não confirmadas continuarão marcadas no editor.</AIMessage> : null}

          {analyzed && !ready ? <div className="rounded-[20px] border border-[#dfdcf2] bg-[#f7f5ff] p-5"><h2 className="text-lg font-extrabold tracking-[-.025em]">Pronto para compor a primeira versão?</h2><p className="mt-2 text-sm leading-6 text-[#73717e]">A jornada será criada como rascunho. Nenhuma experiência será publicada automaticamente.</p><Button type="button" size="lg" className="mt-4" onClick={() => void onGenerate()} disabled={busy || generationStatus === "generating"}><WandSparkles data-icon size={17} /> Gerar jornada adaptativa</Button></div> : null}

          <GenerationStatus status={generationStatus} />
          {ready && projectId ? <div className="rounded-[22px] border border-[#cfe9df] bg-[#f0fbf6] p-6"><span className="text-xs font-extrabold uppercase tracking-[.12em] text-[#16815c]">Rascunho pronto</span><h2 className="mt-2 text-2xl font-extrabold tracking-[-.035em]">A jornada foi criada sem publicar nada.</h2><p className="mt-2 text-sm leading-6 text-[#626d68]">Abra o editor para revisar textos, completar pendências comerciais e validar a experiência.</p><Button type="button" size="lg" className="mt-5" onClick={onOpenEditor}>Abrir no editor <ArrowRight data-icon size={17} /></Button></div> : null}

          {error ? <div role="alert" className="rounded-xl border border-[#ffd0cf] bg-[#fff1f0] p-4 text-sm font-semibold text-[#a33b35]">{error}</div> : null}
          <Link href="/app/onboarding/manual" className="text-center text-xs font-bold text-[#686670] underline decoration-[#c9c5df] underline-offset-4 sm:hidden">Prefiro a configuração manual</Link>
        </div>
      </div>
    </main>
  );
}
