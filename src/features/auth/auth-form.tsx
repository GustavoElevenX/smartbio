"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { localStore } from "@/lib/local-store";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "register" | "forgot" }) {
  const router = useRouter();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const supabase = createClient();
      if (mode === "forgot") {
        if (supabase) { const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/app/settings/profile` }); if (resetError) throw resetError; }
        await new Promise((resolve) => setTimeout(resolve, 500)); setSent(true); return;
      }
      if (password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      if (supabase) {
        if (mode === "register") { const { error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } }); if (signUpError) throw signUpError; }
        else { const { error: signInError } = await supabase.auth.signInWithPassword({ email, password }); if (signInError) throw signInError; }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 550));
        localStore.setUser({ name: name || email.split("@")[0] || "Usuário", email });
      }
      router.push(mode === "register" ? "/app/onboarding" : "/app"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível continuar."); }
    finally { setLoading(false); }
  }

  if (sent) return <div className="text-center"><CheckCircle2 size={46} className="mx-auto text-[#15966c]" /><h1 className="mt-5 text-3xl font-extrabold tracking-[-.04em]">Confira seu e-mail</h1><p className="mt-3 text-sm leading-6 text-[#6b6b76]">Se existir uma conta para <strong>{email}</strong>, enviamos as instruções de redefinição.</p><Link href="/login" className="mt-7 inline-flex font-bold text-[#6154dd]">Voltar para o login</Link></div>;

  const title = mode === "login" ? "Que bom ter você de volta." : mode === "register" ? "Crie sua primeira experiência." : "Recupere seu acesso.";
  const description = mode === "login" ? "Entre para continuar conduzindo decisões." : mode === "register" ? "Explique seu negócio. A SmartBio cuida do primeiro caminho." : "Digite seu e-mail e enviaremos as instruções.";
  return <form onSubmit={submit} noValidate>
    <h1 className="text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">{title}</h1><p className="mt-3 text-sm leading-6 text-[#70707a]">{description}</p>
    <div className="mt-8 space-y-5">
      {mode === "register" && <div><Label htmlFor="name">Seu nome</Label><Input id="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required placeholder="Como podemos chamar você?" /></div>}
      <div><Label htmlFor="email">E-mail</Label><Input id="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="voce@empresa.com" /></div>
      {mode !== "forgot" && <div><div className="flex items-center justify-between"><Label htmlFor="password">Senha</Label>{mode === "login" && <Link href="/forgot-password" className="mb-2 text-xs font-bold text-[#6559dc]">Esqueci minha senha</Link>}</div><div className="relative"><Input id="password" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required placeholder="Mínimo de 6 caracteres" className="pr-12" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="focus-ring absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[#777781]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>}
    </div>
    {error && <div role="alert" className="mt-5 rounded-xl border border-[#ffd1d1] bg-[#fff1f1] p-3 text-sm font-medium text-[#a83333]">{error}</div>}
    <Button type="submit" size="lg" disabled={loading} className="mt-7 w-full">{loading ? <><LoaderCircle size={18} className="animate-spin" /> Processando…</> : <>{mode === "login" ? "Entrar" : mode === "register" ? "Criar conta grátis" : "Enviar instruções"}<ArrowRight size={17} /></>}</Button>
    <p className="mt-6 text-center text-sm text-[#777781]">{mode === "login" ? <>Ainda não tem conta? <Link href="/register" className="font-bold text-[#5f52d8]">Comece grátis</Link></> : mode === "register" ? <>Já tem uma conta? <Link href="/login" className="font-bold text-[#5f52d8]">Entrar</Link></> : <Link href="/login" className="font-bold text-[#5f52d8]">Voltar para o login</Link>}</p>
  </form>;
}
