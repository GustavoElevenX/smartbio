"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

export function ConfirmEmailActions() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function resend() {
    setLoading(true);
    const supabase = createClient();
    if (supabase && email.trim()) await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${location.origin}/auth/callback?next=/app/onboarding` } });
    setMessage("Se o cadastro existir, um novo link foi enviado.");
    setLoading(false);
  }
  return (
    <div className="mt-7 text-left">
      <Label htmlFor="confirmation-email">E-mail do cadastro</Label>
      <Input id="confirmation-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <Button className="mt-3 w-full" type="button" disabled={loading || !email.trim()} onClick={resend}>{loading ? "Enviando…" : "Reenviar confirmação"}</Button>
      {message ? <p role="status" className="mt-3 text-center text-xs text-[#6b6b76]">{message}</p> : null}
    </div>
  );
}
