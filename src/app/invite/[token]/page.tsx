"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [accepting, setAccepting] = useState(false);
  useEffect(() => setReady(true), []);
  async function accept() {
    if (accepting) return;
    setAccepting(true);
    setStatus("Aceitando convite…");
    try {
      const response = await fetch(
        `/api/invitations/${encodeURIComponent(token)}/accept`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload.error?.message || "Não foi possível aceitar o convite.");
        return;
      }
      await fetch("/api/workspaces/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: payload.data.workspaceId }),
      });
      router.push("/app");
      router.refresh();
    } catch {
      setStatus("Não foi possível aceitar o convite. Tente novamente.");
    } finally {
      setAccepting(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6">
      <section className="w-full max-w-lg rounded-3xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold text-[#0054fc]">Convite Sobe</p>
        <h1 className="mt-3 text-3xl font-extrabold">
          Colabore neste espaço de trabalho
        </h1>
        <p className="mt-3 text-sm text-[#686873]">
          Entre com o mesmo e-mail que recebeu o convite e confirme sua entrada.
        </p>
        <button
          type="button"
          onClick={() => void accept()}
          disabled={!ready || accepting}
          className="mt-7 min-h-12 rounded-xl bg-[#0054fc] px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Aceitar convite
        </button>
        {status && <p className="mt-4 text-sm">{status}</p>}
      </section>
    </main>
  );
}
