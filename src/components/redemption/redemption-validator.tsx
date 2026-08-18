"use client";
import { useState } from "react";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { ClaimCodeInput } from "./claim-code-input";
import {
  BenefitValidationCard,
  type ValidatedBenefit,
} from "./benefit-validation-card";
import {
  MonetaryBenefitCalculator,
  type Calculation,
} from "./monetary-benefit-calculator";
import { RedemptionSuccess } from "./redemption-success";
export function RedemptionValidator() {
  const [code, setCode] = useState("");
  const [benefit, setBenefit] = useState<ValidatedBenefit>();
  const [subtotal, setSubtotal] = useState("");
  const [calculation, setCalculation] = useState<Calculation>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/redeem/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      data?: unknown;
      error?: { message?: string };
    };
    if (!response.ok)
      throw new Error(payload.error?.message || "Não foi possível continuar.");
    return payload.data;
  }
  async function validate() {
    setBusy("validate");
    setError("");
    try {
      setBenefit((await post("validate", { code })) as ValidatedBenefit);
      setCalculation(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível validar.",
      );
    } finally {
      setBusy("");
    }
  }
  async function calculate() {
    setBusy("calculate");
    setError("");
    try {
      setCalculation(
        (await post("calculate", {
          code,
          subtotal: Number(subtotal),
        })) as Calculation,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível calcular.",
      );
    } finally {
      setBusy("");
    }
  }
  async function consume() {
    setBusy("consume");
    setError("");
    try {
      await post("consume", {
        code,
        subtotal: subtotal ? Number(subtotal) : undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      setSuccess(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível resgatar.",
      );
    } finally {
      setBusy("");
    }
  }
  function reset() {
    setCode("");
    setBenefit(undefined);
    setSubtotal("");
    setCalculation(undefined);
    setSuccess(false);
    setError("");
  }
  if (success) return <RedemptionSuccess onAgain={reset} />;
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Brand size="sm" className="text-[#0054fc]" />
          <h1 className="mt-2 text-4xl font-black tracking-[-.05em]">
            Validar benefício
          </h1>
          <p className="mt-2 text-[#6c6c76]">
            Uso restrito para equipe autorizada.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            fetch("/api/redeem/logout", { method: "POST" }).then(() =>
              location.reload(),
            )
          }
          aria-label="Sair do validador"
          className="grid size-11 place-items-center rounded-xl border border-[#dedde5] bg-white"
        >
          <LogOut size={18} />
        </button>
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]">
        <div>
          <ClaimCodeInput
            value={code}
            onChange={setCode}
            disabled={Boolean(busy)}
          />
          <button
            type="button"
            onClick={validate}
            disabled={code.length !== 7 || Boolean(busy)}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0054fc] font-extrabold text-white disabled:opacity-50"
          >
            {busy === "validate" ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <ShieldCheck size={18} />
            )}
            Validar
          </button>
          {benefit ? (
            <div className="mt-5">
              <BenefitValidationCard benefit={benefit} />
            </div>
          ) : null}
        </div>
        {benefit?.valid ? (
          <div>
            <MonetaryBenefitCalculator
              subtotal={subtotal}
              onSubtotal={setSubtotal}
              calculation={calculation}
              onCalculate={calculate}
              busy={Boolean(busy)}
            />
            <button
              type="button"
              onClick={consume}
              disabled={Boolean(busy) || (Boolean(subtotal) && !calculation)}
              className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0054fc] px-5 font-extrabold text-white disabled:opacity-50"
            >
              {busy === "consume" ? <Loader2 className="animate-spin" /> : null}
              Confirmar resgate
            </button>
            <p className="mt-3 text-center text-xs text-[#777780]">
              A confirmação é registrada e não pode ser apagada.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d8d6e0] p-6 text-sm text-[#74747d]">
            Digite o código para ver somente as informações necessárias do
            benefício.
          </div>
        )}
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-700"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
