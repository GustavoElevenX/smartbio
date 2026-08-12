"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BriefcaseBusiness, Check, ChevronDown, CreditCard, Database, FileSearch, FolderKanban, Globe2, HelpCircle, Images, LayoutDashboard, Link2, Loader2, LogOut, Menu, Palette, PencilRuler, Settings, Target, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Brand } from "@/components/ui/brand";
import { cn } from "@/lib/utils";
import { localStore } from "@/lib/local-store";
import { createClient } from "@/lib/supabase/client";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { features } from "@/lib/constants";

interface WorkspaceSummary {
  id: string;
  name: string;
  plan: string;
  role: "owner" | "member";
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false); const [user, setUser] = useState({ name: "Você", email: "modo local" });
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [switchingWorkspace, setSwitchingWorkspace] = useState<string>();
  const projectId = pathname.match(/^\/app\/projects\/([^/]+)/)?.[1];
  const items = [
    { href: "/app", label: "Visão geral", icon: LayoutDashboard, exact: true },
    { href: "/app/projects", label: "Negócios", icon: FolderKanban, exact: true },
    { href: "/app/notifications", label: "Notificações", icon: BriefcaseBusiness, exact: true },
    ...(projectId ? [
      { href: `/app/projects/${projectId}`, label: "Visão geral", icon: LayoutDashboard, exact: true },
      { href: `/app/projects/${projectId}/conversion`, label: "Conversão", icon: Target },
      ...(features.presence ? [{ href: `/app/projects/${projectId}/site`, label: "Site", icon: Globe2 }] : []),
      { href: `/app/projects/${projectId}/editor`, label: "Jornada", icon: PencilRuler },
      { href: `/app/projects/${projectId}/entries`, label: "Entradas", icon: Link2 },
      { href: `/app/projects/${projectId}/opportunities`, label: "Oportunidades", icon: BriefcaseBusiness },
      { href: `/app/projects/${projectId}/analytics`, label: "Analytics", icon: BarChart3 },
      { href: `/app/projects/${projectId}/data`, label: "Dados comerciais", icon: Database },
      { href: `/app/projects/${projectId}/sources`, label: "Fontes e importações", icon: FileSearch },
      { href: `/app/projects/${projectId}/media`, label: "Mídia", icon: Images },
      { href: `/app/projects/${projectId}/brand`, label: "Marca", icon: Palette },
      { href: `/app/projects/${projectId}/settings`, label: "Configurações", icon: Settings },
    ] : []),
  ];
  useEffect(() => {
    const current = localStore.getUser(); if (current) setUser(current);
    void fetch("/api/workspaces").then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { data?: { activeWorkspaceId: string; workspaces: WorkspaceSummary[] } };
      setActiveWorkspaceId(payload.data?.activeWorkspaceId || "");
      setWorkspaces(payload.data?.workspaces || []);
    });
  }, []);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0];
  async function switchWorkspace(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) return;
    setSwitchingWorkspace(workspaceId);
    try {
      const response = await fetch("/api/workspaces/active", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId }) });
      if (!response.ok) throw new Error("Não foi possível trocar de workspace.");
      window.localStorage.removeItem("smartbio:last-ai-setup-session");
      setActiveWorkspaceId(workspaceId);
      setOpen(false);
      router.push("/app");
      router.refresh();
    } finally { setSwitchingWorkspace(undefined); }
  }
  async function logout() { const supabase = createClient(); if (supabase) await supabase.auth.signOut(); localStore.setUser(null); router.push("/"); }
  const sidebar = <><div className="flex h-[73px] items-center justify-between border-b border-[#e8e7ee] px-5"><Brand /><button onClick={() => setOpen(false)} className="focus-ring rounded-lg p-2 lg:hidden" aria-label="Fechar menu"><X size={20} /></button></div><div className="p-3"><Popover><PopoverTrigger asChild><button className="focus-ring flex w-full items-center gap-3 rounded-xl border border-[#e4e3ea] bg-white p-3 text-left shadow-sm"><span className="grid size-8 place-items-center rounded-lg bg-[#e9e6ff] text-xs font-extrabold text-[#5748d2]">{activeWorkspace?.name.slice(0, 2).toUpperCase() || "SB"}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{activeWorkspace?.name || "Meu workspace"}</strong><small className="block text-[#85858e]">Plano {activeWorkspace?.plan || "free"} · {activeWorkspace?.role === "owner" ? "Owner" : "Membro"}</small></span><ChevronDown size={15} className="text-[#888892]" /></button></PopoverTrigger><PopoverContent align="start" className="w-[226px] p-2"><p className="px-2 py-1 text-xs font-bold text-muted-foreground">Trocar workspace</p><div className="flex flex-col gap-1">{workspaces.map((workspace) => <button key={workspace.id} type="button" disabled={Boolean(switchingWorkspace)} onClick={() => void switchWorkspace(workspace.id)} className="focus-ring flex min-h-11 items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted"><span className="min-w-0 flex-1"><strong className="block truncate">{workspace.name}</strong><small className="text-muted-foreground">{workspace.role === "owner" ? "Owner" : "Membro"} · {workspace.plan}</small></span>{switchingWorkspace === workspace.id ? <Loader2 className="animate-spin" /> : workspace.id === activeWorkspaceId ? <Check /> : null}</button>)}</div></PopoverContent></Popover></div><nav className="flex-1 space-y-1 px-3 py-2">{items.map((item) => { const active = item.exact ? pathname === item.href : pathname.startsWith(item.href); const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn("focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition", active ? "bg-[#eae7ff] text-[#5548c8]" : "text-[#666670] hover:bg-[#eeeeF3] hover:text-[#27272c]")}><Icon size={18} />{item.label}</Link>; })}<div className="my-3 h-px bg-[#e7e6ed]" /><Link href="/app/settings/profile" className={cn("focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold", pathname.startsWith("/app/settings") ? "bg-[#eae7ff] text-[#5548c8]" : "text-[#666670] hover:bg-[#eeeef3]")}><Settings size={18} />Configurações</Link><Link href="/pricing" className="focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#666670] hover:bg-[#eeeef3]"><CreditCard size={18} />Planos</Link></nav><div className="p-3"><div className="rounded-[18px] bg-[#1d1c23] p-4 text-white"><HelpCircle size={19} className="text-[#aea5ff]" /><strong className="mt-5 block text-sm">Precisa de ajuda?</strong><p className="mt-1 text-xs leading-5 text-white/55">Consulte o guia de configuração.</p><Link href="/app/onboarding" className="mt-3 inline-flex text-xs font-bold text-[#bdb6ff]">Abrir guia →</Link></div><button onClick={logout} className="focus-ring mt-2 flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm text-[#696973] hover:bg-[#eeeef3]"><span className="grid size-8 place-items-center rounded-full bg-[#e2dfff] text-xs font-extrabold text-[#5649c9]">{user.name.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#34343a]">{user.name}</strong><small className="block truncate">{user.email}</small></span><LogOut size={16} /></button></div></>;
  return <div className="min-h-screen bg-[#f7f7fa]"><aside className="fixed inset-y-0 left-0 z-50 hidden w-[250px] flex-col border-r border-[#e5e4ec] bg-[#f9f9fb] lg:flex">{sidebar}</aside>{open && <div className="fixed inset-0 z-50 bg-black/25 lg:hidden" onClick={() => setOpen(false)}><aside className="flex h-full w-[280px] flex-col bg-[#f9f9fb]" onClick={(event) => event.stopPropagation()}>{sidebar}</aside></div>}<header className="fixed inset-x-0 top-0 z-40 flex h-[73px] items-center justify-between border-b border-[#e5e4ec] bg-white/90 px-4 backdrop-blur-xl lg:left-[250px] lg:px-7"><div className="flex items-center gap-3"><button onClick={() => setOpen(true)} className="focus-ring rounded-xl p-2 hover:bg-[#efeff3] lg:hidden" aria-label="Abrir menu"><Menu size={21} /></button><div><strong className="block text-sm">Virou</strong><span className="hidden text-xs text-[#85858e] sm:block">Da atenção à conversão</span></div></div><div className="flex items-center gap-2"><NotificationBell /><Link href="/app/projects/new" className="focus-ring inline-flex min-h-10 items-center rounded-xl bg-[#17171c] px-4 text-sm font-bold text-white">Novo negócio</Link></div></header><main className="min-h-screen pt-[73px] lg:pl-[250px]"><div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</div></main></div>;
}
