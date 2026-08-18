import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert } from "lucide-react";

export const metadata: Metadata = { title: "Não foi possível entrar" };

const messages: Record<string, string> = {
  invalid_callback: "O link é inválido ou expirou. Solicite uma nova confirmação e tente novamente.",
  workspace_required: "Sua conta foi confirmada, mas o workspace não pôde ser preparado.",
  configuration: "A autenticação ainda não foi configurada neste ambiente.",
  admin_access_denied: "Esta conta não possui acesso à administração da plataforma.",
  service_unavailable: "Não foi possível validar sua sessão agora. Verifique sua conexão e tente novamente.",
};

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <div className="text-center">
      <CircleAlert className="mx-auto text-[#c34848]" size={48} />
      <h1 className="mt-5 text-3xl font-extrabold tracking-[-.04em]">Não foi possível continuar</h1>
      <p className="mt-3 text-sm leading-6 text-[#6b6b76]">{messages[code || ""] || "Tente novamente. Se o problema continuar, fale com o suporte."}</p>
      <Link href="/login" className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-[#0054fc] px-5 text-sm font-bold text-white">Voltar para o login</Link>
    </div>
  );
}
