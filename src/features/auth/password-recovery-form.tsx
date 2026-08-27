"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, LoaderCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/features/auth/password-recovery";

type RecoveryState = "checking" | "ready" | "invalid" | "configuration" | "success";

export function PasswordRecoveryForm() {
  const [state, setState] = useState<RecoveryState>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setState("configuration");
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setState(sessionError || !data.session ? "invalid" : "ready");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) setState("ready");
      if (!session && event !== "INITIAL_SESSION") setState("invalid");
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setState("configuration");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        setState("invalid");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error("update_failed");
      setState("success");
      setPassword("");
      setConfirmation("");
    } catch {
      setError("Não foi possível atualizar sua senha. Solicite um novo link e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (state === "checking") {
    return <div className="text-center text-sm text-[#6b6b76]" role="status">Validando seu link…</div>;
  }

  if (state === "success") {
    return (
      <div className="text-center">
        <CheckCircle2 size={46} className="mx-auto text-[#15966c]" />
        <h1 className="mt-5 text-3xl font-extrabold tracking-[-.04em]">Senha alterada</h1>
        <p className="mt-3 text-sm leading-6 text-[#6b6b76]">Sua nova senha já está ativa. Você pode continuar para o seu workspace.</p>
        <Link href="/app" className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-[#0054fc] px-5 text-sm font-bold text-white">Ir para o workspace</Link>
      </div>
    );
  }

  if (state === "configuration") {
    return (
      <div className="text-center">
        <ShieldAlert className="mx-auto text-[#c34848]" size={48} />
        <h1 className="mt-5 text-3xl font-extrabold tracking-[-.04em]">Recuperação indisponível</h1>
        <p className="mt-3 text-sm leading-6 text-[#6b6b76]">A autenticação não está configurada neste ambiente.</p>
        <Link href="/login" className="mt-7 inline-flex font-bold text-[#0054fc]">Voltar para o login</Link>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="text-center">
        <ShieldAlert className="mx-auto text-[#c34848]" size={48} />
        <h1 className="mt-5 text-3xl font-extrabold tracking-[-.04em]">Link inválido ou expirado</h1>
        <p className="mt-3 text-sm leading-6 text-[#6b6b76]">Solicite uma nova recuperação de senha para continuar.</p>
        <Link href="/forgot-password" className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-[#0054fc] px-5 text-sm font-bold text-white">Solicitar novo link</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">Crie uma nova senha.</h1>
      <p className="mt-3 text-sm leading-6 text-[#70707a]">Escolha uma senha com pelo menos {MIN_PASSWORD_LENGTH} caracteres para proteger sua conta.</p>
      <div className="mt-8 flex flex-col gap-5">
        <div>
          <Label htmlFor="new-password">Nova senha</Label>
          <div className="relative">
            <Input id="new-password" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" required className="pr-12" aria-invalid={Boolean(error)} />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar nova senha" : "Mostrar nova senha"} className="focus-ring absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[#777781]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirmar nova senha</Label>
          <div className="relative">
            <Input id="confirm-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type={showConfirmation ? "text" : "password"} autoComplete="new-password" required className="pr-12" aria-invalid={Boolean(error)} />
            <button type="button" onClick={() => setShowConfirmation((value) => !value)} aria-label={showConfirmation ? "Ocultar confirmação" : "Mostrar confirmação"} className="focus-ring absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[#777781]">{showConfirmation ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
        </div>
      </div>
      {error ? <div role="alert" className="mt-5 rounded-xl border border-[#ffd1d1] bg-[#fff1f1] p-3 text-sm font-medium text-[#a83333]">{error}</div> : null}
      <Button type="submit" size="lg" disabled={loading} className="mt-7 w-full">{loading ? <><LoaderCircle data-icon="inline-start" className="animate-spin" /> Atualizando…</> : "Atualizar senha"}</Button>
      <p className="mt-6 text-center text-sm text-[#777781]"><Link href="/login" className="font-bold text-[#0054fc]">Voltar para o login</Link></p>
    </form>
  );
}
