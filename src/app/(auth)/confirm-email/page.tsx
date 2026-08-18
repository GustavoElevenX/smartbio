import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ConfirmEmailActions } from "@/features/auth/confirm-email-actions";

export const metadata: Metadata = { title: "Confirme seu e-mail" };

export default function ConfirmEmailPage() {
  return (
    <div className="text-center">
      <MailCheck className="mx-auto text-[#0054fc]" size={48} />
      <h1 className="mt-5 text-3xl font-extrabold tracking-[-.04em]">Confirme seu e-mail</h1>
      <p className="mt-3 text-sm leading-6 text-[#6b6b76]">Abra a mensagem enviada pela Sobe para ativar sua conta. O link leva você de volta com segurança.</p>
      <ConfirmEmailActions />
      <Link href="/login" className="mt-6 inline-flex text-sm font-bold text-[#0054fc]">Voltar para o login</Link>
    </div>
  );
}
