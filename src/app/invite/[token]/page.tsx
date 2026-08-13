"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState("");
  async function accept() {
    setStatus("Aceitando convite…");
    const response = await fetch(
      `/api/invitations/${encodeURIComponent(token)}/accept`,
      { method: "POST" },
    );
    const payload = await response.json();
    if (!response.ok) {
      setStatus(
        payload.error?.message || "Não foi possível aceitar o convite.",
      );
      return;
    }
    await fetch("/api/workspaces/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: payload.data.workspaceId }),
    });
    router.push("/app");
    router.refresh();
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7fa] p-6">
      <section className="w-full max-w-lg rounded-3xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold text-[#6255d8]">Convite Virou</p>
        <h1 className="mt-3 text-3xl font-extrabold">
          Colabore neste workspace
        </h1>
        <p className="mt-3 text-sm text-[#686873]">
          Entre com o mesmo e-mail que recebeu o convite e confirme sua entrada.
        </p>
        <button
          type="button"
          onClick={() => void accept()}
          className="mt-7 min-h-12 rounded-xl bg-[#17171c] px-5 font-bold text-white"
        >
          Aceitar convite
        </button>
        {status && <p className="mt-4 text-sm">{status}</p>}
      </section>
    </main>
  );
}
