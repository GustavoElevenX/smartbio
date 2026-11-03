import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { ArrowRight, Bot, LoaderCircle, MessageSquareText, PencilLine, WandSparkles } from "lucide-react";
import { AdaptiveQuestion } from "@/components/ai-setup/adaptive-question";
import { AIMessage } from "@/components/ai-setup/ai-message";
import { BrandIdentityUploader } from "@/components/ai-setup/brand-identity-uploader";
import { BusinessOfferingInput } from "@/components/ai-setup/business-offering-input";
import { CommercialArchitectureReview } from "@/components/ai-setup/commercial-architecture-review";
import { GenerationStatus, type GenerationPhase } from "@/components/ai-setup/generation-status";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import type { AISetupSession, BrandIdentity, CommercialArchitecture, SourceReference } from "@/features/ai-setup/ai-setup.schema";
import { calculateSetupReadiness } from "@/features/ai-setup/setup-readiness";
import type { SetupSalesChannel } from "@/features/ai-setup/setup-sales-channel";

export interface InitialSetupForm {
  businessName: string;
  description: string;
  offeringType?: "products" | "services" | "both";
  offerDetails?: string;
  resaleAvailable?: boolean;
  resaleDetails?: string;
  salesChannel?: SetupSalesChannel;
  salesDestination?: string;
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
  onConfirmArchitecture: () => Promise<void>;
  onUpdateArchitecture: (architecture: CommercialArchitecture) => Promise<void>;
  onGenerate: () => Promise<void>;
  onOpenLaunch: () => void;
}

export function AIConversation({ form, sources, brandIdentity, logoPreviewUrl, session, sessionReady, busy, busyQuestion, generationStatus, projectId, error, phoneError, phoneStatus, answerFeedback, editingBusinessInfo, onFormChange, onSourcesChange, onBrandIdentityChange, onAnalyze, onEditBusinessInfo, onAnswer, onConfirmArchitecture, onUpdateArchitecture, onGenerate, onOpenLaunch }: AIConversationProps) {
  const analyzed = Boolean(session?.extractedProfile);
  const ready = generationStatus === "ready" || session?.status === "completed" || session?.status === "review";
  const sourcesProcessing = sources.some((source) => ["pending", "uploaded", "processing"].includes(source.status));
  const inputsDisabled = !sessionReady || busy || (analyzed && !editingBusinessInfo);
  const readiness = calculateSetupReadiness(session?.missingRequirements || [], session || undefined);
  const degraded = session?.commercialArchitecture?.status === "degraded" || session?.activationUnderstanding?.status === "degraded" || session?.discoveryPlan?.status === "degraded";
  const blockingIssue = session?.discoveryPlan?.status === "degraded"
    ? "Não conseguimos preparar as perguntas de orientação. Tente novamente para concluir essa etapa."
    : session?.commercialArchitecture?.status === "degraded"
      ? session.commercialArchitecture.issues[0]
      : session?.activationUnderstanding?.status === "degraded"
        ? session.activationUnderstanding.issues[0]
        : session?.missingRequirements.find((item) => item.severity === "blocking" && item.status !== "verified")?.reason;
  const architectureReviewed = session?.commercialArchitecture ? Boolean(session.architectureReviewed) : Boolean(session?.actionsConfirmed);
  const requiredQuestions = (session?.questions || []).filter((question) => session?.missingRequirements.some((requirement) => requirement.key === question.key && requirement.severity === "blocking" && requirement.status !== "verified"));
  const optionalQuestions = (session?.questions || []).filter((question) => !requiredQuestions.includes(question));
  const creating = !["idle", "ready"].includes(generationStatus);
  const unresolvedWithoutControl = Boolean(architectureReviewed && readiness.blocking > 0 && !requiredQuestions.length);
  return (
    <main className="min-w-0 p-5 sm:p-7 xl:p-9">
      <div className="mx-auto max-w-[780px]">
        <div className="flex items-start justify-between gap-4 border-b border-[#dfe6ee] pb-6">
          <div className="flex gap-3">
            <span className="grid size-11 shrink-0 place-items-center bg-[#0054fc] text-white" style={{ clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)" }}><Bot size={20} /></span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-[-.04em] text-[#07172f] sm:text-3xl">Vamos montar a sua Sobe.</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#526171]">Conte como seu negócio funciona. A Sobe organiza seu link da bio e os caminhos para seus clientes.</p>
            </div>
          </div>
          <Link href="/app/onboarding/manual" className="hidden shrink-0 text-xs font-bold text-[#536178] underline decoration-[#9fc3ff] underline-offset-4 sm:block">Configuração manual</Link>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          <section aria-label="Informações do negócio">
            <div className="grid gap-4">
              <div><Label htmlFor="ai-business-name">Nome do negócio</Label><Input id="ai-business-name" autoComplete="organization" value={form.businessName} onChange={(event) => onFormChange((current) => ({ ...current, businessName: event.target.value }))} placeholder="Ex.: Estúdio Aurora" disabled={inputsDisabled} /></div>
            </div>
            <BusinessOfferingInput form={form} sources={sources} setupSessionId={session?.id} projectId={projectId} disabled={inputsDisabled} onFormChange={onFormChange} onSourcesChange={onSourcesChange} />
            <fieldset className="mt-5"><legend className="text-sm font-bold text-[#07172f]">Por onde o cliente compra ou contrata?</legend><p className="mt-1 text-xs leading-5 text-[#526171]">Escolha o canal principal. A Sobe vai direcionar as pessoas para o lugar certo.</p><div className="mt-3 flex flex-wrap gap-2">{([ ["whatsapp", "WhatsApp"], ["phone", "Telefone"], ["link", "Site ou link de vendas"], ["in_person", "Presencialmente"], ["other", "Outro canal"] ] as const).map(([value, label]) => <label key={value} className={`focus-within:ring-2 focus-within:ring-[#0054fc] inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-semibold ${form.salesChannel === value ? "border-[#0054fc] bg-[#eaf3ff] text-[#0054fc]" : "border-[#d7e1ec] bg-white text-[#536178]"}`}><input type="radio" name="salesChannel" value={value} checked={form.salesChannel === value} onChange={() => onFormChange((current) => ({ ...current, salesChannel: value }))} disabled={inputsDisabled} className="sr-only" />{label}</label>)}</div></fieldset>
            {(form.salesChannel === "whatsapp" || form.salesChannel === "phone") ? <div className="mt-4"><Label htmlFor="ai-phone">WhatsApp ou telefone principal</Label><Input id="ai-phone" type="tel" autoComplete="tel" required value={form.phone} onChange={(event) => onFormChange((current) => ({ ...current, phone: event.target.value }))} placeholder="(11) 99999-9999" disabled={inputsDisabled} aria-invalid={Boolean(phoneError)} aria-describedby={phoneError ? "ai-phone-error" : undefined} />{phoneError ? <p id="ai-phone-error" role="alert" className="mt-2 text-xs font-semibold text-[#a33b35]">{phoneError} O valor foi mantido para você corrigir.</p> : phoneStatus === "saving" ? <p className="mt-2 text-xs font-semibold text-[#687582]">Salvando número…</p> : phoneStatus === "saved" ? <p className="mt-2 text-xs font-semibold text-[#1b7f60]">✓ Número salvo e confirmado.</p> : null}</div> : null}
            {form.salesChannel && !["whatsapp", "phone"].includes(form.salesChannel) ? <div className="mt-4"><Label htmlFor="ai-sales-destination">{form.salesChannel === "link" ? "Link onde o cliente compra ou contrata" : form.salesChannel === "in_person" ? "Onde acontece a venda ou contratação?" : "Como o cliente compra ou contrata?"}</Label><Input id="ai-sales-destination" required value={form.salesDestination || ""} onChange={(event) => onFormChange((current) => ({ ...current, salesDestination: event.target.value }))} placeholder={form.salesChannel === "link" ? "https://seusite.com/comprar" : form.salesChannel === "in_person" ? "Endereço, bairro ou local de atendimento" : "Conte qual é o canal e como chegar até ele"} disabled={inputsDisabled} /><p className="mt-2 text-xs leading-5 text-[#526171]">{form.salesChannel === "link" ? "Use o endereço direto da compra, agendamento ou contratação." : "Descreva com suas palavras; não precisa se encaixar em uma categoria pronta."}</p></div> : null}
            <details className="mt-5 border-t border-[#dfe6ee]"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Logo e outros materiais de referência (opcional)</summary><p className="mb-4 text-xs leading-5 text-[#526171]">Esses materiais ajudam a Sobe a conhecer a identidade do negócio. O catálogo pode ser enviado na etapa acima.</p><div className="mb-4"><Label htmlFor="ai-website">Outro site ou perfil de referência (opcional)</Label><Input id="ai-website" value={form.websiteUrl} onChange={(event) => onFormChange((current) => ({ ...current, websiteUrl: event.target.value }))} placeholder="https:// ou @seunegocio" disabled={inputsDisabled} /></div><BrandIdentityUploader brand={brandIdentity} previewUrl={logoPreviewUrl} businessName={form.businessName} businessDescription={form.description} onChange={onBrandIdentityChange} disabled={inputsDisabled} /></details>
            {!analyzed ? <><Button type="button" size="lg" className="mt-5 w-full sm:w-auto" onClick={() => void onAnalyze()} disabled={!sessionReady || busy || sourcesProcessing}>{busy || sourcesProcessing ? <LoaderCircle data-icon size={17} className="animate-spin" /> : <WandSparkles data-icon size={17} />}{sourcesProcessing ? "Importando materiais…" : busy ? "Preparando sua proposta…" : "Preparar minha Sobe"}</Button><p className="mt-3 text-xs leading-5 text-[#526171]">A IA organiza a proposta. Você revisa uma vez e cria um rascunho; nada é publicado agora.</p></> : null}
            {analyzed && !editingBusinessInfo && !ready ? <Button type="button" size="lg" variant="secondary" className="mt-5 w-full sm:w-auto" onClick={onEditBusinessInfo} disabled={busy}><PencilLine data-icon size={17} /> Editar informações do negócio</Button> : null}
            {analyzed && editingBusinessInfo ? <><p className="mt-4 text-sm leading-6 text-[#536178]">Faça os ajustes necessários. A nova análise vai substituir esta leitura, sem reiniciar a configuração inicial.</p><Button type="button" size="lg" className="mt-3 w-full sm:w-auto" onClick={() => void onAnalyze()} disabled={!sessionReady || busy || sourcesProcessing}>{busy || sourcesProcessing ? <LoaderCircle data-icon size={17} className="animate-spin" /> : <WandSparkles data-icon size={17} />}{sourcesProcessing ? "Importando materiais…" : busy ? "Analisando novamente…" : "Analisar novamente"}</Button></> : null}
          </section>

          {analyzed && session && !editingBusinessInfo && !architectureReviewed ? <AIMessage role="assistant">Esta é a proposta para o seu negócio. A Sobe preparou os caminhos; você não precisa configurar as etapas.</AIMessage> : null}
          {analyzed && session?.commercialArchitecture && !editingBusinessInfo && !session.architectureReviewed ? <CommercialArchitectureReview architecture={session.commercialArchitecture} busy={busy} onConfirm={onConfirmArchitecture} onUpdate={onUpdateArchitecture} /> : null}

          {!editingBusinessInfo && architectureReviewed && !ready && !creating && requiredQuestions.length ? <section id="adaptive-questions" aria-labelledby="adaptive-questions-title">
            <div className="mb-3"><h2 id="adaptive-questions-title" className="flex items-center gap-2 text-sm font-extrabold"><MessageSquareText size={17} className="text-[#0054fc]" /> Só falta o necessário para funcionar</h2><p className="mt-1 text-sm leading-6 text-[#526171]">{readiness.blocking === 1 ? "Falta 1 informação." : `Faltam ${readiness.blocking} informações.`} Responda com suas palavras. A Sobe usa esses dados para conectar os caminhos aos seus canais reais.</p></div>
            <AdaptiveQuestion key={requiredQuestions[0].id} question={requiredQuestions[0]} busy={busy || busyQuestion === requiredQuestions[0].key} onAnswer={(value) => onAnswer(requiredQuestions[0].key, value)} />
          </section> : null}

          {!editingBusinessInfo && architectureReviewed && !ready && !creating && optionalQuestions.length ? <details className="border-t border-[#dfe6ee] pt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Melhorias opcionais — podem ficar para depois</summary><div className="grid gap-3">{optionalQuestions.map((question) => <AdaptiveQuestion key={question.id} question={question} busy={busy} onAnswer={(value) => onAnswer(question.key, value)} />)}</div></details> : null}

          {analyzed && !editingBusinessInfo && !ready && (degraded || unresolvedWithoutControl) ? <div role="alert" className="border border-[#f0d28f] bg-[#fff9e9] p-5 text-[#795b16]"><h2 className="text-base font-extrabold">Ainda não há contexto suficiente para montar uma estrutura segura.</h2><p className="mt-2 text-sm leading-6">{blockingIssue || "Uma informação necessária ficou sem uma forma segura de confirmação."}</p><Button type="button" size="sm" variant="secondary" className="mt-4" onClick={() => void onAnalyze()} disabled={busy}>{busy ? <LoaderCircle data-icon size={15} className="animate-spin" /> : null}Analisar novamente</Button></div> : null}

          {answerFeedback ? <div aria-live="polite" className="border border-[#b9e4cf] bg-[#f0fbf6] p-3 text-sm font-semibold text-[#25684f]">✓ {answerFeedback}</div> : null}

          {analyzed && !editingBusinessInfo && architectureReviewed && !ready && !creating && readiness.readyToGenerate && !busy ? <div className="border border-[#c8d9ea] bg-[#f7fbff] p-5"><h2 className="text-lg font-extrabold tracking-[-.025em]">Sua proposta está pronta para criar.</h2><p className="mt-2 text-sm leading-6 text-[#526171]">Retome a criação do rascunho. Fotos e outros detalhes podem ser adicionados depois.</p><Button type="button" size="lg" className="mt-4" onClick={() => void onGenerate()} disabled={!sessionReady || busy}><WandSparkles data-icon size={17} /> Criar minha primeira versão</Button></div> : null}

          <GenerationStatus status={generationStatus} />
          {ready && projectId ? <div className="border border-[#b9e4cf] bg-[#f0fbf6] p-6" style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)" }}><h2 className="text-2xl font-extrabold tracking-[-.035em]">Sua primeira versão está pronta.</h2><p className="mt-2 text-sm leading-6 text-[#526b61]">Teste como visitante, veja as pendências e publique quando estiver tudo certo.</p><Button type="button" size="lg" className="mt-5" onClick={onOpenLaunch}>Revisar primeira versão <ArrowRight data-icon size={17} /></Button></div> : null}

          {error ? <div role="alert" className="border border-[#ffd0cf] bg-[#fff1f0] p-4 text-sm font-semibold text-[#a33b35]">{error}</div> : null}
          <Link href="/app/onboarding/manual" className="text-center text-xs font-bold text-[#536178] underline decoration-[#9fc3ff] underline-offset-4 sm:hidden">Prefiro a configuração manual</Link>
        </div>
      </div>
    </main>
  );
}
