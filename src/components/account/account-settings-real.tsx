"use client";

import Link from "next/link";
import { Mail, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SettingsNav } from "@/components/dashboard/settings-panels";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { slugify } from "@/lib/utils";

type ApiResult<T> =
  { ok: true; data: T } | { ok: false; error: { message: string } };

async function api<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const result = (await response.json()) as ApiResult<T>;
  if (!response.ok || !result.ok)
    throw new Error(result.ok ? "Falha na operação." : result.error.message);
  return result.data;
}

function SettingsFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl animate-enter">
      <h1 className="text-3xl font-extrabold tracking-[-.04em]">
        Configurações
      </h1>
      <p className="mt-2 text-sm text-[#74747e]">
        Dados reais da sua conta e do workspace ativo.
      </p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

export function ProfileSettingsReal() {
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    avatar_url: "",
  });
  const [status, setStatus] = useState("Carregando…");

  useEffect(() => {
    void api<{
      full_name: string | null;
      email: string;
      avatar_url: string | null;
    }>("/api/account/profile")
      .then((data) => {
        setProfile({
          full_name: data.full_name || "",
          email: data.email || "",
          avatar_url: data.avatar_url || "",
        });
        setStatus("");
      })
      .catch((error: Error) => setStatus(error.message));
  }, []);

  async function save() {
    setStatus("Salvando…");
    try {
      await api("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: profile.full_name || null,
          avatarUrl: profile.avatar_url || null,
        }),
      });
      setStatus("Alterações salvas.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao salvar.");
    }
  }

  return (
    <SettingsFrame>
      <SettingsNav active="profile" />
      <section className="rounded-[22px] border border-[#e4e3ea] bg-white p-6">
        <h2 className="font-extrabold">Informações do perfil</h2>
        <div className="mt-6 grid max-w-2xl gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="profile-name">Nome completo</Label>
            <Input
              id="profile-name"
              value={profile.full_name}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  full_name: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="profile-email">E-mail</Label>
            <Input id="profile-email" value={profile.email} disabled />
            <p className="mt-1 text-xs text-[#777781]">
              Alterações de e-mail seguem o fluxo seguro do Supabase Auth.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="profile-avatar">URL do avatar</Label>
            <Input
              id="profile-avatar"
              type="url"
              value={profile.avatar_url}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  avatar_url: event.target.value,
                }))
              }
            />
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Button onClick={() => void save()}>
            <Save size={16} /> Salvar alterações
          </Button>
          {status && <span className="text-xs text-[#686873]">{status}</span>}
        </div>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold"
        >
          Redefinir senha por e-mail
        </Link>
      </section>
    </SettingsFrame>
  );
}

interface WorkspaceSummary {
  activeWorkspaceId: string;
  workspaces: Array<{ id: string; role: "owner" | "member" }>;
}
interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
}
interface Member {
  user_id: string;
  role: "owner" | "member";
  profiles:
    | { full_name: string | null; email: string | null }
    | Array<{ full_name: string | null; email: string | null }>;
}
interface Invitation {
  id: string;
  email: string;
  expires_at: string;
}

export function WorkspaceSettingsReal() {
  const [workspace, setWorkspace] = useState<WorkspaceData>();
  const [role, setRole] = useState<"owner" | "member">("member");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [status, setStatus] = useState("Carregando…");

  const load = useCallback(async () => {
    try {
      const summary = await api<WorkspaceSummary>("/api/workspaces");
      const active = summary.workspaces.find(
        (item) => item.id === summary.activeWorkspaceId,
      );
      if (!active) throw new Error("Workspace ativo não encontrado.");
      setRole(active.role);
      const [workspaceData, memberData] = await Promise.all([
        api<WorkspaceData>(`/api/workspaces/${active.id}`),
        api<Member[]>(`/api/workspaces/${active.id}/members`),
      ]);
      setWorkspace(workspaceData);
      setMembers(memberData);
      if (active.role === "owner") {
        setInvitations(
          await api<Invitation[]>(`/api/workspaces/${active.id}/invitations`),
        );
      }
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao carregar.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!workspace) return;
    setStatus("Salvando…");
    try {
      const saved = await api<WorkspaceData>(
        `/api/workspaces/${workspace.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: workspace.name, slug: workspace.slug }),
        },
      );
      setWorkspace(saved);
      setStatus("Workspace salvo.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao salvar.");
    }
  }

  async function invite() {
    if (!workspace) return;
    setStatus("Enviando convite…");
    try {
      await api(`/api/workspaces/${workspace.id}/invitations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      setInviteEmail("");
      setStatus("Convite enfileirado para envio.");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao convidar.");
    }
  }

  async function removeMember(userId: string) {
    if (!workspace) return;
    try {
      await api(`/api/workspaces/${workspace.id}/members/${userId}`, {
        method: "DELETE",
      });
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao remover.");
    }
  }

  return (
    <SettingsFrame>
      <SettingsNav active="workspace" />
      <section className="rounded-[22px] border border-[#e4e3ea] bg-white p-6">
        <h2 className="font-extrabold">Workspace</h2>
        <div className="mt-6 grid max-w-2xl gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="workspace-name">Nome</Label>
            <Input
              id="workspace-name"
              disabled={role !== "owner"}
              value={workspace?.name || ""}
              onChange={(event) =>
                setWorkspace((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
            />
          </div>
          <div>
            <Label htmlFor="workspace-slug">Identificador</Label>
            <Input
              id="workspace-slug"
              disabled={role !== "owner"}
              value={workspace?.slug || ""}
              onChange={(event) =>
                setWorkspace((current) =>
                  current
                    ? { ...current, slug: slugify(event.target.value) }
                    : current,
                )
              }
            />
          </div>
        </div>
        {role === "owner" && (
          <Button className="mt-6" onClick={() => void save()}>
            <Save size={16} /> Salvar workspace
          </Button>
        )}
      </section>
      <section className="mt-5 rounded-[22px] border border-[#e4e3ea] bg-white p-6">
        <h2 className="font-extrabold">Membros</h2>
        {role === "owner" && (
          <div className="mt-5 flex max-w-2xl gap-2">
            <Input
              aria-label="E-mail para convite"
              type="email"
              placeholder="colega@empresa.com"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
            <Button onClick={() => void invite()}>
              <Mail size={16} /> Convidar
            </Button>
          </div>
        )}
        <div className="mt-6 max-w-2xl divide-y">
          {members.map((member) => {
            const profile = Array.isArray(member.profiles)
              ? member.profiles[0]
              : member.profiles;
            return (
              <div
                key={member.user_id}
                className="flex items-center gap-3 py-4"
              >
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">
                    {profile?.full_name || profile?.email || member.user_id}
                  </strong>
                  <span className="text-xs text-[#777781]">
                    {profile?.email} · {member.role}
                  </span>
                </div>
                {role === "owner" && member.role !== "owner" && (
                  <button
                    type="button"
                    aria-label={`Remover ${profile?.email || "membro"}`}
                    className="rounded-xl border p-2 text-red-700"
                    onClick={() => void removeMember(member.user_id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
          {invitations.map((invitation) => (
            <div key={invitation.id} className="py-4 text-sm">
              <strong>{invitation.email}</strong>
              <span className="ml-2 text-xs text-amber-700">
                convite pendente até{" "}
                {new Date(invitation.expires_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
        {status && <p className="mt-4 text-xs text-[#686873]">{status}</p>}
      </section>
    </SettingsFrame>
  );
}
