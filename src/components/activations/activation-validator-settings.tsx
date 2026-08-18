"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Loader2, Plus, ShieldCheck } from "lucide-react";

interface Validator {
  id: string;
  name: string;
  location?: string;
  locationId?: string;
  lastUsedAt?: string;
  active: boolean;
}

export function ActivationValidatorSettings({
  projectId,
  validators: initial,
  locations = [],
}: {
  projectId: string;
  validators: Validator[];
  locations?: Array<{ id: string; name: string }>;
}) {
  const [validators, setValidators] = useState(initial);
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [locationId, setLocationId] = useState("");
  const [busy, setBusy] = useState("");

  async function create() {
    setBusy("create");
    setToken("");
    const response = await fetch(`/api/projects/${projectId}/validators`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, locationId: locationId || undefined }),
    });
    const payload = (await response.json()) as {
      data?: {
        validator: {
          id: string;
          name: string;
          last_used_at?: string;
          is_active: boolean;
        };
        activationToken: string;
      };
    };
    if (response.ok && payload.data) {
      setValidators((current) => [
        {
          id: payload.data!.validator.id,
          name: payload.data!.validator.name,
          lastUsedAt: payload.data!.validator.last_used_at,
          active: payload.data!.validator.is_active,
        },
        ...current,
      ]);
      setToken(payload.data.activationToken);
      setName("");
    }
    setBusy("");
  }

  async function revoke(id: string) {
    setBusy(id);
    const response = await fetch(
      `/api/projects/${projectId}/validators/${id}`,
      { method: "DELETE" },
    );
    if (response.ok)
      setValidators((current) =>
        current.map((item) =>
          item.id === id ? { ...item, active: false } : item,
        ),
      );
    setBusy("");
  }

  return (
    <section className="rounded-2xl border border-[#e4e3ea] bg-white p-5">
      <h3 className="font-extrabold">Validadores</h3>
      <p className="mt-1 text-sm text-[#73737c]">
        Dispositivos restritos para validar benefícios, sem acesso ao dashboard.
      </p>
      <div className="mt-4 flex gap-2">
        <label className="sr-only" htmlFor="validator-name">
          Nome do dispositivo
        </label>
        <input
          id="validator-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Caixa principal"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#dedce6] px-3 text-sm"
        />
        <label className="sr-only" htmlFor="validator-location">Unidade</label>
        <select id="validator-location" value={locationId} onChange={(event)=>setLocationId(event.target.value)} className="min-h-11 rounded-xl border border-[#dedce6] px-3 text-sm">
          <option value="">Todas as unidades</option>
          {locations.map((location)=><option key={location.id} value={location.id}>{location.name}</option>)}
        </select>
        <button
          type="button"
          disabled={name.trim().length < 2 || busy === "create"}
          onClick={() => void create()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0054fc] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "create" ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Plus size={16} />
          )}
          Criar
        </button>
      </div>
      {token ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 font-bold text-emerald-900">
            <ShieldCheck size={18} />
            Token exibido uma única vez
          </div>
          <code className="mt-2 block break-all text-xs text-emerald-950">
            {token}
          </code>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(token)}
            className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-emerald-800"
          >
            <Copy size={14} />
            Copiar token
          </button>
        </div>
      ) : null}
      {validators.length ? (
        <div className="mt-4 divide-y">
          {validators.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div>
                <strong>{item.name}</strong>
                <p className="text-xs text-[#7b7b84]">
                  {item.location || "Todas as unidades"} ·{" "}
                  {item.active
                    ? item.lastUsedAt
                      ? `Último uso ${item.lastUsedAt}`
                      : "Ainda não usado"
                    : "Revogado"}
                </p>
              </div>
              {item.active ? (
                <button
                  type="button"
                  onClick={() => void revoke(item.id)}
                  disabled={busy === item.id}
                  className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700"
                >
                  {busy === item.id ? "Revogando…" : "Revogar"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-[#f4f3f7] p-4 text-sm text-[#74747e]">
          Nenhum validador configurado.
        </p>
      )}
      <Link
        href="/redeem"
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#07172f] px-4 text-sm font-bold text-white"
      >
        Abrir validação interna
      </Link>
    </section>
  );
}
