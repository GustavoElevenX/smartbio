import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { ArrowRight, Bot, LoaderCircle, MessageSquareText, PencilLine, WandSparkles } from "lucide-react";
import { AdaptiveQuestion } from "@/components/ai-setup/adaptive-question";
import { AIMessage } from "@/components/ai-setup/ai-message";
import { BrandIdentityUploader } from "@/components/ai-setup/brand-identity-uploader";
import { ConfirmExtractedData } from "@/components/ai-setup/confirm-extracted-data";
import { GenerationStatus, type GenerationPhase } from "@/components/ai-setup/generation-status";
import { SourceUploader } from "@/components/ai-setup/source-uploader";
import { VisitorActionSelector } from "@/components/ai-setup/visitor-action-selector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/field";
import type { AISetupSession, BrandIdentity, SourceReference } from "@/features/ai-setup/ai-setup.schema";
import type { VisitorActionSelection } from "@/features/ai-setup/visitor-actions";
import { calculateSetupReadiness } from "@/features/ai-setup/setup-readiness";

export interface InitialSetupForm {
  businessName: string;
  description: string;
  websiteUrl: string;
  phone: string;
}

interface AIConversationProps {
  form: InitialSetupForm;
  sources: SourceReference[];
  brandIdentity?: BrandIdentity;
  logoPreviewUrl?: string;
  session: AISetupSession | null;
  sessionReady: boolean;
  busy: boolean;
  busyQuestion?: string;
  generationStatus: GenerationPhase;
  projectId?: string;
  error?: string;
  phoneError?: string;
  phoneStatus: "idle" | "invalid" | "saving" | "saved";
  answerFeedback?: string;
  editingBusinessInfo: boolean;
  onFormChange: Dispatch<SetStateAction<InitialSetupForm>>;
  onSourcesChange: (sources: SourceReference[]) => void;
  onBrandIdentityChange: (brand: BrandIdentity, previewUrl: string) => void;
  onAnalyze: () => Promise<void>;
  onEditBusinessInfo: () => void;
  onAnswer: (key: string, value: unknown) => Promise<void>;
  onConfirmActions: (actions: VisitorActionSelection[]) => Promise<void>;
  onGenerate: () => Promise<void>;
  onOpenLaunch: () => void;
}

export function AIConversation({ form, sources, brandIdentity, logoPreviewUrl, session, sessionReady, busy, busyQuestion, generationStatus, projectId, error, phoneError, phoneStatus, answerFeedback, editingBusinessInfo, onFormChange, onSourcesChange, onBrandIdentityChange, onAnalyze, onEditBusinessInfo, onAnswer, onConfirmActions, onGenerate, onOpenLaunch }: AIConversationProps) {
  const analyzed = Boolean(session?.extractedProfile);
  const ready = generationStatus === "ready" || session?.status === "completed" || session?.status === "review";
  const sourcesProcessing = sources.some((source) => ["pending", "uploaded", "processing"].includes(source.status));
  const inputsDisabled = !sessionReady || busy || (analyzed && !editingBusinessInfo);
  const readiness = calculateSetupReadiness(session?.missingRequirements || [], session || undefined);
  const degraded = session?.activationUnderstanding?.status === "degraded" || session?.discoveryPlan?.status === "degraded";
  const unresolvedWithoutControl = Boolean(session?.actionsConfirmed && readiness.blocking > 0 && !session.questions.length);
  return (
    <main className="min-w-0 p-5 sm:p-7 xl:p-9">
      <div className="mx-auto max-w-[780px]">
        <div className="flex items-start justify-between gap-4 border-b border-[#dfe6ee] pb-6">
          <div className="flex gap-3">
            <span className="grid size-11 shrink-0 place-items-center bg-[#0054fc] text-white" style={{ clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)" }}><Bot size={20} /></span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-[-.04em] text-[#07172f] sm:text-3xl">Vamos montar a sua Sobe.</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#687582]">Conte o que você vende e o que normalmente acontece quando alguém se interessa pelo seu negócio. A Sobe organiza o resto.</p>
            </div>
          </div>
          <Link href="/app/onboarding/manual" className="hidden shrink-0 text-xs font-bold text-[#536178] underline decoration-[#9fc3ff] underline-offset-4 sm:block">Configuração manual</Link>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          <AIMessage role="assistant"><strong className="text-[#34333a]">Comece pelo que você já sabe sobre o seu negócio.</strong><br />Vou organizar as ações e perguntar apenas o que estiver faltando.</AIMessage>
          <Card className="p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="ai-business-name">Nome do negócio</Label><Input id="ai-business-name" autoComplete="organization" value={form.businessName} onChange={(event) => onFormChange((current) => ({ ...current, businessName: event.target.value }))} placeholder="Ex.: Estúdio Aurora" disabled={inputsDisabled} /></div>
              <div><Label htmlFor="ai-website">Site ou Instagram (opcional)</Label><Input id="ai-website" value={form.websiteUrl} onChange={(event) => onFormChange((current) => ({ ...current, websiteUrl: event.target.value }))} placeholder="https:// ou @seunegocio" disabled={inputsDisabled} /></div>
            </div>
            <div className="mt-4"><Label htmlFor="ai-description">O que você vende e como atende?</Label><Textarea id="ai-description" className="min-h-32" value={form.description} onChange={(event) => onFormChange((current) => ({ ...current, description: event.target.value }))} placeholder="Conte o que vende, quem costuma procurar você e como o atendimento continua." disabled={inputsDisabled} /></div>
            <div className="mt-4"><Label htmlFor="ai-phone">WhatsApp ou telefone (opcional)</Label><Input id="ai-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => onFormChange((current) => ({ ...current, phone: event.target.value }))} placeholder="(11) 99999-9999" disabled={inputsDisabled} aria-invalid={Boolean(phoneError)} aria-describedby={phoneError ? "ai-phone-error" : undefined} />{phoneError ? <p id="ai-phone-error" role="alert" className="mt-2 text-xs font-semibold text-[#a33b35]">{phoneError} O valor foi mantido para você corrigir.</p> : phoneStatus === "saving" ? <p className="mt-2 text-xs font-semibold text-[#687582]">Salvando WhatsApp…</p> : phoneStatus === "saved" ? <p className="mt-2 text-xs font-semibold text-[#1b7f60]">✓ WhatsApp salvo e confirmado.</p> : null}</div>
            <div className="mt-5"><BrandIdentityUploader brand={brandIdentity} previewUrl={logoPreviewUrl} businessName={form.businessName} businessDescription={form.description} onChange={onBrandIdentityChange} disabled={inputsDisabled} /></div>
            <div className="mt-4"><SourceUploader sources={sources} setupSessionId={session?.id} projectId={projectId} onChange={onSourcesChange} disabled={inputsDisabled} /></div>
            {!analyzed ? <Button type="button" size="lg" className="mt-5 w-full sm:w-auto" onClick={() => void onAnalyze()} disabled={!sessionReady || busy || sourcesProcessing}>{busy || sourcesProcessing ? <LoaderCircle data-icon size={17} className="animate-spin" /> : <WandSparkles data-icon size={17} />}{sourcesProcessing ? "Importando materiais…" : busy ? "Analisando o negócio…" : "Analisar meu negócio"}</Button> : null}
            {analyzed && !editingBusinessInfo && !ready ? <Button type="button" size="lg" variant="secondary" className="mt-5 w-full sm:w-auto" onClick={onEditBusinessInfo} disabled={busy}><PencilLine data-icon size={17} /> Editar informações do negócio</Button> : null}
            {analyzed && editingBusinessInfo ? <><p className="mt-4 text-sm leading-6 text-[#536178]">Faça os ajustes necessários. A nova análise vai substituir esta leitura, sem reiniciar o onboarding.</p><Button type="button" size="lg" className="mt-3 w-full sm:w-auto" onClick={() => void onAnalyze()} disabled={!sessionReady || busy || sourcesProcessing}>{busy || sourcesProcessing ? <LoaderCircle data-icon size={17} className="animate-spin" /> : <WandSparkles data-icon size={17} />}{sourcesProcessing ? "Importando materiais…" : busy ? "Analisando novamente…" : "Analisar novamente"}</Button></> : null}
          </Card>

          {analyzed && session && !editingBusinessInfo ? <><AIMessage role="user">{form.description}</AIMessage><AIMessage role="assistant">Encontrei as principais ações que seus visitantes podem querer realizar. Confirme antes de continuarmos.</AIMessage><ConfirmExtractedData session={session} /></> : null}
          {analyzed && session && !editingBusinessInfo && !session.actionsConfirmed ? <VisitorActionSelector initialActions={session.visitorActions || []} busy={busy} onConfirm={onConfirmActions} /> : null}

          {!editingBusinessInfo && session?.actionsConfirmed && session.questions.length ? <section id="adaptive-questions" aria-labelledby="adaptive-questions-title">
            <div className="mb-3"><h2 id="adaptive-questions-title" className="flex items-center gap-2 text-sm font-extrabold"><MessageSquareText size={17} className="text-[#0054fc]" /> Só o que falta para funcionar</h2><p className="mt-1 text-xs leading-5 text-[#687582]">{readiness.blocking === 1 ? "Falta 1 confirmação necessária." : `Faltam ${readiness.blocking} confirmações necessárias.`} A Sobe mostra poucos itens por vez; novos itens só aparecem quando uma resposta define o próximo passo.</p></div>
            <div className="grid gap-3">{session.questions.map((question) => <AdaptiveQuestion key={question.id} question={question} busy={busyQuestion === question.key} onAnswer={(value) => onAnswer(question.key, value)} />)}</div>
          </section> : analyzed && !editingBusinessInfo && session?.actionsConfirmed && !ready && !unresolvedWithoutControl ? <AIMessage role="assistant">Estamos preparando as próximas confirmações necessárias para a sua experiência.</AIMessage> : null}

          {analyzed && !editingBusinessInfo && session?.actionsConfirmed && !ready && (degraded || unresolvedWithoutControl) ? <div role="alert" className="border border-[#f0d28f] bg-[#fff9e9] p-5 text-[#795b16]"><h2 className="text-base font-extrabold">Não conseguimos montar sua recomendação com segurança.</h2><p className="mt-2 text-sm leading-6">{session?.discoveryPlan?.issues[0] || session?.activationUnderstanding?.issues[0] || "Uma informação necessária ficou sem uma forma segura de confirmação."}</p><Button type="button" size="sm" variant="secondary" className="mt-4" onClick={() => void onAnalyze()} disabled={busy}>{busy ? <LoaderCircle data-icon size={15} className="animate-spin" /> : null}Tentar novamente</Button></div> : null}

          {answerFeedback ? <div aria-live="polite" className="border border-[#b9e4cf] bg-[#f0fbf6] p-3 text-sm font-semibold text-[#25684f]">✓ {answerFeedback}</div> : null}

          {analyzed && !editingBusinessInfo && session?.actionsConfirmed && !ready && readiness.readyToGenerate ? <div className="border border-[#c8d9ea] bg-[#f7fbff] p-5" style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)" }}><h2 className="text-lg font-extrabold tracking-[-.025em]">Pronto para montar a primeira versão?</h2><p className="mt-2 text-sm leading-6 text-[#687582]">A Sobe vai criar a página, conectar cada ação e manter tudo como rascunho até você publicar.</p><Button type="button" size="lg" className="mt-4" onClick={() => void onGenerate()} disabled={!sessionReady || busy || !["idle", "ready"].includes(generationStatus)}><WandSparkles data-icon size={17} /> Criar minha primeira versão</Button></div> : analyzed && !editingBusinessInfo && session?.actionsConfirmed && !ready && !degraded && !unresolvedWithoutControl ? <div className="border border-[#e1dfe8] bg-[#fafafa] p-5"><h2 className="text-lg font-extrabold tracking-[-.025em]">Ainda faltam informações necessárias</h2><p className="mt-2 text-sm leading-6 text-[#687582]">Confirme os itens acima para a Sobe conseguir criar uma primeira versão funcional.</p><a href="#adaptive-questions" className="focus-ring mt-4 inline-flex min-h-11 items-center gap-2 border border-[#c8d9ea] bg-white px-4 text-sm font-extrabold text-[#0054fc]">Continuar configuração <ArrowRight size={16} /></a></div> : null}

          <GenerationStatus status={generationStatus} />
          {ready && projectId ? <div className="border border-[#b9e4cf] bg-[#f0fbf6] p-6" style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)" }}><h2 className="text-2xl font-extrabold tracking-[-.035em]">Sua primeira versão está pronta.</h2><p className="mt-2 text-sm leading-6 text-[#526b61]">Teste como visitante, veja as pendências e publique quando estiver tudo certo.</p><Button type="button" size="lg" className="mt-5" onClick={onOpenLaunch}>Revisar primeira versão <ArrowRight data-icon size={17} /></Button></div> : null}

          {error ? <div role="alert" className="border border-[#ffd0cf] bg-[#fff1f0] p-4 text-sm font-semibold text-[#a33b35]">{error}</div> : null}
          <Link href="/app/onboarding/manual" className="text-center text-xs font-bold text-[#536178] underline decoration-[#9fc3ff] underline-offset-4 sm:hidden">Prefiro a configuração manual</Link>
        </div>
      </div>
    </main>
  );
}
