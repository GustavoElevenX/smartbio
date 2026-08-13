"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SupportSession {
  id: string;
  reason: string;
  expires_at: string;
  workspaces: { name: string } | Array<{ name: string }> | null;
}

export function SupportModeBanner() {
  const router = useRouter();
  const [session, setSession] = useState<SupportSession | null>();
  useEffect(() => {
    void fetch("/api/support/current")
      .then((response) => response.json())
      .then((payload: { data?: SupportSession | null }) =>
        setSession(payload.data || null),
      )
      .catch(() => setSession(null));
  }, []);
  if (!session) return null;
  const workspace = Array.isArray(session.workspaces)
    ? session.workspaces[0]
    : session.workspaces;
  async function endSupport() {
    const response = await fetch("/api/support/current", { method: "DELETE" });
    if (!response.ok) return;
    router.push("/admin/support");
    router.refresh();
  }
  return (
    <aside className="sticky top-[73px] z-30 -mx-4 mb-6 border-b border-amber-300 bg-amber-100 px-4 py-3 shadow-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2">
        <div className="min-w-0 flex-1">
          <strong className="block text-xs tracking-[.12em] text-amber-950">
            VOCÊ ESTÁ EM MODO SUPORTE
          </strong>
          <span className="font-extrabold text-amber-950">
            {workspace?.name || session.id}
          </span>
          <p className="text-xs text-amber-900">
            Motivo: {session.reason} · expira em{" "}
            {new Date(session.expires_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void endSupport()}
          className="min-h-10 rounded-xl bg-amber-950 px-4 text-sm font-bold text-white"
        >
          Encerrar suporte
        </button>
      </div>
    </aside>
  );
}
