"use client";

import Link from "next/link";
import { Check, Copy, LoaderCircle, Mail, RefreshCw, Save, Trash2, Users } from "lucide-react";
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
        Dados reais da sua conta e do espaço de trabalho ativo.
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
              O e-mail da conta não pode ser alterado nesta tela.
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
  acceptance_url?: string;
  delivery?: "email" | "local_link";
}

type Feedback = { tone: "success" | "error" | "info"; message: string };

export function WorkspaceSettingsReal() {
  const [workspace, setWorkspace] = useState<WorkspaceData>();
  const [savedWorkspace, setSavedWorkspace] = useState<WorkspaceData>();
  const [role, setRole] = useState<"owner" | "member">("member");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string>();
  const [feedback, setFeedback] = useState<Feedback>();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const summary = await api<WorkspaceSummary>("/api/workspaces");
      const active = summary.workspaces.find(
        (item) => item.id === summary.activeWorkspaceId,
      );
      if (!active) throw new Error("Espaço de trabalho ativo não encontrado.");
      setRole(active.role);
      const [workspaceData, memberData, invitationData] = await Promise.all([
        api<WorkspaceData>(`/api/workspaces/${active.id}`),
        api<Member[]>(`/api/workspaces/${active.id}/members`),
        active.role === "owner"
          ? api<Invitation[]>(`/api/workspaces/${active.id}/invitations`)
          : Promise.resolve([]),
      ]);
      setWorkspace(workspaceData);
      setSavedWorkspace(workspaceData);
      setMembers(memberData);
      setInvitations(invitationData);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o espaço de trabalho.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!workspace) return;
    const name = workspace.name.trim();
    if (name.length < 2) {
      setFeedback({ tone: "error", message: "Informe um nome com pelo menos 2 caracteres." });
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspace.slug)) {
      setFeedback({ tone: "error", message: "O identificador precisa conter letras minúsculas, números ou hífens." });
      return;
    }
    setBusy("save");
    setFeedback({ tone: "info", message: "Salvando alterações…" });
    try {
      const saved = await api<WorkspaceData>(
        `/api/workspaces/${workspace.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, slug: workspace.slug }),
        },
      );
      setWorkspace(saved);
      setSavedWorkspace(saved);
      setFeedback({ tone: "success", message: "Espaço de trabalho atualizado com sucesso." });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível salvar o espaço de trabalho.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function invite() {
    if (!workspace) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setFeedback({ tone: "error", message: "Informe o e-mail da pessoa que deseja convidar." });
      return;
    }
    setBusy("invite");
    setFeedback({ tone: "info", message: "Criando convite…" });
    try {
      const created = await api<Invitation>(`/api/workspaces/${workspace.id}/invitations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setInviteEmail("");
      setInvitations((current) => [created, ...current]);
      setFeedback({
        tone: "success",
        message:
          created.delivery === "local_link"
            ? "Convite criado. Copie o endereço abaixo para compartilhar."
            : "Convite criado e colocado na fila de envio por e-mail.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível criar o convite.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function removeMember(userId: string, label: string) {
    if (!workspace) return;
    if (!window.confirm(`Remover ${label} deste espaço de trabalho?`)) return;
    setBusy(`member:${userId}`);
    try {
      await api(`/api/workspaces/${workspace.id}/members/${userId}`, {
        method: "DELETE",
      });
      setMembers((current) => current.filter((member) => member.user_id !== userId));
      setFeedback({ tone: "success", message: `${label} foi removido do espaço de trabalho.` });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível remover o membro.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function revokeInvitation(invitation: Invitation) {
    if (!workspace) return;
    if (!window.confirm(`Cancelar o convite enviado para ${invitation.email}?`)) return;
    setBusy(`invitation:${invitation.id}`);
    try {
      await api(`/api/workspaces/${workspace.id}/invitations/${invitation.id}`, {
        method: "DELETE",
      });
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      setFeedback({ tone: "success", message: `Convite para ${invitation.email} cancelado.` });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível cancelar o convite.",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function copyInvitationLink(invitation: Invitation) {
    if (!invitation.acceptance_url) return;
    try {
      await navigator.clipboard.writeText(invitation.acceptance_url);
      setFeedback({ tone: "success", message: `Endereço de convite para ${invitation.email} copiado.` });
    } catch {
      setFeedback({ tone: "error", message: "Não foi possível copiar o endereço. Selecione-o manualmente." });
    }
  }

  if (loading) {
    return (
      <SettingsFrame>
        <SettingsNav active="workspace" />
        <div className="flex min-h-64 items-center justify-center gap-3 rounded-2xl border border-[#e4e3ea] bg-white text-sm font-semibold text-[#686873]">
          <LoaderCircle size={18} className="animate-spin" /> Carregando espaço de trabalho…
        </div>
      </SettingsFrame>
    );
  }

  if (loadError || !workspace) {
    return (
      <SettingsFrame>
        <SettingsNav active="workspace" />
        <section className="rounded-2xl border border-[#f0c9c9] bg-[#fffafa] p-6">
          <h2 className="font-extrabold text-[#9f2f2f]">Não foi possível abrir o espaço de trabalho</h2>
          <p className="mt-2 text-sm text-[#6d5151]">{loadError || "Os dados do espaço de trabalho não foram encontrados."}</p>
          <Button className="mt-5" variant="secondary" onClick={() => void load()}>
            <RefreshCw size={16} /> Tentar novamente
          </Button>
        </section>
      </SettingsFrame>
    );
  }

  const workspaceChanged =
    workspace.name !== savedWorkspace?.name || workspace.slug !== savedWorkspace?.slug;

  return (
    <SettingsFrame>
      <SettingsNav active="workspace" />
      <section className="rounded-2xl border border-[#e4e3ea] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-extrabold">Espaço de trabalho</h2>
            <p className="mt-1 text-sm text-[#686873]">Organize o acesso da equipe e a identificação deste espaço.</p>
          </div>
          <span className="rounded-full bg-[#edf4ff] px-3 py-1 text-xs font-bold text-[#0054fc]">
            {role === "owner" ? "Proprietário" : "Membro"}
          </span>
        </div>
        {role !== "owner" ? (
          <p className="mt-5 rounded-xl bg-[#f5f4f8] p-4 text-sm text-[#686873]">
            Você pode consultar estas informações. Somente o proprietário pode alterá-las ou gerenciar a equipe.
          </p>
        ) : null}
        <form className="mt-6" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="workspace-name">Nome</Label>
              <Input
                id="workspace-name"
                required
                minLength={2}
                maxLength={160}
                disabled={role !== "owner" || Boolean(busy)}
                value={workspace.name}
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
                required
                maxLength={80}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                aria-describedby="workspace-slug-help"
                disabled={role !== "owner" || Boolean(busy)}
                value={workspace.slug}
                onChange={(event) =>
                  setWorkspace((current) =>
                    current
                      ? { ...current, slug: slugify(event.target.value) }
                      : current,
                  )
                }
              />
              <p id="workspace-slug-help" className="mt-1 text-xs leading-5 text-[#686873]">
                Usado internamente em endereços e integrações. Aceita letras, números e hífens.
              </p>
            </div>
          </div>
          {role === "owner" ? (
            <Button className="mt-6 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!workspaceChanged || Boolean(busy)}>
              {busy === "save" ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              {busy === "save" ? "Salvando…" : "Salvar espaço de trabalho"}
            </Button>
          ) : null}
        </form>
      </section>
      <section className="mt-5 rounded-2xl border border-[#e4e3ea] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[#0054fc]" />
          <h2 className="font-extrabold">Equipe</h2>
          <span className="text-xs text-[#777781]">{members.length}</span>
        </div>
        {role === "owner" ? (
          <form className="mt-5 flex max-w-2xl flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void invite(); }}>
            <Input
              aria-label="E-mail para convite"
              type="email"
              required
              maxLength={250}
              placeholder="colega@empresa.com"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              disabled={Boolean(busy)}
            />
            <Button type="submit" className="shrink-0 disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(busy) || !inviteEmail.trim()}>
              {busy === "invite" ? <LoaderCircle size={16} className="animate-spin" /> : <Mail size={16} />}
              {busy === "invite" ? "Criando…" : "Convidar"}
            </Button>
          </form>
        ) : null}
        <div className="mt-6 max-w-2xl divide-y divide-[#ecebf0]">
          {members.map((member) => {
            const profile = Array.isArray(member.profiles)
              ? member.profiles[0]
              : member.profiles;
            const memberLabel = profile?.full_name || profile?.email || member.user_id;
            return (
              <div
                key={member.user_id}
                className="flex items-center gap-3 py-4"
              >
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">
                    {memberLabel}
                  </strong>
                  <span className="block truncate text-xs text-[#686873]">
                    {profile?.email || "E-mail indisponível"} · {member.role === "owner" ? "Proprietário" : "Membro"}
                  </span>
                </div>
                {role === "owner" && member.role !== "owner" && (
                  <Button
                    type="button"
                    size="icon"
                    variant="danger"
                    disabled={Boolean(busy)}
                    aria-label={`Remover ${memberLabel}`}
                    onClick={() => void removeMember(member.user_id, memberLabel)}
                  >
                    {busy === `member:${member.user_id}` ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </Button>
                )}
              </div>
            );
          })}
          {!members.length ? (
            <p className="py-5 text-sm text-[#686873]">Nenhum membro encontrado.</p>
          ) : null}
        </div>
        {role === "owner" && invitations.length ? (
          <div className="mt-7 max-w-2xl">
            <h3 className="text-sm font-extrabold">Convites pendentes</h3>
            <div className="mt-2 divide-y divide-[#ecebf0]">
          {invitations.map((invitation) => (
                <div key={invitation.id} className="flex flex-wrap items-center gap-3 py-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate">{invitation.email}</strong>
                    <span className="text-xs text-[#78602b]">
                      Expira em {new Intl.DateTimeFormat("pt-BR").format(new Date(invitation.expires_at))}
                    </span>
                    {invitation.acceptance_url ? (
                      <input
                        aria-label={`Endereço de convite para ${invitation.email}`}
                        readOnly
                        value={invitation.acceptance_url}
                        className="mt-2 block w-full truncate rounded-lg bg-[#f5f4f8] px-2 py-1.5 text-xs text-[#686873]"
                        onFocus={(event) => event.currentTarget.select()}
                      />
                    ) : null}
                  </div>
                  {invitation.acceptance_url ? (
                    <Button type="button" size="icon" variant="secondary" disabled={Boolean(busy)} aria-label={`Copiar endereço para ${invitation.email}`} onClick={() => void copyInvitationLink(invitation)}>
                      <Copy size={16} />
                    </Button>
                  ) : null}
                  <Button type="button" size="icon" variant="danger" disabled={Boolean(busy)} aria-label={`Cancelar convite para ${invitation.email}`} onClick={() => void revokeInvitation(invitation)}>
                    {busy === `invitation:${invitation.id}` ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div aria-live="polite" className="mt-4 min-h-5">
          {feedback ? (
            <p className={`inline-flex items-center gap-1.5 text-sm font-semibold ${feedback.tone === "error" ? "text-[#a93636]" : feedback.tone === "success" ? "text-[#147b58]" : "text-[#536178]"}`}>
              {feedback.tone === "success" ? <Check size={15} /> : null}
              {feedback.message}
            </p>
          ) : null}
        </div>
      </section>
    </SettingsFrame>
  );
}
