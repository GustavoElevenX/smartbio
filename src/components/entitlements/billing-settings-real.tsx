"use client";

import { EmbeddedCheckout, EmbeddedCheckoutProvider, Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AlertTriangle, CalendarDays, Check, CreditCard, FileText, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clientEnv } from "@/lib/env/client";
import { getTrialDaysRemaining, SOBE_PRO, SOBE_TRIAL } from "@/lib/sobe-pro";
import type { BillingStatusDto } from "@/server/billing/billing-service";
import type { WorkspaceEntitlements } from "@/server/entitlements/entitlement-types";
import { SurfaceViewMarker } from "@/components/product-lifecycle/surface-view-marker";

const included = [
  "1 negócio e até 5 páginas publicadas",
  "Até 3 membros na equipe",
  "50 ações com IA por mês",
  "Jornadas, oportunidades e analytics",
  "Orçamentos, agendamentos e multiunidades",
  "Identidade visual a partir da logo",
] as const;

const publishableKey = clientEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function date(value?: string) {
  return value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "—";
}

function money(value: number, currency = "brl") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency.toUpperCase() }).format(value / 100);
}

function friendlyStatus(status?: string) {
  return ({ active: "Ativa", past_due: "Pagamento pendente", canceled: "Encerrada", unpaid: "Não paga", incomplete: "Aguardando pagamento", incomplete_expired: "Expirada", paused: "Pausada", paid: "Paga", open: "Em aberto", draft: "Rascunho", void: "Cancelada", uncollectible: "Não cobrável" } as Record<string, string>)[status || ""] || "Status indisponível";
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(payload?.error?.message || "Não foi possível concluir a operação.");
  return payload?.data as T;
}

function PaymentMethodForm({ onSaved }: { onSaved: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true);
    setError(undefined);
    const result = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/app/settings/billing?payment_method=return` },
      redirect: "if_required",
    });
    if (result.error) {
      setError(result.error.message || "Confira os dados e tente novamente.");
      setSaving(false);
      return;
    }
    const raw = result.setupIntent?.payment_method;
    const paymentMethodId = typeof raw === "string" ? raw : raw?.id;
    if (!paymentMethodId) {
      setError("A Stripe não retornou a forma de pagamento confirmada.");
      setSaving(false);
      return;
    }
    try {
      await api("/api/billing/payment-method", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar a forma de pagamento.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <PaymentElement options={{ layout: "tabs" }} />
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={!stripe || saving}>
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
        {saving ? "Salvando…" : "Salvar forma de pagamento"}
      </Button>
      <p className="text-xs leading-5 text-[#596879]">Os dados são enviados diretamente à Stripe. A SOBE não recebe nem armazena o número completo do cartão ou CVC.</p>
    </form>
  );
}

export function BillingSettingsReal() {
  const [entitlements, setEntitlements] = useState<WorkspaceEntitlements>();
  const [billing, setBilling] = useState<BillingStatusDto>();
  const [valueSummary, setValueSummary] = useState<{ periodDays: number; sessions: number; opportunities: number; conversions: number; confirmedValue: number }>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string>();
  const [errorNotice, setErrorNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [checkoutSecret, setCheckoutSecret] = useState<string>();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelComment, setCancelComment] = useState("");
  const [setupSecret, setSetupSecret] = useState<string>();
  const [setupOpen, setSetupOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [entitlementData, billingData, valueData] = await Promise.all([
        api<WorkspaceEntitlements>("/api/workspace/entitlements"),
        api<BillingStatusDto>("/api/billing/status"),
        api<{ periodDays: number; sessions: number; opportunities: number; conversions: number; confirmedValue: number }>("/api/billing/value-summary"),
      ]);
      setEntitlements(entitlementData);
      setBilling(billingData);
      setValueSummary(valueData);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const isTrial = entitlements?.plan.key === SOBE_TRIAL.key;
  const isExpiredTrial = isTrial && entitlements?.plan.status === "expired";
  const trialStarted = isTrial && Boolean(entitlements?.plan.endsAt);
  const daysRemaining = getTrialDaysRemaining(entitlements?.plan.endsAt);
  const isPastDue = billing?.financialStatus === "past_due";
  const isCanceled = ["canceled", "unpaid", "incomplete_expired", "paused"].includes(billing?.financialStatus || "");
  const checkoutAvailable = Boolean(billing?.configured && stripePromise && billing.canManage);
  const headline = billing?.plan === "pro"
    ? isCanceled
      ? "Sua assinatura terminou."
      : billing.cancelAtPeriodEnd
        ? `Sua assinatura será encerrada em ${date(billing.currentPeriodEnd)}.`
        : isPastDue
          ? "Precisamos atualizar sua cobrança."
          : "SOBE Pro ativo"
    : isExpiredTrial
      ? "Seu período de teste terminou."
      : trialStarted
        ? `${daysRemaining} ${daysRemaining === 1 ? "dia restante" : "dias restantes"} no teste.`
        : "Seu teste começa com a primeira estrutura.";

  const appearance = useMemo(() => ({
    theme: "stripe" as const,
    variables: { colorPrimary: "#0054fc", colorText: "#07172f", borderRadius: "12px", fontFamily: "var(--font-inter), Arial, sans-serif" },
  }), []);

  async function openCheckout() {
    setBusy("checkout");
    setSuccessNotice(undefined);
    setErrorNotice(undefined);
    try {
      const session = await api<{ clientSecret: string }>("/api/billing/checkout", { method: "POST" });
      setCheckoutSecret(session.clientSecret);
      setCheckoutOpen(true);
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : "Não foi possível abrir o Checkout.");
      await load();
    } finally {
      setBusy(undefined);
    }
  }

  async function mutate(url: string, success: string, body?: Record<string, unknown>) {
    setBusy(url);
    setSuccessNotice(undefined);
    setErrorNotice(undefined);
    try {
      await api(url, { method: "POST", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      setSuccessNotice(success);
      setCancelOpen(false);
      await load();
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(undefined);
    }
  }

  async function openPaymentMethod() {
    setBusy("setup");
    setSuccessNotice(undefined);
    setErrorNotice(undefined);
    try {
      const intent = await api<{ clientSecret: string }>("/api/billing/setup-intent", { method: "POST" });
      setSetupSecret(intent.clientSecret);
      setSetupOpen(true);
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : "Não foi possível iniciar a atualização.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="mx-auto max-w-6xl pb-16">
      {isExpiredTrial ? <SurfaceViewMarker surface="paywall" /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-[-.03em]">Plano e cobrança</h1>
          <p className="mt-2 max-w-2xl text-[#536178]">Assine, acompanhe cobranças e gerencie sua forma de pagamento sem sair da SOBE.</p>
        </div>
        <Button variant="ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} aria-hidden="true" /> {loading ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" className="mt-7 grid min-h-80 place-items-center rounded-2xl bg-white shadow-[0_14px_40px_rgba(7,23,47,.07)]">
          <span className="flex items-center gap-3 text-sm font-medium text-[#596879]"><Loader2 className="size-5 animate-spin text-[#0054fc]" aria-hidden="true" />Carregando plano e cobranças…</span>
        </div>
      ) : null}
      {!loading && failed ? (
        <div role="alert" className="mt-7 rounded-2xl bg-red-50 p-5 text-sm text-red-800">
          <p>Não foi possível carregar seu plano. Tente novamente para consultar dados atualizados.</p>
          <Button variant="secondary" className="mt-4" onClick={() => void load()}>Tentar novamente</Button>
        </div>
      ) : null}

      {!loading && !failed ? <>
      {errorNotice ? <div role="alert" className="mt-7 rounded-2xl bg-red-50 p-5 text-sm font-medium text-red-800">{errorNotice}</div> : null}
      {successNotice ? <div role="status" className="mt-7 rounded-2xl bg-[#e9fffc] p-5 text-sm font-medium text-[#075e54]">{successNotice}</div> : null}
      {billing?.enabled && !billing.configured ? <div role="alert" className="mt-7 flex gap-3 rounded-2xl bg-amber-50 p-5 text-sm text-amber-900"><AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><span>A cobrança está habilitada, mas a configuração Stripe deste ambiente está incompleta. O plano continua visível, porém as ações financeiras ficam indisponíveis.</span></div> : null}

      <section className="mt-7 overflow-hidden rounded-2xl bg-[#07172f] text-white shadow-[0_24px_64px_rgba(7,23,47,.18)]">
        <div className="sobe-gradient-rule" />
        <div className="grid gap-10 p-6 sm:p-8 lg:grid-cols-[1.05fr_.95fr] lg:p-10">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full bg-[#0054fc] px-3 py-1.5 text-xs font-bold">{billing?.plan === "pro" ? SOBE_PRO.name : entitlements?.plan.name || "Carregando plano…"}</span>
              {billing?.plan === "pro" ? <span className="text-xs font-semibold text-white/70">{billing.cancelAtPeriodEnd ? "Cancelamento agendado" : friendlyStatus(billing.financialStatus)}</span> : null}
            </div>
            <h2 className="mt-6 max-w-2xl text-3xl font-extrabold tracking-[-.03em] sm:text-4xl">{headline}</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/70">
              {billing?.plan === "pro"
                ? billing.cancelAtPeriodEnd
                  ? "Você mantém todos os recursos Pro até o fim do período já pago. É possível reativar antes dessa data."
                  : isPastDue
                    ? "Não conseguimos processar sua última cobrança. Atualize a forma de pagamento para manter o SOBE Pro."
                    : isCanceled
                      ? "Seus dados continuam salvos. Assine novamente quando quiser voltar ao SOBE Pro."
                      : `${SOBE_PRO.formattedPrice}/mês · ${SOBE_PRO.launchLabel}`
                : isExpiredTrial
                  ? "Sua estrutura continua salva. Assine o SOBE Pro para colocá-la novamente no ar."
                  : trialStarted
                    ? "Teste completo, sem cartão. Ao assinar, começa uma cobrança mensal normal — sem trial na Stripe."
                    : "Conclua o onboarding e gere sua primeira estrutura. Só então os 7 dias começam a contar."}
            </p>

            {isPastDue ? <div role="alert" className="mt-6 flex gap-3 rounded-xl border border-amber-300/40 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100"><AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><span>Pagamento pendente. Atualize a forma de pagamento para evitar a interrupção do SOBE Pro.</span></div> : null}
            {billing?.cancelAtPeriodEnd ? <div className="mt-6 flex gap-3 rounded-xl border border-amber-300/40 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100"><CalendarDays className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><span>Cancelamento agendado. Seu acesso termina em {date(billing.currentPeriodEnd)}.</span></div> : null}

            {billing?.plan === "pro" && !isCanceled ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="border-t border-white/15 pt-4">
                  <span className="text-xs text-white/55">Mensalidade</span>
                  <strong className="mt-1 block text-lg">R$ 69,90/mês</strong>
                </div>
                <div className="border-t border-white/15 pt-4">
                  <span className="text-xs text-white/55">{billing.cancelAtPeriodEnd ? "Acesso até" : "Próxima renovação"}</span>
                  <strong className="mt-1 block text-lg tabular-nums">{date(billing.currentPeriodEnd)}</strong>
                </div>
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              {(billing?.plan !== "pro" || isCanceled) && billing?.canManage ? <Button onClick={() => void openCheckout()} disabled={!checkoutAvailable || busy === "checkout"}>{busy === "checkout" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}{isCanceled ? "Assinar novamente" : "Assinar SOBE Pro"}</Button> : null}
              {billing?.canReactivate ? <Button onClick={() => void mutate("/api/billing/reactivate", "Assinatura reativada com sucesso.")} disabled={Boolean(busy)}>{busy === "/api/billing/reactivate" ? <Loader2 className="size-4 animate-spin" /> : null}Reativar assinatura</Button> : null}
              {billing?.canUpdatePaymentMethod ? <Button variant="secondary" onClick={() => void openPaymentMethod()} disabled={Boolean(busy)}>{busy === "setup" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}Alterar forma de pagamento</Button> : null}
            </div>
            {billing && !billing.canManage ? <div className="mt-6 rounded-xl border border-white/15 bg-white/5 p-4 text-sm leading-6 text-white/75"><strong className="block text-white">Acesso somente para consulta</strong>Você pode acompanhar plano e cobranças, mas somente o owner do workspace pode assinar, cancelar ou alterar a forma de pagamento.</div> : null}
          </div>

          <div className="border-t border-white/15 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <h3 className="font-extrabold">Tudo no {SOBE_PRO.name}</h3>
            <ul className="mt-5 grid gap-3">
              {included.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-white/80"><Check className="mt-1 size-4 shrink-0 text-[#02e5cd]" aria-hidden="true" />{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {valueSummary ? (
        <section aria-labelledby="value-title" className="mt-8 rounded-2xl border border-[#dfe6ee] bg-white p-5 shadow-[0_14px_40px_rgba(7,23,47,.06)] sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 id="value-title" className="text-xl font-extrabold tracking-[-.02em]">Valor observado antes da cobrança</h2><p className="mt-1 text-sm text-[#596879]">Últimos {valueSummary.periodDays} dias, sem projeções nem receita estimada.</p></div>
            <strong className="text-2xl tabular-nums text-[#0054fc]">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueSummary.confirmedValue)}</strong>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-[#e8edf2] pt-5">
            {[["Sessões", valueSummary.sessions], ["Oportunidades", valueSummary.opportunities], ["Conversões", valueSummary.conversions]].map(([label, value]) => <div key={String(label)}><dt className="text-xs text-[#596879]">{String(label)}</dt><dd className="mt-1 text-xl font-extrabold tabular-nums">{Number(value).toLocaleString("pt-BR")}</dd></div>)}
          </dl>
        </section>
      ) : null}

      {billing?.plan === "pro" ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <section aria-labelledby="payment-title">
            <h2 id="payment-title" className="text-xl font-extrabold tracking-[-.02em]">Forma de pagamento</h2>
            <div className="mt-4 rounded-2xl bg-white p-5 shadow-[0_14px_40px_rgba(7,23,47,.07)]">
              {billing.paymentMethod ? <div className="flex items-center gap-4"><span className="grid size-11 place-items-center rounded-xl bg-[#eaf3ff] text-[#0054fc]"><CreditCard className="size-5" /></span><div><strong className="block text-sm capitalize">{billing.paymentMethod.brand} •••• {billing.paymentMethod.last4}</strong><span className="text-xs text-[#596879]">Expira em {String(billing.paymentMethod.expMonth).padStart(2, "0")}/{billing.paymentMethod.expYear}</span></div></div> : <p className="text-sm text-[#596879]">Nenhuma forma de pagamento disponível para exibição.</p>}
            </div>
            {billing.canCancel ? <button type="button" onClick={() => setCancelOpen(true)} className="focus-ring mt-5 min-h-11 text-sm font-semibold text-red-700 underline decoration-red-200 underline-offset-4 hover:decoration-red-700">Cancelar assinatura</button> : null}
          </section>

          <section aria-labelledby="invoices-title">
            <div className="flex items-center justify-between gap-4"><h2 id="invoices-title" className="text-xl font-extrabold tracking-[-.02em]">Cobranças recentes</h2><span className="text-xs text-[#596879]">Dados da Stripe</span></div>
            <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-[0_14px_40px_rgba(7,23,47,.07)]">
              {billing.invoices.length ? <ul className="divide-y divide-[#edf0f4]">{billing.invoices.map((invoice) => <li key={invoice.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f0f4f8] text-[#536178]"><FileText className="size-4" /></span><div className="min-w-0 flex-1"><strong className="block text-sm">{invoice.number || "Cobrança SOBE Pro"}</strong><span className="mt-1 block text-xs text-[#596879]">{date(invoice.createdAt)} · {friendlyStatus(invoice.status)}</span></div><strong className="text-sm tabular-nums">{money(invoice.status === "paid" ? invoice.amountPaid : invoice.amountDue, invoice.currency)}</strong>{invoice.hostedUrl || invoice.pdfUrl ? <a href={invoice.hostedUrl || invoice.pdfUrl} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-11 items-center text-sm font-semibold text-[#0054fc] underline decoration-blue-200 underline-offset-4">Ver fatura</a> : null}</li>)}</ul> : <div className="p-7 text-center"><CalendarDays className="mx-auto size-6 text-[#91a0b4]" /><p className="mt-3 text-sm text-[#596879]">As cobranças aparecerão aqui depois da primeira fatura.</p></div>}
            </div>
          </section>
        </div>
      ) : null}

      {isTrial ? <p className="mt-6 text-sm leading-6 text-[#596879]">Mantemos sua estrutura salva por {SOBE_TRIAL.retentionDays} dias após o fim do teste para você poder reativá-la com a assinatura.</p> : null}

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6"><DialogTitle>Assinar SOBE Pro</DialogTitle><DialogDescription>R$ 69,90 por mês. Checkout seguro incorporado à SOBE.</DialogDescription></DialogHeader>
          <div className="min-h-[500px] px-2 pb-4 sm:px-4">{checkoutSecret && stripePromise ? <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret: checkoutSecret, onComplete: () => { setCheckoutOpen(false); setSuccessNotice("Assinatura concluída. Estamos atualizando seu plano."); window.setTimeout(() => void load(), 1500); } }}><EmbeddedCheckout /></EmbeddedCheckoutProvider> : <div className="grid min-h-[400px] place-items-center"><Loader2 className="size-7 animate-spin text-[#0054fc]" aria-label="Carregando Checkout" /></div>}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar forma de pagamento</DialogTitle><DialogDescription>Cadastre um novo método para as próximas cobranças do SOBE Pro.</DialogDescription></DialogHeader>
          {setupSecret && stripePromise ? <Elements stripe={stripePromise} options={{ clientSecret: setupSecret, appearance }}><PaymentMethodForm onSaved={() => { setSetupOpen(false); setSuccessNotice("Forma de pagamento atualizada com sucesso."); void load(); }} /></Elements> : <div className="grid min-h-48 place-items-center"><Loader2 className="size-7 animate-spin text-[#0054fc]" /></div>}
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar assinatura?</DialogTitle><DialogDescription>Seu acesso ao SOBE Pro continuará até {date(billing?.currentPeriodEnd)}. Não haverá reembolso automático e seus dados permanecerão salvos.</DialogDescription></DialogHeader>
          <div className="space-y-4"><label className="block text-sm font-bold">Motivo (opcional)<select value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#dfe6ee] bg-white px-3 font-normal"><option value="">Prefiro não responder</option><option value="not_using">Não estou usando</option><option value="no_traffic">Não tive tráfego</option><option value="no_result">Não tive resultado</option><option value="too_expensive">Ficou caro</option><option value="alternative">Encontrei outra ferramenta</option><option value="missing_feature">Faltou funcionalidade</option><option value="other">Outro</option></select></label><label className="block text-sm font-bold">Comentário (opcional)<textarea value={cancelComment} onChange={(event) => setCancelComment(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-[#dfe6ee] bg-white p-3 font-normal" /></label></div>
          <DialogFooter className="gap-3"><Button variant="secondary" onClick={() => setCancelOpen(false)}>Manter assinatura</Button><Button variant="danger" onClick={() => void mutate("/api/billing/cancel", "Cancelamento agendado para o fim do período.", { reason: cancelReason || undefined, comment: cancelComment || undefined })} disabled={Boolean(busy)}>{busy === "/api/billing/cancel" ? <Loader2 className="size-4 animate-spin" /> : null}Confirmar cancelamento</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      </> : null}
    </div>
  );
}
